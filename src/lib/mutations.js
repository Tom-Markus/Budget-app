/**
 * src/lib/mutations.js
 * ----------------------------------------------------------------------------
 * Fonctions de mutation Supabase. Chacune est stateless : elle prend ses
 * dépendances en argument et retourne une Promise. Toutes throw une Error
 * lisible en cas d'échec — AppContext attrape et déclenche un toast.
 *
 * Toutes les contraintes métier (note obligatoire sur créances, goal_amount
 * uniquement sur 'normal', un seul Patrimoine, etc.) sont aussi enforcées au
 * niveau Postgres via la migration 001 — donc même si le code client a un
 * bug, la DB refuse les écritures inconsistantes. Belt-and-braces.
 * ============================================================================
 */
import { supabase } from './supabase'

// ===========================================================================
// MOUVEMENTS
// ===========================================================================

/** Income sur Patrimoine (bouton + sur grande enveloppe). */
export async function ajouterIncome(patrimoineId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: patrimoineId,
    amount: montant,
    type: 'income',
    note,
  })
  if (error) throw new Error(error.message)
}

/** Allocate de "à répartir" vers une enveloppe normale feuille. */
export async function allouer(envId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'allocate',
    note,
  })
  if (error) throw new Error(error.message)
}

/** Dépense réelle (sortie de l'enveloppe ET du Patrimoine). */
export async function depenser(envId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'spend',
    note,
  })
  if (error) throw new Error(error.message)
}

/** Désalloue (retourne le montant de l'enveloppe vers "à répartir"). */
export async function desallouer(envId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'unallocate',
    note,
  })
  if (error) throw new Error(error.message)
}

/** Augmente une créance — note OBLIGATOIRE (le pourquoi de la dette). */
export async function ajouterCreance(envId, montant, note) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  if (!note || !note.trim()) throw new Error('Une note est obligatoire sur les créances.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'creance_add',
    note: note.trim(),
  })
  if (error) throw new Error(error.message)
}

/**
 * Remboursement d'une créance — passerelle vers Patrimoine.
 * Crée DEUX mouvements liés par linked_movement_id :
 *   1. income sur Patrimoine (l'argent rentre)
 *   2. creance_repaid sur la créance (la dette baisse), pointant vers (1)
 * Si (2) échoue, (1) reste comme income orphelin. C'est rare (la DB rejette
 * rarement après avoir accepté un INSERT cohérent), et l'utilisateur verra
 * un income inattendu sur Patrimoine qu'il pourra annuler manuellement.
 * Une vraie atomicité demanderait une fonction RPC PostgreSQL (v2).
 */
export async function rembourserCreance(creanceId, patrimoineId, montant, note) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  if (!note || !note.trim()) throw new Error('Une note est obligatoire sur les créances.')
  const cleanNote = note.trim()

  // 1. Crée l'income sur Patrimoine
  const { data: income, error: e1 } = await supabase
    .from('movements')
    .insert({
      envelope_id: patrimoineId,
      amount: montant,
      type: 'income',
      note: `Remboursement créance : ${cleanNote}`,
    })
    .select('id')
    .single()
  if (e1) throw new Error(e1.message)

  // 2. Crée le creance_repaid lié
  const { error: e2 } = await supabase.from('movements').insert({
    envelope_id: creanceId,
    amount: montant,
    type: 'creance_repaid',
    note: cleanNote,
    linked_movement_id: income.id,
  })
  if (e2) {
    // Compensation : on tente de supprimer l'income créé en (1) pour ne pas
    // laisser un revenu orphelin sur le Patrimoine. Best-effort — si la
    // suppression échoue aussi, on le signale dans l'erreur.
    const { error: eComp } = await supabase.from('movements').delete().eq('id', income.id)
    if (eComp) {
      console.error('Income orphelin sur Patrimoine (id ' + income.id + ')')
      throw new Error(
        e2.message + ' (un revenu orphelin est resté sur le Patrimoine — annule-le manuellement)'
      )
    }
    throw new Error(e2.message)
  }
}

