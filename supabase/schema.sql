create table if not exists public.lite_tracking (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null,
  status text not null check (status in ('Unwatched', 'Watching', 'Watched', 'Up Next')),
  watched_year text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

alter table public.lite_tracking enable row level security;

drop policy if exists "Users can read own tracking" on public.lite_tracking;
create policy "Users can read own tracking"
on public.lite_tracking for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own tracking" on public.lite_tracking;
create policy "Users can insert own tracking"
on public.lite_tracking for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own tracking" on public.lite_tracking;
create policy "Users can update own tracking"
on public.lite_tracking for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tracking" on public.lite_tracking;
create policy "Users can delete own tracking"
on public.lite_tracking for delete
using (auth.uid() = user_id);
