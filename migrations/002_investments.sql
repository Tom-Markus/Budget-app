-- ============================================================================
-- Tom's Cabinet — Migration 002 — Table investments
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLE investments
-- ============================================================================
create table public.investments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('action', 'etf', 'crypto', 'or')),
  nom         text not null check (length(trim(nom)) > 0),
  ticker      text,
  date_achat  date not null,
  prix_achat  numeric(20, 8) not null check (prix_achat > 0),
  quantite    numeric(20, 8) not null check (quantite > 0),
  date_vente  date,
  prix_vente  numeric(20, 8) check (prix_vente > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Vente = les 2 champs renseignés ou aucun
  constraint vente_complete check (
    (date_vente is null and prix_vente is null)
    or (date_vente is not null and prix_vente is not null)
  )
);

create index investments_user_id_idx on public.investments(user_id);
create index investments_date_achat_idx on public.investments(date_achat desc);

-- ============================================================================
-- 2. TRIGGER updated_at (réutilise la fonction définie en migration 001)
-- ============================================================================
create trigger investments_set_updated_at
  before update on public.investments
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 3. RLS
-- ============================================================================
alter table public.investments enable row level security;

create policy "investments_select_own" on public.investments
  for select using (auth.uid() = user_id);

create policy "investments_insert_own" on public.investments
  for insert with check (auth.uid() = user_id);

create policy "investments_update_own" on public.investments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "investments_delete_own" on public.investments
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- 4. REALTIME
-- ============================================================================
alter publication supabase_realtime add table public.investments;