/**
 * Annule le dernier mouvement annulable de l'enveloppe.
 *   - Patrimoine ('total') : annule le dernier income.
 *   - Normale ('normal')   : annule le dernier allocate/spend/unallocate.
 *   - Créance ('creance')  : annule le dernier creance_add/creance_repaid.
 *
 * Cascade : un creance_repaid annulé annule l'income lié, et un income lié
 * à un creance_repaid annulé déclenche aussi l'annulation de ce creance_repaid.
 */
export async function annulerDernier(envId) {
  // Récupère le type pour savoir quels mouvements sont annulables
  const { data: env, error: e0 } = await supabase
    .from('envelopes').select('type').eq('id', envId).single()
  if (e0) throw new Error(e0.message)

  const typesAnnulables =
    env.type === 'total'   ? ['income'] :
    env.type === 'creance' ? ['creance_add', 'creance_repaid'] :
    env.type === 'savings' ? ['savings_add', 'savings_withdraw'] :
                             ['allocate', 'spend', 'unallocate']

  const { data: derniers, error: e1 } = await supabase
    .from('movements').select('*')
    .eq('envelope_id', envId)
    .eq('is_undone', false)
    .in('type', typesAnnulables)
    .order('created_at', { ascending: false })
    .limit(1)
  if (e1) throw new Error(e1.message)
  if (!derniers || derniers.length === 0) throw new Error('Rien à annuler.')

  const mv = derniers[0]
  const idsAAnnuler = [mv.id]

  // Cascade descendante : creance_repaid → income lié
  if (mv.type === 'creance_repaid' && mv.linked_movement_id) {
    idsAAnnuler.push(mv.linked_movement_id)
  }
  // Cascade montante : income → creance_repaid qui pointe vers cet income
  if (mv.type === 'income') {
    const { data: pointants, error: e2 } = await supabase
      .from('movements').select('id')
      .eq('linked_movement_id', mv.id)
      .eq('is_undone', false)
    if (e2) throw new Error(e2.message)
    for (const p of pointants) idsAAnnuler.push(p.id)
  }

  // .eq('is_undone', false) rend l'opération idempotente : si un autre
  // appareil vient d'annuler le même mouvement, on ne le « ré-annule » pas.
  const { error: e3 } = await supabase
    .from('movements').update({ is_undone: true })
    .in('id', idsAAnnuler)
    .eq('is_undone', false)
  if (e3) throw new Error(e3.message)
}

// ===========================================================================
// ENVELOPPES — Création
// ===========================================================================

/** Enveloppe normale racine (niveau 2 du brief). */
export async function creerEnveloppeRacine(userId, { title, description = null }) {
  if (!title || !title.trim()) throw new Error('Le titre est obligatoire.')

  // Position = max(position des racines normales) + 1
  const { data: lastPos, error: e0 } = await supabase
    .from('envelopes').select('position')
    .eq('user_id', userId).eq('type', 'normal').is('parent_id', null)
    .order('position', { ascending: false }).limit(1)
  if (e0) throw new Error(e0.message)
  const nextPos = (lastPos[0]?.position ?? -1) + 1

  const { error } = await supabase.from('envelopes').insert({
    user_id: userId,
    parent_id: null,
    type: 'normal',
    title: title.trim(),
    description: description?.trim() || null,
    position: nextPos,
  })
  if (error) throw new Error(error.message)
}

/**
 * Sous-catégorie d'une enveloppe normale (niveau 3).
 * Si la parente avait un solde > 0, on crée un unallocate auto AVANT
 * pour libérer le solde dans "à répartir" (cohérent avec le brief).
 */
