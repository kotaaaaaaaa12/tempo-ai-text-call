create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  ai_name text not null default 'Nova' check (char_length(ai_name) between 1 and 40),
  tone text not null default 'casual' check (tone in ('casual', 'thoughtful', 'direct')),
  reply_length text not null default 'short' check (reply_length in ('short', 'balanced', 'detailed')),
  memory text not null default '' check (char_length(memory) <= 500),
  personalization text not null default '' check (char_length(personalization) <= 1000),
  theme text not null default 'auto' check (theme in ('auto', 'light', 'dark')),
  accent text not null default 'default' check (accent in ('default', 'coral', 'blue', 'violet', 'green')),
  font_size text not null default 'standard' check (font_size in ('small', 'standard', 'large')),
  motion text not null default 'auto' check (motion in ('auto', 'full', 'reduced', 'none')),
  language text not null default 'auto' check (language in ('auto', 'en', 'ja')),
  send_delay text not null default 'normal' check (send_delay in ('fast', 'normal', 'slow', 'manual')),
  conversation_mode text not null default 'general' check (conversation_mode in ('general', 'study', 'english', 'brainstorm', 'advice', 'custom')),
  custom_mode_prompt text not null default '' check (char_length(custom_mode_prompt) <= 500),
  save_history boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists language text not null default 'auto';

alter table public.profiles
drop constraint if exists profiles_language_check;

alter table public.profiles
add constraint profiles_language_check check (language in ('auto', 'en', 'ja'));

alter table public.profiles
add column if not exists accent text not null default 'default',
add column if not exists font_size text not null default 'standard',
add column if not exists motion text not null default 'auto';

alter table public.profiles
drop constraint if exists profiles_accent_check,
drop constraint if exists profiles_font_size_check,
drop constraint if exists profiles_motion_check;

alter table public.profiles
add constraint profiles_accent_check check (accent in ('default', 'coral', 'blue', 'violet', 'green')),
add constraint profiles_font_size_check check (font_size in ('small', 'standard', 'large')),
add constraint profiles_motion_check check (motion in ('auto', 'full', 'reduced', 'none'));

alter table public.profiles
add column if not exists send_delay text not null default 'normal',
add column if not exists conversation_mode text not null default 'general',
add column if not exists custom_mode_prompt text not null default '',
add column if not exists save_history boolean not null default false;

alter table public.profiles
add column if not exists personalization text not null default '';

alter table public.profiles
drop constraint if exists profiles_send_delay_check,
drop constraint if exists profiles_conversation_mode_check,
drop constraint if exists profiles_custom_mode_prompt_check,
drop constraint if exists profiles_personalization_check;

alter table public.profiles
add constraint profiles_send_delay_check check (send_delay in ('fast', 'normal', 'slow', 'manual')),
add constraint profiles_conversation_mode_check check (conversation_mode in ('general', 'study', 'english', 'brainstorm', 'advice', 'custom')),
add constraint profiles_custom_mode_prompt_check check (char_length(custom_mode_prompt) <= 500),
add constraint profiles_personalization_check check (char_length(personalization) <= 1000);

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

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  messages jsonb not null check (jsonb_typeof(messages) = 'array' and pg_column_size(messages) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

revoke all on table public.conversations from anon;
grant select, insert, update, delete on table public.conversations to authenticated;

drop policy if exists "Users can read their own conversations" on public.conversations;
create policy "Users can read their own conversations"
on public.conversations for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own conversations" on public.conversations;
create policy "Users can create their own conversations"
on public.conversations for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
on public.conversations for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
on public.conversations for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.delete_current_user()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_current_user() from public;
revoke all on function public.delete_current_user() from anon;
grant execute on function public.delete_current_user() to authenticated;
