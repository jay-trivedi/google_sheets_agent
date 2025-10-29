-- 0005_session_sheet_context.sql
-- Persist the latest sheet context snapshot per session + spreadsheet.

create table if not exists public.session_sheet_context (
  session_id text not null,
  spreadsheet_id text not null,
  context_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, spreadsheet_id)
);

create index if not exists idx_session_sheet_context_spreadsheet
  on public.session_sheet_context (spreadsheet_id, session_id);

drop trigger if exists trg_session_sheet_context_updated_at on public.session_sheet_context;
create trigger trg_session_sheet_context_updated_at
before update on public.session_sheet_context
for each row execute function public.set_updated_at();

alter table public.session_sheet_context enable row level security;
-- Access is via service role today; add user policies once clients need direct access.
