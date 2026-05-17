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

/** Valide la structure. Throw une erreur explicite si invalide. */
export function validerImport(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Fichier vide ou invalide.')
  }
  if (!Array.isArray(data.envelopes) || !Array.isArray(data.movements)) {
    throw new Error("Ce fichier n'a pas le format d'une sauvegarde Tom's Cabinet.")
  }

  const typesEnv = ['total', 'normal', 'creance']
  const totaux = data.envelopes.filter(e => e?.type === 'total')
  if (totaux.length !== 1) {
    throw new Error('Le fichier doit contenir exactement un Patrimoine.')
  }
  for (const e of data.envelopes) {
    if (!e || typeof e.id !== 'string') throw new Error('Une enveloppe a un identifiant invalide.')
    if (!typesEnv.includes(e.type)) throw new Error(`Type d'enveloppe inconnu : ${e?.type}`)
    if (typeof e.title !== 'string' || !e.title.trim()) throw new Error('Une enveloppe a un titre vide.')
  }

  const typesMv = ['income', 'spend', 'allocate', 'unallocate', 'creance_add', 'creance_repaid']
  const envIds = new Set(data.envelopes.map(e => e.id))
  for (const m of data.movements) {
    if (!m || typeof m.id !== 'string') throw new Error('Un mouvement a un identifiant invalide.')
    if (!typesMv.includes(m.type)) throw new Error(`Type de mouvement inconnu : ${m?.type}`)
    if (!envIds.has(m.envelope_id)) {
      throw new Error('Un mouvement référence une enveloppe absente du fichier.')
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
    const { error: updateTotalError } = await supabase
      .from('envelopes')
      .update({
        id: totalSauvegarde.id,
        title: totalSauvegarde.title,
        description: totalSauvegarde.description ?? null,
        goal_amount: null,
        position: Number.isFinite(totalSauvegarde.position) ? totalSauvegarde.position : 0,
        created_at: totalSauvegarde.created_at ?? new Date().toISOString(),
        updated_at: totalSauvegarde.updated_at ?? new Date().toISOString(),
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

  // 4. 2e passe : rétablit les linked_movement_id
  const lies = data.movements.filter(m => m.linked_movement_id)
  for (const m of lies) {
    const { error } = await supabase
      .from('movements')
      .update({ linked_movement_id: m.linked_movement_id })
      .eq('id', m.id)
    if (error) throw new Error('Échec du rétablissement des liens : ' + error.message)
  }
}