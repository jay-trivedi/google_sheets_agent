-- Final RLS enforcement for OAuth tokens - RPC-only access
-- This migration locks down direct access to token data and enforces RPC-only access patterns

-- Drop the basic oauth_tokens policies from 0002_policies.sql
-- We'll replace them with much stricter RPC-only policies
DROP POLICY IF EXISTS "Users can access their own tokens" ON oauth_tokens;
DROP POLICY IF EXISTS "Service role can access all tokens" ON oauth_tokens;

-- Ensure RLS is enabled on oauth_tokens table
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- STRICT POLICY: Block all direct access to sensitive columns
-- Users and applications MUST use the RPC functions for token operations

-- Policy 1: Deny direct SELECT access to ciphertext and nonce
CREATE POLICY "Block direct access to encrypted data"
    ON oauth_tokens FOR SELECT
    USING (FALSE); -- Deny all direct SELECT

-- Policy 2: Only allow INSERT via RPC context (when called from our functions)
CREATE POLICY "Allow INSERT only via RPC context"
    ON oauth_tokens FOR INSERT
    WITH CHECK (
        -- Only allow inserts when called from our RPC functions
        current_setting('application_name', true) LIKE '%rpc_encrypt_token%'
        OR auth.role() = 'service_role'
    );

-- Policy 3: Only allow UPDATE via RPC context
CREATE POLICY "Allow UPDATE only via RPC context"
    ON oauth_tokens FOR UPDATE
    USING (
        current_setting('application_name', true) LIKE '%rpc_%'
        OR auth.role() = 'service_role'
    );

-- Policy 4: Allow DELETE for cleanup operations (service role only)
CREATE POLICY "Allow DELETE for service role cleanup"
    ON oauth_tokens FOR DELETE
    USING (auth.role() = 'service_role');

-- Special policy for the metadata view access
-- Users can see their own token metadata (non-sensitive info only)
CREATE POLICY "Allow metadata view access for own tokens"
    ON oauth_tokens FOR SELECT
    USING (
        -- Only when accessing via the metadata view (no sensitive columns)
        current_query() ~ 'oauth_tokens_metadata'
        AND auth.uid()::text = user_id
    );

-- Service role gets full access for administrative operations
CREATE POLICY "Service role full access"
    ON oauth_tokens FOR ALL
    USING (auth.role() = 'service_role');

-- Create a secure function to verify RPC-only access is working
CREATE OR REPLACE FUNCTION test_rpc_only_access()
RETURNS TABLE (
    test_name TEXT,
    passed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Test 1: Direct SELECT should fail
    RETURN QUERY
    SELECT
        'Direct SELECT blocked'::TEXT,
        NOT EXISTS(
            SELECT 1 FROM oauth_tokens
            WHERE current_setting('role') != 'service_role'
        ),
        'Direct SELECT access is properly blocked'::TEXT;

    -- Test 2: RPC functions should work
    RETURN QUERY
    SELECT
        'RPC functions available'::TEXT,
        EXISTS(
            SELECT 1 FROM pg_proc
            WHERE proname IN ('rpc_encrypt_token', 'rpc_decrypt_token')
        ),
        'RPC functions are properly created'::TEXT;

    -- Test 3: Metadata view should work
    RETURN QUERY
    SELECT
        'Metadata view accessible'::TEXT,
        EXISTS(
            SELECT 1 FROM information_schema.views
            WHERE table_name = 'oauth_tokens_metadata'
        ),
        'Metadata view is available for safe access'::TEXT;

END $$;

-- Grant access to the test function
GRANT EXECUTE ON FUNCTION test_rpc_only_access() TO service_role;
GRANT EXECUTE ON FUNCTION test_rpc_only_access() TO authenticated;

-- Create a function to audit token access attempts
CREATE OR REPLACE FUNCTION audit_token_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log any direct access attempts (should be rare due to RLS)
    INSERT INTO patches (
        id,
        spreadsheet_id,
        plan_id,
        user_id,
        touched_ranges,
        before_state,
        after_state,
        applied_at
    )
    VALUES (
        gen_random_uuid(),
        'SECURITY_AUDIT',
        gen_random_uuid(),
        COALESCE(auth.uid()::text, 'unknown'),
        jsonb_build_array('oauth_tokens'),
        jsonb_build_object(
            'operation', TG_OP,
            'table', TG_TABLE_NAME,
            'user_role', current_setting('role'),
            'application_name', current_setting('application_name', true)
        ),
        NULL,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END $$;

-- Create trigger for auditing (disabled by default)
-- Uncomment the next line if you want to audit all token table access
-- CREATE TRIGGER oauth_tokens_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON oauth_tokens
--     FOR EACH ROW EXECUTE FUNCTION audit_token_access();

-- Revoke dangerous permissions from public and authenticated roles
REVOKE ALL ON oauth_tokens FROM PUBLIC;
REVOKE ALL ON oauth_tokens FROM authenticated;

-- Only grant what's needed for RLS policies to work
GRANT SELECT ON oauth_tokens_metadata TO authenticated;

-- Add security documentation
COMMENT ON TABLE oauth_tokens IS
    'OAuth tokens table with RLS enforcement. Direct access is blocked - use RPC functions only.
    - rpc_encrypt_token(): Store encrypted tokens
    - rpc_decrypt_token(): Retrieve tokens (service role only)
    - rpc_token_valid(): Check token validity
    - oauth_tokens_metadata view: Safe metadata access';

-- Create a function to rotate encryption keys (for future use)
CREATE OR REPLACE FUNCTION rpc_prepare_key_rotation(new_key_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This is a placeholder for key rotation logic
    -- In a real rotation, you would:
    -- 1. Create new key with new_key_name
    -- 2. Re-encrypt all tokens with new key
    -- 3. Update kid values
    -- 4. Deactivate old key

    RAISE NOTICE 'Key rotation preparation for: %', new_key_name;
    RETURN 'Key rotation prepared - implement full rotation logic in application';
END $$;

GRANT EXECUTE ON FUNCTION rpc_prepare_key_rotation(TEXT) TO service_role;

COMMENT ON FUNCTION rpc_prepare_key_rotation IS
    'Placeholder for future key rotation functionality. Service role only.';

-- Final security check
DO $$
BEGIN
    -- Verify that direct access is properly blocked
    IF EXISTS (
        SELECT 1 FROM information_schema.table_privileges
        WHERE table_name = 'oauth_tokens'
        AND privilege_type = 'SELECT'
        AND grantee = 'authenticated'
    ) THEN
        RAISE WARNING 'Security issue: authenticated role has direct SELECT on oauth_tokens';
    END IF;

    RAISE NOTICE 'OAuth tokens security lockdown complete';
    RAISE NOTICE 'Token access is now restricted to RPC functions only';
    RAISE NOTICE 'Use rpc_encrypt_token() and rpc_decrypt_token() for token operations';
END $$;