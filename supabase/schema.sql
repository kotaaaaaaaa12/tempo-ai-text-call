create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  ai_name text not null default 'Nova' check (char_length(ai_name) between 1 and 40),
  tone text not null default 'casual' check (tone in ('casual', 'thoughtful', 'direct')),
  reply_length text not null default 'short' check (reply_length in ('short', 'balanced', 'detailed')),
  memory text not null default '' check (char_length(memory) <= 500),
  theme text not null default 'auto' check (theme in ('auto', 'light', 'dark')),
  language text not null default 'auto' check (language in ('auto', 'en', 'ja')),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists language text not null default 'auto';

alter table public.profiles
drop constraint if exists profiles_language_check;

alter table public.profiles
add constraint profiles_language_check check (language in ('auto', 'en', 'ja'));

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);
