-- ============================================================================
-- Migration 004 — Personnalisations d'exercices sport (sync multi-appareils)
-- ============================================================================
-- Remplace localStorage 'sport_custom_exos' par une table Supabase
-- pour synchroniser les titres/notes/descriptions custom entre appareils.
-- ============================================================================

create table public.sport_custom_exos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nom        text not null,
  changes    jsonb not null default '{}',
  updated_at timestamptz not null default now(),

  constraint sport_custom_exos_user_nom_unique unique (user_id, nom)
);

create index sport_custom_exos_user_id_idx on public.sport_custom_exos(user_id);

create trigger sport_custom_exos_set_updated_at
  before update on public.sport_custom_exos
  for each row
  execute function public.set_updated_at();

alter table public.sport_custom_exos enable row level security;

create policy "sport_custom_exos_select_own" on public.sport_custom_exos
  for select using (auth.uid() = user_id);

create policy "sport_custom_exos_insert_own" on public.sport_custom_exos
  for insert with check (auth.uid() = user_id);

create policy "sport_custom_exos_update_own" on public.sport_custom_exos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sport_custom_exos_delete_own" on public.sport_custom_exos
  for delete using (auth.uid() = user_id);
