-- 0003_indexes.sql
-- Targeted indexes for common access patterns

-- Plans
create index if not exists idx_plans_sheet_user on public.plans (spreadsheet_id, user_id);
create index if not exists idx_plans_created_at on public.plans (created_at);

-- Reservations
create index if not exists idx_reservations_sheet on public.reservations (spreadsheet_id);
create index if not exists idx_reservations_expires_at on public.reservations (expires_at);

-- Patches
create index if not exists idx_patches_sheet on public.patches (spreadsheet_id);
create index if not exists idx_patches_plan on public.patches (plan_id);
create index if not exists idx_patches_applied_at on public.patches (applied_at);

-- Sessions
create index if not exists idx_sessions_sheet on public.sessions (spreadsheet_id);
create index if not exists idx_sessions_last_seen on public.sessions (last_seen);

-- Provenance
create index if not exists idx_provenance_sheet on public.provenance (spreadsheet_id);
create index if not exists idx_provenance_created_at on public.provenance (created_at);

-- Schema cache
create index if not exists idx_schema_cache_sheet on public.schema_cache (spreadsheet_id, sheet_name);
create index if not exists idx_schema_cache_expires_at on public.schema_cache (expires_at);
