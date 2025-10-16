-- pgsodium + Vault setup for AI Sheets Analyst token encryption
-- Creates managed key for oauth token column encryption and minimal grants
--
-- NOTE: This file contains stubs as exact extension names and function signatures
-- may vary by Supabase version. Adjust as needed for your specific stack.

-- Enable extensions (names may vary by Supabase version)
DO $$
BEGIN
    -- Try the common extension names
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pgsodium;
        RAISE NOTICE 'pgsodium extension enabled successfully';
    EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not enable pgsodium extension: %', SQLERRM;
        RAISE NOTICE 'You may need to enable this manually or use TOKENS_ENCRYPTION_MODE=app_aes';
    END;

    BEGIN
        CREATE EXTENSION IF NOT EXISTS supabase_vault;
        RAISE NOTICE 'supabase_vault extension enabled successfully';
    EXCEPTION WHEN others THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS vault;
            RAISE NOTICE 'vault extension enabled successfully';
        EXCEPTION WHEN others THEN
            RAISE WARNING 'Could not enable vault extension: %', SQLERRM;
            RAISE NOTICE 'You may need to enable this manually or use TOKENS_ENCRYPTION_MODE=app_aes';
        END;
    END;
END $$;

-- Create the oauth tokens encryption key
-- NOTE: Adjust the function name if different in your Supabase version
DO $$
DECLARE
    key_id_result uuid;
BEGIN
    -- Try to create the named key for oauth token encryption
    BEGIN
        SELECT key_id INTO key_id_result
        FROM pgsodium.create_key(name => 'oauth_tokens_key_v1');

        RAISE NOTICE 'Created oauth_tokens_key_v1 with key_id: %', key_id_result;

        -- Store the key_id in a comment for reference
        COMMENT ON EXTENSION pgsodium IS
            'oauth_tokens_key_v1 created with key_id: ' || key_id_result::text;

    EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not create oauth_tokens_key_v1: %', SQLERRM;
        RAISE NOTICE 'Manual key creation may be required or use TOKENS_ENCRYPTION_MODE=app_aes';
    END;
END $$;

-- Create a role for encryption operations (if needed)
DO $$
BEGIN
    BEGIN
        CREATE ROLE svc_encryption;
        RAISE NOTICE 'Created svc_encryption role';
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'svc_encryption role already exists';
    END;
END $$;

-- Basic grants for the encryption service role
DO $$
BEGIN
    -- Grant necessary permissions to the service role
    BEGIN
        GRANT USAGE ON SCHEMA pgsodium TO svc_encryption;
        GRANT SELECT ON pgsodium.key TO svc_encryption;
        RAISE NOTICE 'Granted pgsodium permissions to svc_encryption';
    EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not grant pgsodium permissions: %', SQLERRM;
    END;
END $$;

-- Restrict access to the key table
-- Only the vault/owner and service roles should see key material
DO $$
BEGIN
    -- Enable RLS on pgsodium.key if possible
    BEGIN
        ALTER TABLE pgsodium.key ENABLE ROW LEVEL SECURITY;

        -- Policy to restrict key access
        CREATE POLICY "Restrict key access to service roles"
            ON pgsodium.key FOR ALL
            USING (
                current_setting('role') IN ('service_role', 'supabase_admin', 'svc_encryption')
                OR pg_has_role(current_user, 'service_role', 'USAGE')
            );

        RAISE NOTICE 'Enabled RLS on pgsodium.key table';
    EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not enable RLS on pgsodium.key: %', SQLERRM;
        RAISE NOTICE 'Manual security configuration may be required';
    END;
END $$;

-- Create a view for key metadata (service role only)
CREATE OR REPLACE VIEW oauth_keys_metadata AS
SELECT
    id,
    name,
    status,
    created
FROM pgsodium.key
WHERE name LIKE 'oauth_tokens_key_%';

-- Restrict view access to service role only
REVOKE ALL ON oauth_keys_metadata FROM PUBLIC;
GRANT SELECT ON oauth_keys_metadata TO service_role;
GRANT SELECT ON oauth_keys_metadata TO svc_encryption;

-- Add helpful comments
COMMENT ON VIEW oauth_keys_metadata IS
    'Metadata view for oauth token encryption keys - service role access only';

-- Final validation check
DO $$
BEGIN
    -- Check if the key was created successfully
    IF EXISTS (
        SELECT 1 FROM pgsodium.key
        WHERE name = 'oauth_tokens_key_v1'
    ) THEN
        RAISE NOTICE 'SUCCESS: oauth_tokens_key_v1 is ready for use';
        RAISE NOTICE 'You can set TOKENS_ENCRYPTION_MODE=pgsodium in your environment';
    ELSE
        RAISE WARNING 'oauth_tokens_key_v1 was not found - you may need manual setup';
        RAISE NOTICE 'Consider using TOKENS_ENCRYPTION_MODE=app_aes as fallback';
    END IF;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Could not validate key setup: %', SQLERRM;
    RAISE NOTICE 'Manual verification may be required';
END $$;