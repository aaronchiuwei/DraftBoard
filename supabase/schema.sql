-- Draft Room cloud storage.
--
-- Run once in the Supabase SQL editor. Re-running it is safe.
--
-- One row per account holding the same JSON payload the app writes to
-- localStorage. The draft is a small document that is only ever read and
-- written whole, so there is nothing to gain from modelling it as columns —
-- and a schema change would then need a migration on a device that might be
-- offline for a week.

create table if not exists public.draft_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.draft_states enable row level security;

-- The anon key ships in the client bundle, so these policies are the only
-- thing standing between one user's draft and everybody else's.
drop policy if exists "Read own draft" on public.draft_states;
create policy "Read own draft" on public.draft_states
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own draft" on public.draft_states;
create policy "Insert own draft" on public.draft_states
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own draft" on public.draft_states;
create policy "Update own draft" on public.draft_states
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own draft" on public.draft_states;
create policy "Delete own draft" on public.draft_states
  for delete using (auth.uid() = user_id);
