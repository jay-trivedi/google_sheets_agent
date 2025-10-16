-- 0001_init.sql
-- Initial schema for AI Sheets Analyst (clean/minimal, add-on v1)

-- Extensions
create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- Updated-at trigger util
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- =============== CORE TABLES ===============

-- Plans: AI-generated plans (planner output)
create table public.plans (
  id                uuid primary key default gen_random_uuid(),
  spreadsheet_id    text not null,
  user_id           text not null,
  instruction       text not null,
  explain           text not null,
  actions           jsonb not null,
  requested_reservations jsonb not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_plans_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

-- Reservations: time-based locks on A1 ranges
create table public.reservations (
  id                uuid primary key default gen_random_uuid(),
  spreadsheet_id    text not null,
  user_id           text not null,
  range_a1          text not null,
  expires_at        timestamptz not null,
  plan_id           uuid references public.plans(id) on delete cascade,
  created_at        timestamptz not null default now()
);

-- Patches: audit trail of applied changes (for undo)
create table public.patches (
  id                uuid primary key default gen_random_uuid(),
  spreadsheet_id    text not null,
  plan_id           uuid references public.plans(id) on delete cascade,
  user_id           text not null,
  touched_ranges    jsonb not null,
  before_state      jsonb,
  after_state       jsonb,
  applied_at        timestamptz not null default now()
);

-- Sessions: presence / activity (sidebar)
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  spreadsheet_id    text not null,
  user_id           text not null,
  display_name      text not null,
  active_range_a1   text,
  sheet_name        text,
  last_seen         timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- Provenance: cross-sheet pulls metadata
create table public.provenance (
  id                     uuid primary key default gen_random_uuid(),
  spreadsheet_id         text not null,
  sheet_name             text not null,
  range_a1               text not null,
  source_spreadsheet_id  text not null,
  source_sheet_name      text not null,
  source_range_a1        text not null,
  pull_mode              text not null check (pull_mode in ('LIVE_LINK','SNAPSHOT')),
  row_count              integer not null,
  col_count              integer not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_provenance_updated_at
before update on public.provenance
for each row execute function public.set_updated_at();

-- OAuth tokens: minimal, sealed refresh token only (base64(iv||ciphertext))
create table public.oauth_tokens (
  user_id               text not null,
  provider              text not null default 'google',
  sealed_refresh_token  text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (user_id, provider)
);

create trigger trg_oauth_tokens_updated_at
before update on public.oauth_tokens
for each row execute function public.set_updated_at();

-- Schema cache: sheet metadata + headers
create table public.schema_cache (
  id                uuid primary key default gen_random_uuid(),
  spreadsheet_id    text not null,
  sheet_name        text not null,
  fingerprint       jsonb not null,
  headers           jsonb,
  row_count         integer,
  col_count         integer,
  cached_at         timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '1 hour'),
  unique (spreadsheet_id, sheet_name)
);
