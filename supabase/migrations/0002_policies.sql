-- 0002_policies.sql
-- Row Level Security (RLS) policies for dev. Service role bypasses RLS automatically.

-- Enable RLS
alter table public.plans         enable row level security;
alter table public.reservations  enable row level security;
alter table public.patches       enable row level security;
alter table public.sessions      enable row level security;
alter table public.provenance    enable row level security;
alter table public.oauth_tokens  enable row level security;
alter table public.schema_cache  enable row level security;

-- Plans: users can see and create their own plans
create policy plans_select_own on public.plans
for select using (auth.uid()::text = user_id);
create policy plans_insert_own on public.plans
for insert with check (auth.uid()::text = user_id);

-- Reservations: users manage their own reservations
create policy reservations_select_own on public.reservations
for select using (auth.uid()::text = user_id);
create policy reservations_insert_own on public.reservations
for insert with check (auth.uid()::text = user_id);
create policy reservations_delete_own on public.reservations
for delete using (auth.uid()::text = user_id);

-- Patches: users can see patches they applied (service role can see all)
create policy patches_select_own on public.patches
for select using (auth.uid()::text = user_id);
create policy patches_insert_own on public.patches
for insert with check (auth.uid()::text = user_id);

-- Sessions: user can upsert their own session rows
create policy sessions_select_own on public.sessions
for select using (auth.uid()::text = user_id);
create policy sessions_upsert_own on public.sessions
for insert with check (auth.uid()::text = user_id);
create policy sessions_update_own on public.sessions
for update using (auth.uid()::text = user_id);

-- Provenance: readable to authenticated users; writes usually via service role
create policy provenance_select_all on public.provenance
for select using (auth.role() = 'authenticated');
create policy provenance_insert_authed on public.provenance
for insert with check (auth.role() = 'authenticated');

-- OAuth tokens: NO policies for regular roles (RLS on, deny by default).
-- Edge Functions run with service_role and bypass RLS, which is what we want.

-- Schema cache: readable to authenticated; writes via service role
create policy schema_cache_select_all on public.schema_cache
for select using (auth.role() = 'authenticated');
-- (no insert/update policy so normal users can't write)