export async function creerSousEnveloppe(userId, parentId, soldeParenteActuel,
                                          { title, description = null }) {
  if (!title || !title.trim()) throw new Error('Le titre est obligatoire.')

  if (soldeParenteActuel > 0) {
    const { error: eU } = await supabase.from('movements').insert({
      envelope_id: parentId,
      amount: soldeParenteActuel,
      type: 'unallocate',
      note: 'Vidé automatiquement (transformation en enveloppe parente)',
    })
    if (eU) throw new Error(eU.message)
  }

  const { data: lastPos, error: e0 } = await supabase
    .from('envelopes').select('position')
    .eq('parent_id', parentId)
    .order('position', { ascending: false }).limit(1)
  if (e0) throw new Error(e0.message)
  const nextPos = (lastPos[0]?.position ?? -1) + 1

  const { error } = await supabase.from('envelopes').insert({
    user_id: userId,
    parent_id: parentId,
    type: 'normal',
    title: title.trim(),
    description: description?.trim() || null,
    position: nextPos,
  })
  if (error) throw new Error(error.message)
}

/** Créance — pas de description ni de goal_amount possible (schéma le refuse). */
export async function creerCreance(userId, { title }) {
  if (!title || !title.trim()) throw new Error('Le nom de la personne est obligatoire.')

  const { data: lastPos, error: e0 } = await supabase
    .from('envelopes').select('position')
    .eq('user_id', userId).eq('type', 'creance')
    .order('position', { ascending: false }).limit(1)
  if (e0) throw new Error(e0.message)
  const nextPos = (lastPos[0]?.position ?? -1) + 1

  const { error } = await supabase.from('envelopes').insert({
    user_id: userId,
    parent_id: null,
    type: 'creance',
    title: title.trim(),
    position: nextPos,
  })
  if (error) throw new Error(error.message)
}

/** Compte épargne — enveloppe indépendante (ni parent, ni objectif, ni lien Patrimoine). */
export async function creerEpargne(userId, { title }) {
  if (!title || !title.trim()) throw new Error('Le nom du compte épargne est obligatoire.')

  const { data: lastPos, error: e0 } = await supabase
    .from('envelopes').select('position')
    .eq('user_id', userId).eq('type', 'savings')
    .order('position', { ascending: false }).limit(1)
  if (e0) throw new Error(e0.message)
  const nextPos = (lastPos[0]?.position ?? -1) + 1

  const { error } = await supabase.from('envelopes').insert({
    user_id: userId,
    parent_id: null,
    type: 'savings',
    title: title.trim(),
    position: nextPos,
  })
  if (error) throw new Error(error.message)
}

// ===========================================================================
// MOUVEMENTS — Épargne
// ===========================================================================

