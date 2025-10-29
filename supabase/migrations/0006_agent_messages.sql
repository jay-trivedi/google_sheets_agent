-- 0006_agent_messages.sql
-- Persistent chat transcript per session/spreadsheet.

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  spreadsheet_id text not null,
  role text not null check (role in ('user','agent','event')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_messages_session on public.agent_messages (session_id, created_at);
create index if not exists idx_agent_messages_sheet on public.agent_messages (spreadsheet_id, created_at);

alter table public.agent_messages enable row level security;
-- Access is currently mediated by Edge Functions running with the service role.
