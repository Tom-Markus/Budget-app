/**
 * src/lib/importJson.js
 * ----------------------------------------------------------------------------
 * Lecture, validation et réimport d'un fichier JSON de sauvegarde.
 *
 * Stratégie (décision arrêtée) : DELETE total puis réinsertion avec les
 * UUIDs d'origine conservés. Le user_id est RÉÉCRIT avec l'utilisateur
 * courant (permet de restaurer même sur un autre compte).
 *
 * La validation se fait AVANT toute écriture : un fichier invalide ne
 * détruit jamais les données existantes.
 * ----------------------------------------------------------------------------
 */
import { supabase } from './supabase'

/** Lit un objet File et retourne le JSON parsé. */
export function lireFichierJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result))
      } catch {
        reject(new Error("Fichier illisible : ce n'est pas un JSON valide."))
      }
    }
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'))
    reader.readAsText(file)
  })
}

/**
 * Valide la structure ET toutes les contraintes que la base impose.
 * Throw une erreur explicite si invalide.
 *
 * IMPORTANT : cette validation doit rester le miroir exact des contraintes
 * SQL (migrations 001 + 006). appliquerImport() SUPPRIME les données avant
 * de réinsérer : tout fichier qui passerait ici mais serait refusé par la
 * DB détruirait le compte. Ne jamais assouplir sans vérifier le schéma.
 */
export function validerImport(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Fichier vide ou invalide.')
  }
  if (!Array.isArray(data.envelopes) || !Array.isArray(data.movements)) {
    throw new Error("Ce fichier n'a pas le format d'une sauvegarde Tom's Cabinet.")
  }

  const typesEnv = ['total', 'normal', 'creance', 'savings']
  const intervallesValides = ['daily', 'weekly', 'monthly', 'yearly']
  const totaux = data.envelopes.filter(e => e?.type === 'total')
  if (totaux.length !== 1) {
    throw new Error('Le fichier doit contenir exactement un Patrimoine.')
  }

  const parId = new Map()
  for (const e of data.envelopes) {
    if (!e || typeof e.id !== 'string') throw new Error('Une enveloppe a un identifiant invalide.')
    if (parId.has(e.id)) throw new Error(`Identifiant d'enveloppe en double : ${e.id}`)
    parId.set(e.id, e)
    if (!typesEnv.includes(e.type)) throw new Error(`Type d'enveloppe inconnu : ${e?.type}`)
    if (typeof e.title !== 'string' || !e.title.trim()) throw new Error('Une enveloppe a un titre vide.')

    // Parenté : seules les enveloppes normales peuvent avoir un parent
    if (e.parent_id != null && e.type !== 'normal') {
      throw new Error(`« ${e.title} » (${e.type}) ne peut pas avoir de parent.`)
    }
    // Description interdite sur les créances
    if (e.type === 'creance' && e.description != null && String(e.description).trim() !== '') {
      throw new Error(`La créance « ${e.title} » ne peut pas avoir de description.`)
    }
    // Objectif : uniquement sur 'normal' et strictement positif
    if (e.goal_amount != null) {
      if (e.type !== 'normal') throw new Error(`« ${e.title} » : objectif autorisé uniquement sur une enveloppe normale.`)
      if (!(Number(e.goal_amount) > 0)) throw new Error(`« ${e.title} » : l'objectif doit être supérieur à 0.`)
    }
    // Récurrence : uniquement sur 'savings', montant positif, cadence valide
    const aRecurrence = e.recurring_amount != null || e.recurring_interval != null || e.recurring_last_run != null
    if (aRecurrence && e.type !== 'savings') {
      throw new Error(`« ${e.title} » : la récurrence est réservée aux comptes épargne.`)
    }
    if (e.type === 'savings') {
      if (e.recurring_amount != null && !(Number(e.recurring_amount) > 0)) {
        throw new Error(`« ${e.title} » : montant récurrent invalide.`)
      }
      if (e.recurring_interval != null && !intervallesValides.includes(e.recurring_interval)) {
        throw new Error(`« ${e.title} » : cadence de récurrence invalide (${e.recurring_interval}).`)
      }
    }
  }

  // Les parent_id doivent exister dans le fichier et ne pas former de cycle
  for (const e of data.envelopes) {
    if (e.parent_id == null) continue
    if (!parId.has(e.parent_id)) {
      throw new Error(`« ${e.title} » référence une enveloppe parente absente du fichier.`)
    }
    const vus = new Set([e.id])
    let cur = parId.get(e.parent_id)
    while (cur) {
      if (vus.has(cur.id)) throw new Error(`Cycle de parenté détecté autour de « ${e.title} ».`)
      vus.add(cur.id)
      cur = cur.parent_id ? parId.get(cur.parent_id) : null
    }
  }

  const typesMv = ['income', 'spend', 'allocate', 'unallocate', 'creance_add', 'creance_repaid', 'savings_add', 'savings_withdraw']
  // Types de mouvements autorisés par type d'enveloppe (miroir migration 007)
  const typesParEnveloppe = {
    total:   ['income'],
    normal:  ['allocate', 'spend', 'unallocate'],
    creance: ['creance_add', 'creance_repaid'],
    savings: ['savings_add', 'savings_withdraw'],
  }
  const mvIds = new Set()
  for (const m of data.movements) {
    if (!m || typeof m.id !== 'string') throw new Error('Un mouvement a un identifiant invalide.')
    if (mvIds.has(m.id)) throw new Error(`Identifiant de mouvement en double : ${m.id}`)
    mvIds.add(m.id)
    if (!typesMv.includes(m.type)) throw new Error(`Type de mouvement inconnu : ${m?.type}`)
    if (!parId.has(m.envelope_id)) {
      throw new Error('Un mouvement référence une enveloppe absente du fichier.')
    }
    const envDuMv = parId.get(m.envelope_id)
    if (!typesParEnveloppe[envDuMv.type]?.includes(m.type)) {
      throw new Error(`Mouvement « ${m.type} » invalide sur l'enveloppe « ${envDuMv.title} » (${envDuMv.type}).`)
    }
    // Montant strictement positif (contrainte SQL amount > 0)
    if (!(Number(m.amount) > 0)) {
      throw new Error(`Un mouvement a un montant invalide (${m.amount}).`)
    }
    // Note obligatoire sur les mouvements de créance (contrainte SQL)
    if ((m.type === 'creance_add' || m.type === 'creance_repaid')
        && (!m.note || !String(m.note).trim())) {
      throw new Error("Un mouvement de créance du fichier n'a pas de note (obligatoire).")
    }
  }
  return true
}

