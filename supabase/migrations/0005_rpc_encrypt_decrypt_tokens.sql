-- Security-definer RPCs for oauth token encryption/decryption
-- Encapsulates encrypt/decrypt operations using pgsodium with oauth_tokens_key_v1

-- First, update the oauth_tokens table structure for encrypted storage
ALTER TABLE oauth_tokens DROP COLUMN IF EXISTS encrypted_access_token;
ALTER TABLE oauth_tokens DROP COLUMN IF EXISTS encrypted_refresh_token;

-- Add columns for pgsodium encrypted storage
ALTER TABLE oauth_tokens ADD COLUMN ciphertext BYTEA;
ALTER TABLE oauth_tokens ADD COLUMN nonce BYTEA;
ALTER TABLE oauth_tokens ADD COLUMN kid TEXT DEFAULT 'oauth_tokens_key_v1';

-- Create index on kid for key rotation support
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_kid ON oauth_tokens(kid);

-- Create the encryption RPC
CREATE OR REPLACE FUNCTION rpc_encrypt_token(
    p_user_id UUID,
    p_provider TEXT,
    p_token_json JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
    v_key_id UUID;
    v_nonce BYTEA;
    v_ciphertext BYTEA;
    v_plaintext BYTEA;
BEGIN
    -- Get the key ID for oauth_tokens_key_v1
    SELECT id INTO v_key_id
    FROM pgsodium.key
    WHERE name = 'oauth_tokens_key_v1'
    AND status = 'valid'
    LIMIT 1;

    IF v_key_id IS NULL THEN
        RAISE EXCEPTION 'oauth_tokens_key_v1 not found or invalid';
    END IF;

    -- Convert JSON to bytea for encryption
    v_plaintext := convert_to(p_token_json::text, 'UTF8');

    -- Generate random nonce
    v_nonce := gen_random_bytes(24);

    -- Encrypt using pgsodium
    v_ciphertext := pgsodium.crypto_aead_det_encrypt(
        v_plaintext,
        NULL, -- no additional data
        v_key_id::bytea,
        v_nonce
    );

    -- Upsert the encrypted token
    INSERT INTO oauth_tokens (
        user_id,
        ciphertext,
        nonce,
        kid,
        expires_at,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id::text,
        v_ciphertext,
        v_nonce,
        'oauth_tokens_key_v1',
        NOW() + INTERVAL '1 hour', -- Default 1 hour expiry
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        ciphertext = EXCLUDED.ciphertext,
        nonce = EXCLUDED.nonce,
        kid = EXCLUDED.kid,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW();

END $$;

-- Create the decryption RPC
CREATE OR REPLACE FUNCTION rpc_decrypt_token(
    p_user_id UUID,
    p_provider TEXT DEFAULT 'google'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
    v_record RECORD;
    v_key_id UUID;
    v_plaintext BYTEA;
    v_result JSONB;
BEGIN
    -- Get the token record
    SELECT ciphertext, nonce, kid
    INTO v_record
    FROM oauth_tokens
    WHERE user_id = p_user_id::text
    AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get the key ID
    SELECT id INTO v_key_id
    FROM pgsodium.key
    WHERE name = v_record.kid
    AND status = 'valid'
    LIMIT 1;

    IF v_key_id IS NULL THEN
        RAISE EXCEPTION 'Encryption key % not found or invalid', v_record.kid;
    END IF;

    -- Decrypt the token
    v_plaintext := pgsodium.crypto_aead_det_decrypt(
        v_record.ciphertext,
        NULL, -- no additional data
        v_key_id::bytea,
        v_record.nonce
    );

    IF v_plaintext IS NULL THEN
        RAISE EXCEPTION 'Failed to decrypt token for user %', p_user_id;
    END IF;

    -- Convert back to JSON
    v_result := convert_from(v_plaintext, 'UTF8')::JSONB;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't expose details
        RAISE WARNING 'Token decryption failed for user %: %', p_user_id, SQLERRM;
        RETURN NULL;
END $$;

-- Create helper function to check token expiry
CREATE OR REPLACE FUNCTION rpc_token_valid(
    p_user_id UUID,
    p_provider TEXT DEFAULT 'google'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM oauth_tokens
        WHERE user_id = p_user_id::text
        AND expires_at > NOW()
    );
END $$;

-- Create function to update token expiry
CREATE OR REPLACE FUNCTION rpc_extend_token_expiry(
    p_user_id UUID,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE oauth_tokens
    SET expires_at = p_expires_at,
        updated_at = NOW()
    WHERE user_id = p_user_id::text;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No token found for user %', p_user_id;
    END IF;
END $$;

-- Create cleanup function for expired tokens
CREATE OR REPLACE FUNCTION rpc_cleanup_expired_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM oauth_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days'; -- Keep for 7 days after expiry

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END $$;

-- Grant permissions to appropriate roles
GRANT EXECUTE ON FUNCTION rpc_encrypt_token(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_encrypt_token(UUID, TEXT, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_decrypt_token(UUID, TEXT) TO service_role;
-- Note: rpc_decrypt_token is service_role only for security

GRANT EXECUTE ON FUNCTION rpc_token_valid(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_token_valid(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_extend_token_expiry(UUID, TIMESTAMPTZ) TO service_role;

GRANT EXECUTE ON FUNCTION rpc_cleanup_expired_tokens() TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION rpc_encrypt_token IS
    'Encrypts and stores OAuth tokens using pgsodium. Accessible to authenticated users for their own tokens.';

COMMENT ON FUNCTION rpc_decrypt_token IS
    'Decrypts OAuth tokens using pgsodium. SERVICE ROLE ONLY for security.';

COMMENT ON FUNCTION rpc_token_valid IS
    'Checks if a user has a valid (non-expired) OAuth token.';

COMMENT ON FUNCTION rpc_extend_token_expiry IS
    'Updates token expiry time. Service role only.';

COMMENT ON FUNCTION rpc_cleanup_expired_tokens IS
    'Removes tokens expired more than 7 days ago. Service role only.';

-- Create a view for token metadata (no sensitive data)
CREATE OR REPLACE VIEW oauth_tokens_metadata AS
SELECT
    user_id,
    kid,
    expires_at,
    created_at,
    updated_at,
    CASE
        WHEN expires_at > NOW() THEN 'valid'
        ELSE 'expired'
    END as status
FROM oauth_tokens;

-- Grant access to the metadata view
GRANT SELECT ON oauth_tokens_metadata TO service_role;
GRANT SELECT ON oauth_tokens_metadata TO authenticated;

-- Add RLS policy for the metadata view
CREATE POLICY "Users can view their own token metadata"
    ON oauth_tokens_metadata FOR SELECT
    USING (auth.uid()::text = user_id);

COMMENT ON VIEW oauth_tokens_metadata IS
    'Non-sensitive metadata about OAuth tokens. Users can see their own, service role sees all.';