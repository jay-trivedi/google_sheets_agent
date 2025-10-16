-- Initial schema for AI Sheets Analyst
-- Core tables for plans, patches, reservations, and provenance

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Plans table - stores AI-generated plans
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    instruction TEXT NOT NULL,
    explain TEXT NOT NULL,
    actions JSONB NOT NULL,
    requested_reservations JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations table - time-based locks on cell ranges
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    range_a1 TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patches table - audit trail of applied changes
CREATE TABLE patches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    touched_ranges JSONB NOT NULL,
    before_state JSONB,
    after_state JSONB,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table - user presence and activity
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    active_range_a1 TEXT,
    sheet_name TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provenance table - tracks data imports and their sources
CREATE TABLE provenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    range_a1 TEXT NOT NULL,
    source_spreadsheet_id TEXT NOT NULL,
    source_sheet_name TEXT NOT NULL,
    source_range_a1 TEXT NOT NULL,
    pull_mode TEXT NOT NULL CHECK (pull_mode IN ('LIVE_LINK', 'SNAPSHOT')),
    row_count INTEGER NOT NULL,
    col_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth tokens table - encrypted user credentials
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema cache table - performance optimization for sheet metadata
CREATE TABLE schema_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spreadsheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    fingerprint JSONB NOT NULL,
    headers JSONB,
    row_count INTEGER,
    col_count INTEGER,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    UNIQUE(spreadsheet_id, sheet_name)
);

-- Indexes for performance
CREATE INDEX idx_plans_spreadsheet_user ON plans(spreadsheet_id, user_id);
CREATE INDEX idx_reservations_spreadsheet ON reservations(spreadsheet_id);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at);
CREATE INDEX idx_patches_spreadsheet ON patches(spreadsheet_id);
CREATE INDEX idx_patches_plan_id ON patches(plan_id);
CREATE INDEX idx_sessions_spreadsheet ON sessions(spreadsheet_id);
CREATE INDEX idx_provenance_spreadsheet ON provenance(spreadsheet_id);
CREATE INDEX idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX idx_schema_cache_spreadsheet_sheet ON schema_cache(spreadsheet_id, sheet_name);
CREATE INDEX idx_schema_cache_expires_at ON schema_cache(expires_at);