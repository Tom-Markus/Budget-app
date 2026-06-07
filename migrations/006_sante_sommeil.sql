-- ============================================================================
-- Migration 006 — Santé & Body : suivi du sommeil
-- ============================================================================

create table public.sante_sommeil (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  heure_couche   time not null,
  heure_lever    time not null,
  duree_minutes  int  not null check (duree_minutes > 0 and duree_minutes <= 1440),
  created_at     timestamptz not null default now()
);

create index sante_sommeil_user_id_idx on public.sante_sommeil(user_id);
create index sante_sommeil_date_idx    on public.sante_sommeil(user_id, date desc);

alter table public.sante_sommeil enable row level security;

create policy "sante_sommeil_select_own" on public.sante_sommeil
  for select using (auth.uid() = user_id);

create policy "sante_sommeil_insert_own" on public.sante_sommeil
  for insert with check (auth.uid() = user_id);

create policy "sante_sommeil_delete_own" on public.sante_sommeil
  for delete using (auth.uid() = user_id);
