-- ============================================================================
-- Migration 005 — Santé & Body : suivi du poids corporel
-- ============================================================================

create table public.sante_poids (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  poids      numeric(5, 2) not null check (poids > 0 and poids < 500),
  date       date not null,
  created_at timestamptz not null default now()
);

create index sante_poids_user_id_idx on public.sante_poids(user_id);
create index sante_poids_date_idx    on public.sante_poids(user_id, date desc);

alter table public.sante_poids enable row level security;

create policy "sante_poids_select_own" on public.sante_poids
  for select using (auth.uid() = user_id);

create policy "sante_poids_insert_own" on public.sante_poids
  for insert with check (auth.uid() = user_id);

create policy "sante_poids_delete_own" on public.sante_poids
  for delete using (auth.uid() = user_id);
