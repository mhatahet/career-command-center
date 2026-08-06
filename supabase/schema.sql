-- Career Command Center — Supabase schema
-- ============================================================================
-- Run this once in your Supabase project's SQL editor (Dashboard → SQL Editor
-- → New query → paste → Run). It creates one table with one row per current
-- data/*.json file, and locks it down so only a signed-in, authenticated
-- request can read or write it.
--
-- This app is single-user, so the policies below grant any authenticated
-- session full access rather than scoping by a per-row user_id column. Do not
-- point a shared/public Supabase project at this schema without adding a
-- user_id column and narrowing the policies to `auth.uid() = user_id` first.
-- ============================================================================

create table if not exists public.data_files (
  name       text primary key,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.data_files is
  'One row per Career Command Center collection (profile, skills, roadmap, ...). Mirrors the DATA_FILES keys in src/lib/types.ts.';

alter table public.data_files enable row level security;

-- Drop-and-recreate so this script is safe to re-run.
drop policy if exists "authenticated read"   on public.data_files;
drop policy if exists "authenticated insert" on public.data_files;
drop policy if exists "authenticated update" on public.data_files;

create policy "authenticated read"
  on public.data_files for select
  to authenticated
  using (true);

create policy "authenticated insert"
  on public.data_files for insert
  to authenticated
  with check (true);

create policy "authenticated update"
  on public.data_files for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy: the app only ever reads and upserts. Rows are removed, if
-- ever, by hand in the dashboard.
