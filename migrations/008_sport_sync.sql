-- ============================================================================
-- Tom's Cabinet — Migration 008 — Sport : coches synchronisées + exercices perso
-- ============================================================================
-- À appliquer manuellement dans Supabase (SQL Editor), comme les précédentes.
--
-- 1. sport_checks : l'état des cases cochées de la semaine, une ligne par
--    utilisateur (jsonb { jourId: { nomExo: true } }) — remplace le
--    localStorage seul, pour retrouver ses coches sur tous les appareils.
--    updated_at sert d'arbitre : la version la plus récente gagne.
--
-- 2. sport_extra_exos : exercices AJOUTÉS par l'utilisateur à une séance
--    (le programme de base reste dans le code ; les modifications des
--    exercices existants restent dans sport_custom_exos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coches de séance
-- ----------------------------------------------------------------------------
create table public.sport_checks (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger sport_checks_set_updated_at
  before update on public.sport_checks
  for each row
  execute function public.set_updated_at();

alter table public.sport_checks enable row level security;

create policy "sport_checks_select_own" on public.sport_checks
  for select using (auth.uid() = user_id);
create policy "sport_checks_insert_own" on public.sport_checks
  for insert with check (auth.uid() = user_id);
create policy "sport_checks_update_own" on public.sport_checks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sport_checks_delete_own" on public.sport_checks
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Exercices ajoutés par l'utilisateur
-- ----------------------------------------------------------------------------
create table public.sport_extra_exos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  session     text not null check (session in ('push', 'pull', 'legs', 'home')),
  nom         text not null check (length(trim(nom)) > 0),
  series      text,
  notes       text,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index sport_extra_exos_user_idx on public.sport_extra_exos(user_id, session);

alter table public.sport_extra_exos enable row level security;

create policy "sport_extra_exos_select_own" on public.sport_extra_exos
  for select using (auth.uid() = user_id);
create policy "sport_extra_exos_insert_own" on public.sport_extra_exos
  for insert with check (auth.uid() = user_id);
create policy "sport_extra_exos_update_own" on public.sport_extra_exos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sport_extra_exos_delete_own" on public.sport_extra_exos
  for delete using (auth.uid() = user_id);
