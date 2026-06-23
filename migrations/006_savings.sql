-- ============================================================================
-- Tom's Cabinet — Migration 006 — Comptes épargne (enveloppes indépendantes)
-- ============================================================================
-- Ajoute un nouveau type d'enveloppe 'savings' (compte épargne) totalement
-- indépendant du Patrimoine et du reste de l'app : il ne compte ni dans la
-- répartition, ni dans « à répartir », ni dans la courbe du Patrimoine.
--
-- Deux nouveaux types de mouvements lui sont propres :
--   - 'savings_add'      : versement (l'épargne monte)
--   - 'savings_withdraw' : retrait   (l'épargne baisse)
--
-- Chaque compte épargne peut aussi avoir un versement RÉCURRENT automatique
-- (montant + cadence). Le rattrapage des versements dus est fait côté client
-- au chargement (voir src/lib/mutations.js → executerRecurrencesDues).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Autoriser le type 'savings' sur les enveloppes
-- ----------------------------------------------------------------------------
alter table public.envelopes drop constraint envelopes_type_check;
alter table public.envelopes add constraint envelopes_type_check
  check (type in ('total', 'normal', 'creance', 'savings'));

-- Un compte épargne n'a pas de parent (comme une créance)
alter table public.envelopes add constraint savings_has_no_parent
  check (type != 'savings' or parent_id is null);

-- ----------------------------------------------------------------------------
-- 2. Colonnes de récurrence (uniquement sur les comptes épargne)
-- ----------------------------------------------------------------------------
alter table public.envelopes
  add column recurring_amount   numeric(12, 2),
  add column recurring_interval text,
  add column recurring_last_run timestamptz;

-- Cadence valide si présente
alter table public.envelopes add constraint recurring_interval_valid
  check (
    recurring_interval is null
    or recurring_interval in ('daily', 'weekly', 'monthly', 'yearly')
  );

-- Montant récurrent strictement positif s'il est présent
alter table public.envelopes add constraint recurring_amount_positive
  check (recurring_amount is null or recurring_amount > 0);

-- Récurrence réservée aux comptes épargne
alter table public.envelopes add constraint recurring_only_on_savings
  check (
    type = 'savings'
    or (recurring_amount is null
        and recurring_interval is null
        and recurring_last_run is null)
  );

-- ----------------------------------------------------------------------------
-- 3. Autoriser les mouvements d'épargne
-- ----------------------------------------------------------------------------
alter table public.movements drop constraint movements_type_check;
alter table public.movements add constraint movements_type_check
  check (type in (
    'income', 'spend', 'allocate', 'unallocate',
    'creance_add', 'creance_repaid',
    'savings_add', 'savings_withdraw'
  ));
