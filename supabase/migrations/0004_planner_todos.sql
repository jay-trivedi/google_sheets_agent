-- 0004_planner_todos.sql
-- Planner todo storage for agent task loop

create table if not exists public.planner_todos (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  spreadsheet_id text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','done')),
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_planner_todos_session on public.planner_todos (session_id, order_index);
create index if not exists idx_planner_todos_spreadsheet on public.planner_todos (spreadsheet_id);

drop trigger if exists trg_planner_todos_updated_at on public.planner_todos;
create trigger trg_planner_todos_updated_at
before update on public.planner_todos
for each row execute function public.set_updated_at();

alter table public.planner_todos enable row level security;
-- Access is mediated by edge functions running with the service role, so no
-- additional policies are defined for now.
