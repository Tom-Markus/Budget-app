import { supabase } from './supabase'

export async function chargerInvestissements(userId) {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', userId)
    .order('date_achat', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function ajouterInvestissement(userId, { type, nom, ticker, date_achat, prix_achat, quantite, notes }) {
  if (!nom?.trim()) throw new Error('Le nom est obligatoire.')
  if (!(prix_achat > 0)) throw new Error("Le prix d'achat doit être supérieur à 0.")
  if (!(quantite > 0)) throw new Error('La quantité doit être supérieure à 0.')

  const { error } = await supabase.from('investments').insert({
    user_id: userId,
    type,
    nom: nom.trim(),
    ticker: ticker?.trim() || null,
    date_achat,
    prix_achat,
    quantite,
    notes: notes?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function cloturerInvestissement(id, { date_vente, prix_vente }) {
  if (!(prix_vente > 0)) throw new Error('Le prix de vente doit être supérieur à 0.')

  const { error } = await supabase
    .from('investments')
    .update({ date_vente, prix_vente })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Vente PARTIELLE : vend `quantiteVendue` (< quantité totale) d'une position.
 *   1. Crée une position CLÔTURÉE (mêmes données d'achat, quantité vendue)
 *   2. Réduit la quantité de la position d'origine (qui reste ouverte)
 * Si (2) échoue, la ligne créée en (1) est supprimée (compensation) pour ne
 * pas dupliquer la quantité.
 */
export async function cloturerPartiel(inv, { date_vente, prix_vente, quantiteVendue }) {
  if (!(prix_vente > 0)) throw new Error('Le prix de vente doit être supérieur à 0.')
  if (!(quantiteVendue > 0)) throw new Error('La quantité vendue doit être supérieure à 0.')
  if (quantiteVendue >= inv.quantite) {
    throw new Error('Pour tout vendre, laisse la quantité totale (clôture complète).')
  }

  const { data: vendue, error: e1 } = await supabase
    .from('investments')
    .insert({
      user_id: inv.user_id,
      type: inv.type,
      nom: inv.nom,
      ticker: inv.ticker,
      date_achat: inv.date_achat,
      prix_achat: inv.prix_achat,
      quantite: quantiteVendue,
      date_vente,
      prix_vente,
      notes: inv.notes,
    })
    .select('id')
    .single()
  if (e1) throw new Error(e1.message)

  const reste = inv.quantite - quantiteVendue
  const { error: e2 } = await supabase
    .from('investments')
    .update({ quantite: reste })
    .eq('id', inv.id)
  if (e2) {
    // Compensation : retire la ligne vendue pour ne pas dupliquer la quantité
    await supabase.from('investments').delete().eq('id', vendue.id)
    throw new Error(e2.message)
  }
}

/**
 * Édition d'une position existante (corriger une faute sans supprimer/recréer).
 * Seuls les champs présents dans `patch` sont modifiés.
 */
export async function modifierInvestissement(id, patch) {
  const update = {}
  if (patch.type !== undefined) update.type = patch.type
  if (patch.nom !== undefined) {
    if (!patch.nom?.trim()) throw new Error('Le nom est obligatoire.')
    update.nom = patch.nom.trim()
  }
  if (patch.ticker !== undefined) update.ticker = patch.ticker?.trim() || null
  if (patch.date_achat !== undefined) update.date_achat = patch.date_achat
  if (patch.prix_achat !== undefined) {
    if (!(patch.prix_achat > 0)) throw new Error("Le prix d'achat doit être supérieur à 0.")
    update.prix_achat = patch.prix_achat
  }
  if (patch.quantite !== undefined) {
    if (!(patch.quantite > 0)) throw new Error('La quantité doit être supérieure à 0.')
    update.quantite = patch.quantite
  }
  if (patch.date_vente !== undefined) update.date_vente = patch.date_vente
  if (patch.prix_vente !== undefined) {
    if (patch.prix_vente !== null && !(patch.prix_vente > 0)) {
      throw new Error('Le prix de vente doit être supérieur à 0.')
    }
    update.prix_vente = patch.prix_vente
  }
  // Cohérence vente (le schéma exige les 2 champs ensemble, et vente ≥ achat)
  const dv = update.date_vente
  const da = update.date_achat
  if (dv && da && dv < da) {
    throw new Error("La date de vente ne peut pas être antérieure à la date d'achat.")
  }
  if (Object.keys(update).length === 0) return

  const { error } = await supabase.from('investments').update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function supprimerInvestissement(id) {
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
