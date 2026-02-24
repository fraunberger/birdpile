-- Birdpile Supabase Bootstrap (Lean)
-- Scope:
-- 1) Election app storage (required)
-- 2) Bird log read tables (optional, for non-social bird logs)
--
-- This intentionally excludes the full social app schema.

begin;

create extension if not exists pgcrypto;

-- =============================
-- Election app table (required)
-- =============================

create table if not exists public.elections (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_elections_updated_at on public.elections(updated_at desc);

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
-- Bird log tables (optional)
-- =============================
-- These support read-only bird log pages that query social-style items.
-- Keep minimal: status + item only.

create table if not exists public.social_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  content text not null default '',
  date date,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

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

-- =============================
-- RLS + policies
-- =============================

alter table public.elections enable row level security;
alter table public.social_statuses enable row level security;
alter table public.social_items enable row level security;

-- Election app: open read/write via app API.
drop policy if exists "public read elections" on public.elections;
create policy "public read elections" on public.elections for select using (true);

drop policy if exists "public insert elections" on public.elections;
create policy "public insert elections" on public.elections for insert with check (true);

drop policy if exists "public update elections" on public.elections;
create policy "public update elections" on public.elections for update using (true) with check (true);

drop policy if exists "public delete elections" on public.elections;
create policy "public delete elections" on public.elections for delete using (true);

-- Bird logs: public read only.
drop policy if exists "public read statuses" on public.social_statuses;
create policy "public read statuses" on public.social_statuses for select using (true);

drop policy if exists "public read items" on public.social_items;
create policy "public read items" on public.social_items for select using (true);

-- Grants for PostgREST roles.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.elections to anon, authenticated;
grant select on public.social_statuses, public.social_items to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

commit;