/** Profondeur d'une enveloppe (0 = racine), avec garde anti-boucle. */
function profondeur(env, parId) {
  let d = 0
  let cur = env
  const vus = new Set()
  while (cur?.parent_id && !vus.has(cur.id)) {
    vus.add(cur.id)
    cur = parId.get(cur.parent_id)
    d++
    if (d > 10) break
  }
  return d
}

/**
 * Remplace TOUTES les données de l'utilisateur par celles du fichier.
 * À n'appeler qu'après validerImport() et confirmation de l'utilisateur.
 */
export async function appliquerImport(data, userId) {
  const totalSauvegarde = data.envelopes.find(e => e.type === 'total')

  const { data: totalExistant, error: totalFetchError } = await supabase
    .from('envelopes')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'total')
    .maybeSingle()
  if (totalFetchError) {
    throw new Error('Échec de la restauration des données : ' + totalFetchError.message)
  }

  const totalIdExistant = totalExistant?.id ?? null
  if (totalIdExistant) {
    const { error: deleteTotalMovementsError } = await supabase
      .from('movements')
      .delete()
      .eq('envelope_id', totalIdExistant)
    if (deleteTotalMovementsError) {
      throw new Error('Échec de la suppression des mouvements existants : ' + deleteTotalMovementsError.message)
    }
  }

  const { error: deleteEnvelopesError } = await supabase
    .from('envelopes')
    .delete()
    .eq('user_id', userId)
    .neq('type', 'total')
  if (deleteEnvelopesError) {
    throw new Error('Échec de la suppression des données actuelles : ' + deleteEnvelopesError.message)
  }

  if (totalSauvegarde && totalIdExistant) {
    // On garde l'id du Patrimoine existant (changer une clé primaire est
    // risqué : realtime, caches, FK). Les références du fichier vers l'ancien
    // id sont remappées plus bas via sourceTotalId → targetTotalId.
    const { error: updateTotalError } = await supabase
      .from('envelopes')
      .update({
        title: totalSauvegarde.title,
        description: totalSauvegarde.description ?? null,
        goal_amount: null,
        position: Number.isFinite(totalSauvegarde.position) ? totalSauvegarde.position : 0,
      })
      .eq('user_id', userId)
      .eq('type', 'total')
    if (updateTotalError) {
      throw new Error('Échec de la restauration du Patrimoine : ' + updateTotalError.message)
    }
  }

  const sourceTotalId = totalSauvegarde?.id ?? null
  const targetTotalId = totalIdExistant || sourceTotalId

  const parId = new Map(data.envelopes.map(e => [e.id, e]))
  const envsPropres = data.envelopes
    .filter(e => !(totalIdExistant && e.type === 'total'))
    .map(e => ({
      id: e.id,
      user_id: userId,
      parent_id: e.parent_id === sourceTotalId ? targetTotalId : e.parent_id ?? null,
      type: e.type,
      title: e.title,
      description: e.description ?? null,
      goal_amount: e.type === 'normal' ? e.goal_amount ?? null : null,
      // Récurrence : uniquement sur les comptes épargne (le schéma le contraint)
      recurring_amount:   e.type === 'savings' ? e.recurring_amount ?? null : null,
      recurring_interval: e.type === 'savings' ? e.recurring_interval ?? null : null,
      recurring_last_run: e.type === 'savings' ? e.recurring_last_run ?? null : null,
      position: Number.isFinite(e.position) ? e.position : 0,
      created_at: e.created_at ?? new Date().toISOString(),
      updated_at: e.updated_at ?? new Date().toISOString(),
    }))
  const parProfondeur = new Map()
  for (const e of envsPropres) {
    const d = profondeur(parId.get(e.id), parId)
    if (!parProfondeur.has(d)) parProfondeur.set(d, [])
    parProfondeur.get(d).push(e)
  }
  for (const d of [...parProfondeur.keys()].sort((a, b) => a - b)) {
    const { error } = await supabase.from('envelopes').insert(parProfondeur.get(d))
    if (error) throw new Error('Échec de la restauration des enveloppes : ' + error.message)
  }

  // 3. INSERT des mouvements, linked_movement_id forcé à null (2e passe ensuite)
  const mvsPropres = data.movements.map(m => ({
    id: m.id,
    envelope_id: m.envelope_id === sourceTotalId ? targetTotalId : m.envelope_id,
    amount: m.amount,
    type: m.type,
    linked_movement_id: null,
    note: m.note ?? null,
    is_undone: !!m.is_undone,
    created_at: m.created_at ?? new Date().toISOString(),
  }))
  if (mvsPropres.length > 0) {
    const { error } = await supabase.from('movements').insert(mvsPropres)
    if (error) throw new Error('Échec de la restauration des mouvements : ' + error.message)
  }

  // 4. 2e passe : rétablit les linked_movement_id (uniquement vers des
  //    mouvements présents dans le fichier — un lien orphelin est ignoré)
  const idsPresents = new Set(data.movements.map(m => m.id))
  const lies = data.movements.filter(m => m.linked_movement_id && idsPresents.has(m.linked_movement_id))
  for (const m of lies) {
    const { error } = await supabase
      .from('movements')
      .update({ linked_movement_id: m.linked_movement_id })
      .eq('id', m.id)
    if (error) throw new Error('Échec du rétablissement des liens : ' + error.message)
  }
}