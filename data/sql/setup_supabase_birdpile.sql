-- Birdpile Supabase Bootstrap
-- Run this once in Supabase SQL Editor for a fresh project.

begin;

create extension if not exists pgcrypto;

-- =============================
-- Core profile/linking tables
-- =============================

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  categories text[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public', 'accounts', 'private')),
  is_private boolean not null default false,
  muted_users text[] not null default '{}',
  category_configs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.clerk_user_links (
  clerk_user_id text primary key,
  supabase_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =============================
-- Social tables
-- =============================

create table if not exists public.social_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  date date not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  delete_reason text
);

create unique index if not exists idx_social_statuses_user_date_unique
  on public.social_statuses(user_id, date);
create index if not exists idx_social_statuses_created_at on public.social_statuses(created_at desc);
create index if not exists idx_social_statuses_user_id on public.social_statuses(user_id);

create table if not exists public.social_items (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.social_statuses(id) on delete cascade,
  category text not null,
  title text not null,
  subtitle text,
  rating numeric,
  notes text,
  image text,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_items_status_id on public.social_items(status_id);
create index if not exists idx_social_items_category_title on public.social_items(category, title);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.social_statuses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  delete_reason text
);

create index if not exists idx_social_comments_status_id on public.social_comments(status_id);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('status', 'comment')),
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_reports_created_at on public.social_reports(created_at desc);

-- =============================
-- Follows + habits
-- =============================

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists idx_follows_follower_id on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);

create table if not exists public.user_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_habits_user_id on public.user_habits(user_id);

create table if not exists public.habit_logs (
  habit_id uuid not null references public.user_habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (habit_id, date)
);

create index if not exists idx_habit_logs_user_id_date on public.habit_logs(user_id, date desc);

-- =============================
-- Election app table
-- =============================

create table if not exists public.elections (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_elections_updated_at on public.elections(updated_at desc);

-- Keep updated_at fresh on update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists elections_set_updated_at on public.elections;
create trigger elections_set_updated_at
before update on public.elections
for each row execute function public.set_updated_at();

-- =============================
-- RLS + policies
-- =============================

alter table public.user_profiles enable row level security;
alter table public.clerk_user_links enable row level security;
alter table public.social_statuses enable row level security;
alter table public.social_items enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_reports enable row level security;
alter table public.follows enable row level security;
alter table public.user_habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.elections enable row level security;

-- Public read policies (app reads with anon key).
drop policy if exists "public read user_profiles" on public.user_profiles;
create policy "public read user_profiles" on public.user_profiles for select using (true);

drop policy if exists "public read statuses" on public.social_statuses;
create policy "public read statuses" on public.social_statuses for select using (true);

drop policy if exists "public read items" on public.social_items;
create policy "public read items" on public.social_items for select using (true);

drop policy if exists "public read comments" on public.social_comments;
create policy "public read comments" on public.social_comments for select using (true);

drop policy if exists "public read follows" on public.follows;
create policy "public read follows" on public.follows for select using (true);

drop policy if exists "public read user_habits" on public.user_habits;
create policy "public read user_habits" on public.user_habits for select using (true);

drop policy if exists "public read habit_logs" on public.habit_logs;
create policy "public read habit_logs" on public.habit_logs for select using (true);

-- Reports: anyone signed-in can file reports.
drop policy if exists "insert reports authenticated" on public.social_reports;
create policy "insert reports authenticated" on public.social_reports
for insert
with check (auth.uid() is not null);

-- Elections are open to all app users via API route.
drop policy if exists "public read elections" on public.elections;
create policy "public read elections" on public.elections for select using (true);

drop policy if exists "public insert elections" on public.elections;
create policy "public insert elections" on public.elections for insert with check (true);

drop policy if exists "public update elections" on public.elections;
create policy "public update elections" on public.elections for update using (true) with check (true);

drop policy if exists "public delete elections" on public.elections;
create policy "public delete elections" on public.elections for delete using (true);

-- Clerk links: service role only.
drop policy if exists "service role only select clerk links" on public.clerk_user_links;
create policy "service role only select clerk links"
on public.clerk_user_links
for select
using (auth.role() = 'service_role');

drop policy if exists "service role only write clerk links" on public.clerk_user_links;
create policy "service role only write clerk links"
on public.clerk_user_links
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- Explicit grants for PostgREST roles.
grant usage on schema public to anon, authenticated;
grant select on public.user_profiles, public.social_statuses, public.social_items, public.social_comments, public.follows, public.user_habits, public.habit_logs to anon, authenticated;
grant select, insert, update, delete on public.elections to anon, authenticated;
grant insert on public.social_reports to anon, authenticated;

grant all on public.clerk_user_links to service_role;
grant all on public.social_reports to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

commit;
