-- ============================================================================
-- Migration 005 — RLS sur sport_performances (table déjà existante)
-- ============================================================================
-- La table existe déjà (créée manuellement). On active RLS et on ajoute
-- les policies de sécurité. Idempotent : safe à rejouer.
-- ============================================================================

-- Index utiles (IF NOT EXISTS = safe si déjà présents)
create index if not exists sport_performances_user_exercise_idx
  on public.sport_performances(user_id, exercise_name);

create index if not exists sport_performances_date_idx
  on public.sport_performances(date desc);

-- Active RLS (idempotent)
alter table public.sport_performances enable row level security;

-- Supprime les policies existantes si elles existent, puis recrée
drop policy if exists "sport_performances_select_own" on public.sport_performances;
drop policy if exists "sport_performances_insert_own" on public.sport_performances;
drop policy if exists "sport_performances_update_own" on public.sport_performances;
drop policy if exists "sport_performances_delete_own" on public.sport_performances;

create policy "sport_performances_select_own" on public.sport_performances
  for select using (auth.uid() = user_id);

create policy "sport_performances_insert_own" on public.sport_performances
  for insert with check (auth.uid() = user_id);

create policy "sport_performances_update_own" on public.sport_performances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sport_performances_delete_own" on public.sport_performances
  for delete using (auth.uid() = user_id);
