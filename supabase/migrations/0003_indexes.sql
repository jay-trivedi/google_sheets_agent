-- Additional performance indexes for AI Sheets Analyst
-- Optimized for realtime operations, conflict detection, and multi-user scenarios

-- Additional composite indexes for plans
CREATE INDEX idx_plans_created_at_desc ON plans(created_at DESC);
CREATE INDEX idx_plans_spreadsheet_created_at ON plans(spreadsheet_id, created_at DESC);

-- Reservation-specific indexes for conflict detection and TTL cleanup
CREATE INDEX idx_reservations_spreadsheet_range ON reservations(spreadsheet_id, range_a1);
CREATE INDEX idx_reservations_user_active ON reservations(user_id, expires_at) WHERE expires_at > NOW();
CREATE INDEX idx_reservations_plan_id ON reservations(plan_id);

-- Patches indexes for audit trail and undo operations
CREATE INDEX idx_patches_spreadsheet_applied_at ON patches(spreadsheet_id, applied_at DESC);
CREATE INDEX idx_patches_user_applied_at ON patches(user_id, applied_at DESC);

-- Sessions indexes for presence and realtime features
CREATE INDEX idx_sessions_last_seen ON sessions(last_seen DESC);
CREATE INDEX idx_sessions_spreadsheet_active ON sessions(spreadsheet_id, last_seen DESC)
  WHERE last_seen > NOW() - INTERVAL '5 minutes';

-- Provenance indexes for pull operations and footer generation
CREATE INDEX idx_provenance_spreadsheet_sheet ON provenance(spreadsheet_id, sheet_name);
CREATE INDEX idx_provenance_source_spreadsheet ON provenance(source_spreadsheet_id);
CREATE INDEX idx_provenance_created_at_desc ON provenance(created_at DESC);
CREATE INDEX idx_provenance_updated_at_desc ON provenance(updated_at DESC);

-- OAuth tokens additional indexes
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_updated_at ON oauth_tokens(updated_at DESC);

-- Schema cache indexes for performance optimization
CREATE INDEX idx_schema_cache_fingerprint ON schema_cache USING GIN (fingerprint);

-- Partial indexes for active/recent data
CREATE INDEX idx_plans_recent ON plans(spreadsheet_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '24 hours';

CREATE INDEX idx_patches_recent ON patches(spreadsheet_id, applied_at DESC)
  WHERE applied_at > NOW() - INTERVAL '7 days';

-- Cleanup indexes for maintenance operations
CREATE INDEX idx_reservations_expired ON reservations(expires_at) WHERE expires_at < NOW();
CREATE INDEX idx_sessions_stale ON sessions(last_seen) WHERE last_seen < NOW() - INTERVAL '1 hour';
CREATE INDEX idx_schema_cache_expired ON schema_cache(expires_at) WHERE expires_at < NOW();

-- Realtime broadcasting indexes
CREATE INDEX idx_reservations_realtime ON reservations(spreadsheet_id, created_at DESC, user_id);
CREATE INDEX idx_plans_realtime ON plans(spreadsheet_id, updated_at DESC, user_id);

-- Performance indexes for range overlap detection (for future queue implementation)
CREATE INDEX idx_reservations_range_gin ON reservations USING GIN (range_a1 gin_trgm_ops);

-- Add trigram extension if not exists (for range overlap detection)
CREATE EXTENSION IF NOT EXISTS pg_trgm;