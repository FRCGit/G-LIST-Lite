create table if not exists public.lite_tracking (
  user_id uuid not null references auth.users(id) on delete cascade,
  title_id text not null,
  status text not null check (status in ('Unwatched', 'Watching', 'Watched', 'Up Next')),
  lang text not null default '' check (lang in ('', 'Eng', 'Sub', 'Jpn')),
  watched_year text,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

alter table public.lite_tracking
add column if not exists lang text not null default '';

alter table public.lite_tracking
drop constraint if exists lite_tracking_lang_check;

update public.lite_tracking
set lang = case lang
  when 'eng dub' then 'Eng'
  when 'eng sub' then 'Sub'
  when 'jap' then 'Jpn'
  else lang
end
where lang in ('eng dub', 'eng sub', 'jap');

alter table public.lite_tracking
add constraint lite_tracking_lang_check
check (lang in ('', 'Eng', 'Sub', 'Jpn'));

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

create table if not exists public.lite_notepad (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.lite_notepad enable row level security;

drop policy if exists "Users can read own notepad" on public.lite_notepad;
create policy "Users can read own notepad"
on public.lite_notepad for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notepad" on public.lite_notepad;
create policy "Users can insert own notepad"
on public.lite_notepad for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notepad" on public.lite_notepad;
create policy "Users can update own notepad"
on public.lite_notepad for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notepad" on public.lite_notepad;
create policy "Users can delete own notepad"
on public.lite_notepad for delete
using (auth.uid() = user_id);
