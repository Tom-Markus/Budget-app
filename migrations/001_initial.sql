-- ============================================================================
-- Tom's Cabinet — Migration 001 — Schéma initial
-- ============================================================================
-- Crée les 2 tables (envelopes, movements), les contraintes métier,
-- les triggers (updated_at + création auto de Patrimoine à l'inscription),
-- les policies RLS, et active Realtime.
-- ============================================================================

-- Extension nécessaire pour gen_random_uuid().
-- Activée par défaut sur Supabase, on s'assure ici.
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLE envelopes
-- ============================================================================
create table public.envelopes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.envelopes(id) on delete cascade,
  type        text not null check (type in ('total', 'normal', 'creance')),
  title       text not null check (length(trim(title)) > 0),
  description text,
  goal_amount numeric(12, 2),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Description non applicable aux créances
  constraint description_not_on_creance check (
    type != 'creance' or description is null
  ),
  -- Goal amount uniquement sur enveloppes normales
  constraint goal_only_on_normal check (
    type = 'normal' or goal_amount is null
  ),
  -- Goal positif s'il est présent
  constraint goal_positive check (
    goal_amount is null or goal_amount > 0
  ),
  -- Une 'total' n'a pas de parent
  constraint total_has_no_parent check (
    type != 'total' or parent_id is null
  ),
  -- Une 'creance' n'a pas de parent
  constraint creance_has_no_parent check (
    type != 'creance' or parent_id is null
  )
);

-- Un seul Patrimoine ('total') par utilisateur
create unique index envelopes_one_total_per_user
  on public.envelopes(user_id)
  where type = 'total';

-- Index pour les requêtes fréquentes
create index envelopes_user_id_idx on public.envelopes(user_id);
create index envelopes_parent_id_idx on public.envelopes(parent_id);

-- ============================================================================
-- 2. TABLE movements
-- ============================================================================
create table public.movements (
  id                  uuid primary key default gen_random_uuid(),
  envelope_id         uuid not null references public.envelopes(id) on delete cascade,
  amount              numeric(12, 2) not null check (amount > 0),
  type                text not null check (type in (
    'income', 'spend', 'allocate', 'unallocate', 'creance_add', 'creance_repaid'
  )),
  linked_movement_id  uuid references public.movements(id) on delete set null,
  note                text,
  is_undone           boolean not null default false,
  created_at          timestamptz not null default now(),

  -- Note obligatoire pour les mouvements de créance
  constraint note_required_for_creance check (
    type not in ('creance_add', 'creance_repaid')
    or (note is not null and length(trim(note)) > 0)
  )
);

create index movements_envelope_id_idx on public.movements(envelope_id);
create index movements_created_at_idx on public.movements(created_at desc);
create index movements_linked_movement_idx
  on public.movements(linked_movement_id)
  where linked_movement_id is not null;

-- ============================================================================
-- 3. TRIGGER updated_at sur envelopes
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger envelopes_set_updated_at
  before update on public.envelopes
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 4. TRIGGER création auto de "Patrimoine" à l'inscription
-- ============================================================================
-- Quand un nouvel utilisateur s'inscrit (insertion dans auth.users),
-- on crée automatiquement son enveloppe Patrimoine.
-- SECURITY DEFINER = la fonction s'exécute avec les droits de son créateur
-- (postgres), donc elle peut INSERT malgré les policies RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.envelopes (user_id, type, title, position)
  values (new.id, 'total', 'Patrimoine', 0);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- 5. RLS — Row Level Security
-- ============================================================================
-- Sans ces policies, la clé anon publique permettrait à n'importe qui
-- de lire/modifier les données de tout le monde. AVEC ces policies, chaque
-- utilisateur ne voit/modifie QUE ses propres données.
alter table public.envelopes enable row level security;
alter table public.movements enable row level security;

-- envelopes : chaque user gère ses enveloppes, mais ne peut pas supprimer Patrimoine
create policy "envelopes_select_own" on public.envelopes
  for select using (auth.uid() = user_id);

create policy "envelopes_insert_own" on public.envelopes
  for insert with check (auth.uid() = user_id);

create policy "envelopes_update_own" on public.envelopes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "envelopes_delete_own" on public.envelopes
  for delete using (auth.uid() = user_id and type != 'total');

-- movements : accès indirect via la propriété de l'enveloppe parente
create policy "movements_select_own" on public.movements
  for select using (
    exists (
      select 1 from public.envelopes e
      where e.id = movements.envelope_id and e.user_id = auth.uid()
    )
  );

create policy "movements_insert_own" on public.movements
  for insert with check (
    exists (
      select 1 from public.envelopes e
      where e.id = movements.envelope_id and e.user_id = auth.uid()
    )
  );

create policy "movements_update_own" on public.movements
  for update using (
    exists (
      select 1 from public.envelopes e
      where e.id = movements.envelope_id and e.user_id = auth.uid()
    )
  );

create policy "movements_delete_own" on public.movements
  for delete using (
    exists (
      select 1 from public.envelopes e
      where e.id = movements.envelope_id and e.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. REALTIME — activation pour la sync temps réel entre appareils
-- ============================================================================
-- Si ces 2 lignes échouent, désactive-les et active Realtime manuellement
-- via : Dashboard → Database → Replication → supabase_realtime → cocher
-- les 2 tables.
alter publication supabase_realtime add table public.envelopes;
alter publication supabase_realtime add table public.movements;