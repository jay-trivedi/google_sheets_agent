-- Row Level Security policies for AI Sheets Analyst
-- Enable RLS on all tables and create policies for user isolation

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_cache ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "Users can view their own plans"
  ON plans FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own plans"
  ON plans FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all plans"
  ON plans FOR ALL
  USING (auth.role() = 'service_role');

-- Reservations policies
CREATE POLICY "Users can view reservations in their spreadsheets"
  ON reservations FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.spreadsheet_id = reservations.spreadsheet_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can create their own reservations"
  ON reservations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own reservations"
  ON reservations FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own reservations"
  ON reservations FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all reservations"
  ON reservations FOR ALL
  USING (auth.role() = 'service_role');

-- Patches policies (audit log)
CREATE POLICY "Users can view patches for their spreadsheets"
  ON patches FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.spreadsheet_id = patches.spreadsheet_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert their own patches"
  ON patches FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all patches"
  ON patches FOR ALL
  USING (auth.role() = 'service_role');

-- Sessions policies (presence)
CREATE POLICY "Users can view sessions in their spreadsheets"
  ON sessions FOR SELECT
  USING (
    auth.uid()::text = user_id OR
    EXISTS (
      SELECT 1 FROM sessions other_sessions
      WHERE other_sessions.spreadsheet_id = sessions.spreadsheet_id
      AND other_sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can manage their own sessions"
  ON sessions FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all sessions"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Provenance policies
CREATE POLICY "Users can view provenance for their spreadsheets"
  ON provenance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.spreadsheet_id = provenance.spreadsheet_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert provenance records"
  ON provenance FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.spreadsheet_id = provenance.spreadsheet_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role can access all provenance"
  ON provenance FOR ALL
  USING (auth.role() = 'service_role');

-- OAuth tokens policies (basic - will be restricted further in 0006)
CREATE POLICY "Users can access their own tokens"
  ON oauth_tokens FOR ALL
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all tokens"
  ON oauth_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- Schema cache policies
CREATE POLICY "Users can view schema cache for their active spreadsheets"
  ON schema_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.spreadsheet_id = schema_cache.spreadsheet_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role can manage schema cache"
  ON schema_cache FOR ALL
  USING (auth.role() = 'service_role');