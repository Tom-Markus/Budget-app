-- ============================================================================
-- Tom's Cabinet — Migration 007 — Durcissement de l'intégrité des données
-- ============================================================================
-- À appliquer manuellement dans Supabase (SQL Editor), comme les précédentes.
-- Idempotent : safe à rejouer.
--
-- Corrige trois trous d'intégrité relevés à l'audit :
--   1. parent_id pouvait former un CYCLE (enveloppe parente d'elle-même via
--      UPDATE) → boucle infinie côté client. On borne aussi la profondeur.
--   2. Le TYPE d'un mouvement n'était pas contraint au type de son enveloppe
--      (rien n'empêchait un 'income' sur une enveloppe normale via l'API REST).
--   3. linked_movement_id et parent_id pouvaient référencer des lignes d'un
--      AUTRE utilisateur (la RLS ne vérifie que la ligne insérée).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Anti-cycle + profondeur max + parent du même utilisateur et de type normal
-- ----------------------------------------------------------------------------
create or replace function public.check_envelope_parent()
returns trigger
language plpgsql
as $$
declare
  cur_id uuid;
  cur_parent uuid;
  parent_user uuid;
  parent_type text;
  depth int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Une enveloppe ne peut pas être son propre parent.';
  end if;

  select user_id, type into parent_user, parent_type
    from public.envelopes where id = new.parent_id;
  if parent_user is null then
    raise exception 'Enveloppe parente introuvable.';
  end if;
  if parent_user != new.user_id then
    raise exception 'L''enveloppe parente appartient à un autre utilisateur.';
  end if;
  if parent_type != 'normal' then
    raise exception 'Seule une enveloppe normale peut être parente.';
  end if;

  -- Remonte la chaîne des parents : détecte cycle et profondeur excessive
  cur_id := new.parent_id;
  while cur_id is not null loop
    if cur_id = new.id then
      raise exception 'Cycle de parenté détecté.';
    end if;
    depth := depth + 1;
    if depth > 10 then
      raise exception 'Hiérarchie d''enveloppes trop profonde.';
    end if;
    select parent_id into cur_parent from public.envelopes where id = cur_id;
    cur_id := cur_parent;
  end loop;

  return new;
end;
$$;

drop trigger if exists envelopes_check_parent on public.envelopes;
create trigger envelopes_check_parent
  before insert or update of parent_id on public.envelopes
  for each row
  execute function public.check_envelope_parent();

-- ----------------------------------------------------------------------------
-- 2. Le type de mouvement doit correspondre au type de l'enveloppe
--    + le mouvement lié doit appartenir au même utilisateur
-- ----------------------------------------------------------------------------
create or replace function public.check_movement_consistency()
returns trigger
language plpgsql
as $$
declare
  env_type text;
  env_user uuid;
  linked_user uuid;
begin
  select e.type, e.user_id into env_type, env_user
    from public.envelopes e where e.id = new.envelope_id;
  if env_type is null then
    raise exception 'Enveloppe introuvable.';
  end if;

  if (env_type = 'total'   and new.type not in ('income'))
  or (env_type = 'normal'  and new.type not in ('allocate', 'spend', 'unallocate'))
  or (env_type = 'creance' and new.type not in ('creance_add', 'creance_repaid'))
  or (env_type = 'savings' and new.type not in ('savings_add', 'savings_withdraw'))
  then
    raise exception 'Type de mouvement % invalide pour une enveloppe %.', new.type, env_type;
  end if;

  if new.linked_movement_id is not null then
    select e.user_id into linked_user
      from public.movements m
      join public.envelopes e on e.id = m.envelope_id
      where m.id = new.linked_movement_id;
    if linked_user is null or linked_user != env_user then
      raise exception 'Le mouvement lié n''appartient pas au même utilisateur.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists movements_check_consistency on public.movements;
create trigger movements_check_consistency
  before insert or update of type, envelope_id, linked_movement_id on public.movements
  for each row
  execute function public.check_movement_consistency();