/** Versement sur un compte épargne (note facultative). */
export async function ajouterEpargne(envId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'savings_add',
    note: note?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

/** Retrait d'un compte épargne (note facultative). */
export async function retirerEpargne(envId, montant, note = null) {
  if (!(montant > 0)) throw new Error('Le montant doit être supérieur à 0.')
  const { error } = await supabase.from('movements').insert({
    envelope_id: envId,
    amount: montant,
    type: 'savings_withdraw',
    note: note?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

// ===========================================================================
// ÉPARGNE — Récurrence (versement automatique)
// ===========================================================================

const INTERVALLES_VALIDES = ['daily', 'weekly', 'monthly', 'yearly']

/** Avance une date d'un intervalle (gestion calendaire pour mensuel/annuel). */
export function avancerDate(date, interval) {
  const d = new Date(date)
  switch (interval) {
    case 'daily':   d.setDate(d.getDate() + 1); break
    case 'weekly':  d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
    default: throw new Error('Cadence inconnue.')
  }
  return d
}

/**
 * Active / met à jour / désactive la récurrence d'un compte épargne.
 *   - amount > 0 + interval valide → active (le 1er versement auto aura lieu
 *     un intervalle après maintenant ; recurring_last_run = maintenant)
 *   - amount null/0 → désactive (remet les 3 colonnes à null)
 */
export async function definirRecurrenceEpargne(envId, amount, interval) {
  let patch
  if (amount == null || amount === '' || Number(amount) === 0) {
    patch = { recurring_amount: null, recurring_interval: null, recurring_last_run: null }
  } else {
    if (!(Number(amount) > 0)) throw new Error('Le montant récurrent doit être supérieur à 0.')
    if (!INTERVALLES_VALIDES.includes(interval)) throw new Error('Cadence invalide.')
    patch = {
      recurring_amount: Number(amount),
      recurring_interval: interval,
      recurring_last_run: new Date().toISOString(),
    }
  }
  const { error } = await supabase.from('envelopes').update(patch).eq('id', envId)
  if (error) throw new Error(error.message)
}

/**
 * Rattrapage des versements automatiques dus (appelé au chargement).
 * Pour chaque compte épargne avec récurrence active, on insère un
 * 'savings_add' par échéance écoulée depuis recurring_last_run.
 *
 * Anti-doublon multi-appareils : on « réserve » d'abord les échéances en
 * avançant recurring_last_run avec une condition sur son ancienne valeur
 * (verrou optimiste). Si un autre appareil a déjà avancé la valeur, l'UPDATE
 * ne matche aucune ligne et on ne crée RIEN — c'est lui qui gère ces
 * échéances. Seul l'appareil qui a « gagné » le verrou insère les mouvements.
 *
 * @param epargnes Array<enveloppe type 'savings'>
 */
export async function executerRecurrencesDues(epargnes) {
  const now = new Date()
  for (const env of epargnes || []) {
    const montant = Number(env.recurring_amount)
    if (!(montant > 0) || !env.recurring_interval) continue
    const base = env.recurring_last_run
    if (!base) continue

    let prochaine = avancerDate(base, env.recurring_interval)
    const echeances = []
    let garde = 0
    while (prochaine <= now && garde < 1200) {
      echeances.push(new Date(prochaine))
      prochaine = avancerDate(prochaine, env.recurring_interval)
      garde++
    }
    if (echeances.length === 0) continue

    // 1. Verrou optimiste : avance recurring_last_run seulement s'il vaut
    //    encore la valeur qu'on a lue. select() → sait si on a gagné.
    const derniere = echeances[echeances.length - 1]
    const { data: verrou, error: eLock } = await supabase
      .from('envelopes')
      .update({ recurring_last_run: derniere.toISOString() })
      .eq('id', env.id)
      .eq('recurring_last_run', base)
      .select('id')
    if (eLock) throw new Error(eLock.message)
    if (!verrou || verrou.length === 0) continue // un autre appareil s'en occupe

    // 2. On a le verrou : insère les versements dus.
    const rows = echeances.map(d => ({
      envelope_id: env.id,
      amount: montant,
      type: 'savings_add',
      note: 'Versement automatique',
      created_at: d.toISOString(),
    }))
    const { error } = await supabase.from('movements').insert(rows)
    if (error) throw new Error(error.message)
  }
}

// ===========================================================================
// ENVELOPPES — Édition
// ===========================================================================

/** Update sélectif (laisse undefined les champs qu'on ne touche pas). */
export async function modifierEnveloppe(envId, { title, description, goal_amount }) {
  const update = {}
  if (title !== undefined) {
    if (!title || !title.trim()) throw new Error('Le titre ne peut pas être vide.')
    update.title = title.trim()
  }
  if (description !== undefined) {
    update.description = description?.trim() || null
  }
  if (goal_amount !== undefined) {
    if (goal_amount !== null && !(goal_amount > 0)) {
      throw new Error("L'objectif doit être supérieur à 0.")
    }
    update.goal_amount = goal_amount
  }
  if (Object.keys(update).length === 0) return

  const { error } = await supabase.from('envelopes').update(update).eq('id', envId)
  if (error) throw new Error(error.message)
}

// ===========================================================================
// MOUVEMENTS — Édition
// ===========================================================================

/** Modifie la note d'un mouvement existant (historique). */
export async function modifierNoteMouvement(mouvementId, note) {
  const { error } = await supabase
    .from('movements')
    .update({ note: note?.trim() || null })
    .eq('id', mouvementId)
  if (error) throw new Error(error.message)
}

// ===========================================================================
// ENVELOPPES — Suppression (4 scénarios du brief)
// ===========================================================================

/**
 * Supprime une enveloppe selon son contexte.
 *
 * @param env                 L'enveloppe (objet complet) à supprimer
 * @param soldeActuel         Son solde courant (calculé côté client)
 * @param aDesEnfants         true si elle a au moins un enfant direct
 * @param patrimoineId        L'id de Patrimoine (utilisé pour cas créance)
 * @param modeAvecEnfants     'cascade' | 'promote' (ignoré si pas d'enfants)
 *
 * Voir le commentaire du préambule du Bloc E sur l'effet "Patrimoine remonte
 * des spends supprimés" en mode cascade — c'est l'option A choisie au Bloc B.
 */
export async function supprimerEnveloppe(env, soldeActuel, aDesEnfants,
                                          patrimoineId, modeAvecEnfants = 'cascade') {
  if (env.type === 'total') throw new Error('Patrimoine est non supprimable.')

  // --- Cas créance avec solde : crée d'abord un income pour récupérer l'argent
  // Pas la peine de créer le creance_repaid jumeau (il partirait en cascade DELETE)
  if (env.type === 'creance' && soldeActuel > 0) {
    const { error: eI } = await supabase.from('movements').insert({
      envelope_id: patrimoineId,
      amount: soldeActuel,
      type: 'income',
      note: `Remboursement final (suppression de la créance "${env.title}")`,
    })
    if (eI) throw new Error(eI.message)
  }

  // --- Cas enveloppe parente, mode 'promote' : ré-attache les enfants
  if (aDesEnfants && modeAvecEnfants === 'promote') {
    const { error: eP } = await supabase
      .from('envelopes')
      .update({ parent_id: env.parent_id })   // null si la parente était racine
      .eq('parent_id', env.id)
    if (eP) throw new Error(eP.message)
  }

  // --- DELETE final (ON DELETE CASCADE de la migration s'occupe du reste)
  const { error } = await supabase.from('envelopes').delete().eq('id', env.id)
  if (error) throw new Error(error.message)
}

// ===========================================================================
// REMISE À ZÉRO
// ===========================================================================

/**
 * Supprime tous les mouvements + toutes les enveloppes non-patrimoine
 * de l'utilisateur. Le Patrimoine est conservé mais son solde tombe à 0.
 * Après appel, faire window.location.reload().
 */
export async function remettreAZero(userId) {
  // Récupère tous les IDs d'enveloppes de l'utilisateur
  const { data: userEnvs, error: e0 } = await supabase
    .from('envelopes').select('id').eq('user_id', userId)
  if (e0) throw new Error(e0.message)

  const envIds = (userEnvs || []).map(e => e.id)

  // Supprime tous les mouvements
  if (envIds.length > 0) {
    const { error: e1 } = await supabase
      .from('movements').delete().in('envelope_id', envIds)
    if (e1) throw new Error(e1.message)
  }

  // Supprime toutes les enveloppes sauf le Patrimoine (type 'total')
  const { error: e2 } = await supabase
    .from('envelopes').delete()
    .eq('user_id', userId).neq('type', 'total')
  if (e2) throw new Error(
    'Les mouvements ont été supprimés mais les enveloppes n\'ont pas pu l\'être. ' +
    'Recharge la page et réessaie. (' + e2.message + ')'
  )
}

// ===========================================================================
// ENVELOPPES — Réorganisation (drag & drop)
// ===========================================================================

/**
 * Met à jour les positions d'un lot d'enveloppes.
 * Une requête UPDATE par enveloppe (rapide pour ≤ 100 enveloppes).
 * @param updates  Array<{ id: string, position: number }>
 */
export async function reordonnerPositions(updates) {
  const results = await Promise.all(
    updates.map(u =>
      supabase.from('envelopes').update({ position: u.position }).eq('id', u.id)
    )
  )
  const enErreur = results.find(r => r.error)
  if (enErreur) throw new Error(enErreur.error.message)
}