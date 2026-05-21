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

export async function supprimerInvestissement(id) {
  const { error } = await supabase.from('investments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
