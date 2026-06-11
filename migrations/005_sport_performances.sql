-- ============================================================================
-- Migration 005 — Table sport_performances avec RLS
-- ============================================================================
-- Enregistre les performances (PR et séries) par exercice et par utilisateur.
-- RLS activée : chaque utilisateur ne voit et ne modifie que ses propres données.
-- ============================================================================

create table public.sport_performances (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  type          text not null check (type in ('pr', 'serie')),
  poids         numeric(6, 2) not null check (poids > 0),
  reps          integer not null check (reps > 0),
  series        integer check (series > 0),
  date          date not null,
  created_at    timestamptz not null default now()
);

create index sport_performances_user_exercise_idx
  on public.sport_performances(user_id, exercise_name);

create index sport_performances_date_idx
  on public.sport_performances(date desc);

alter table public.sport_performances enable row level security;

create policy "sport_performances_select_own" on public.sport_performances
  for select using (auth.uid() = user_id);

create policy "sport_performances_insert_own" on public.sport_performances
  for insert with check (auth.uid() = user_id);

create policy "sport_performances_update_own" on public.sport_performances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sport_performances_delete_own" on public.sport_performances
  for delete using (auth.uid() = user_id);
