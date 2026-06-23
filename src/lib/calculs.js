/**
 * src/lib/calculs.js — version Bloc F-bis
 * ----------------------------------------------------------------------------
 * Soldes côté client + helpers d'historique.
 *
 * Nouveautés Bloc F-bis :
 *   - descendantsIds      : tous les ids descendants d'une enveloppe (récursif)
 *   - mouvementsDeLArbre  : mouvements d'une enveloppe + ses descendants
 *   - dernierMouvement / reconstruireHistorique utilisent désormais l'arbre
 *     complet → la flèche et le graphique d'une enveloppe PARENTE reflètent
 *     l'activité de ses sous-enveloppes.
 *   - preparerCourbe      : étend l'axe à la fenêtre de période + agrège
 *     par jour si demandé.
 * ----------------------------------------------------------------------------
 */

function indexer(envelopes, mouvements) {
  const envParId = new Map()
  const enfantsDe = new Map()
  for (const env of envelopes) {
    envParId.set(env.id, env)
    if (env.parent_id) {
      if (!enfantsDe.has(env.parent_id)) enfantsDe.set(env.parent_id, [])
      enfantsDe.get(env.parent_id).push(env.id)
    }
  }
  const mouvPar = new Map()
  for (const m of mouvements) {
    if (m.is_undone) continue
    if (!mouvPar.has(m.envelope_id)) mouvPar.set(m.envelope_id, [])
    mouvPar.get(m.envelope_id).push(m)
  }
  return { envParId, enfantsDe, mouvPar }
}

/** @param {boolean} clipper true = solde min 0 (affichage), false = brut */
export function calculerSoldes(envelopes, mouvements, clipper = true) {
  const { envParId, enfantsDe, mouvPar } = indexer(envelopes, mouvements)
  const soldes = new Map()

  let totalSpendsNormales = 0
  for (const env of envelopes) {
    if (env.type !== 'normal') continue
    const mvs = mouvPar.get(env.id) || []
    for (const m of mvs) {
      if (m.type === 'spend') totalSpendsNormales += Number(m.amount)
    }
  }

  function pour(envId) {
    if (soldes.has(envId)) return soldes.get(envId)
    const env = envParId.get(envId)
    if (!env) return 0

    let s = 0
    const enfants = enfantsDe.get(envId) || []

    if (env.type === 'total') {
      const mvs = mouvPar.get(envId) || []
      for (const m of mvs) {
        if (m.type === 'income') s += Number(m.amount)
      }
      s -= totalSpendsNormales
    } else if (env.type === 'creance') {
      const mvs = mouvPar.get(envId) || []
      for (const m of mvs) {
        if (m.type === 'creance_add')         s += Number(m.amount)
        else if (m.type === 'creance_repaid') s -= Number(m.amount)
      }
    } else if (env.type === 'savings') {
      // Compte épargne : totalement indépendant (n'affecte ni le Patrimoine
      // ni « à répartir »). Solde = versements - retraits.
      const mvs = mouvPar.get(envId) || []
      for (const m of mvs) {
        if (m.type === 'savings_add')           s += Number(m.amount)
        else if (m.type === 'savings_withdraw') s -= Number(m.amount)
      }
    } else if (env.type === 'normal') {
      if (enfants.length > 0) {
        for (const id of enfants) s += pour(id)
      } else {
        const mvs = mouvPar.get(envId) || []
        for (const m of mvs) {
          if (m.type === 'allocate')         s += Number(m.amount)
          else if (m.type === 'spend')       s -= Number(m.amount)
          else if (m.type === 'unallocate')  s -= Number(m.amount)
        }
      }
    }

    if (clipper && s < 0) s = 0
    soldes.set(envId, s)
    return s
  }

  for (const env of envelopes) pour(env.id)
  return soldes
}

/** @param {boolean} clipper true = min 0 (affichage), false = brut */
export function calculerARepartir(envelopes, mouvements, clipper = true) {
  const patrimoine = envelopes.find(e => e.type === 'total')
  if (!patrimoine) return 0
  let r = 0
  for (const m of mouvements) {
    if (m.is_undone) continue
    if (m.type === 'income' && m.envelope_id === patrimoine.id) r += Number(m.amount)
    else if (m.type === 'allocate')   r -= Number(m.amount)
    else if (m.type === 'unallocate') r += Number(m.amount)
  }
  return clipper ? Math.max(0, r) : r
}

/**
 * Simule l'annulation du dernier mouvement annulable et vérifie qu'aucun
 * compteur ne passerait sous 0.
 * @returns { ok: true } | { ok: false, raison: string }
 */
export function simulerAnnulationSure(envId, envelopes, mouvements) {
  const env = envelopes.find(e => e.id === envId)
  if (!env) return { ok: false, raison: 'Enveloppe introuvable.' }

  const types =
    env.type === 'total'   ? ['income'] :
    env.type === 'creance' ? ['creance_add', 'creance_repaid'] :
    env.type === 'savings' ? ['savings_add', 'savings_withdraw'] :
                              ['allocate', 'spend', 'unallocate']

  const candidats = mouvements
    .filter(m => m.envelope_id === envId && !m.is_undone && types.includes(m.type))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const dernier = candidats[0]
  if (!dernier) return { ok: false, raison: 'Rien à annuler.' }

  const idsAAnnuler = new Set([dernier.id])
  if (dernier.type === 'creance_repaid' && dernier.linked_movement_id) {
    idsAAnnuler.add(dernier.linked_movement_id)
  }
  if (dernier.type === 'income') {
    for (const m of mouvements) {
      if (m.linked_movement_id === dernier.id && !m.is_undone) idsAAnnuler.add(m.id)
    }
  }

  const mvHypo = mouvements.map(m =>
    idsAAnnuler.has(m.id) ? { ...m, is_undone: true } : m
  )
  const soldesBruts = calculerSoldes(envelopes, mvHypo, false)
  const arBrut = calculerARepartir(envelopes, mvHypo, false)

  if (arBrut < 0) {
    return { ok: false, raison: `Annulation impossible : « à répartir » tomberait à ${arBrut.toFixed(2)} €.` }
  }
  for (const e of envelopes) {
    const s = soldesBruts.get(e.id) ?? 0
    if (s < 0) {
      return { ok: false, raison: `Annulation impossible : « ${e.title} » tomberait à ${s.toFixed(2)} €.` }
    }
  }
  return { ok: true }
}

/** Tous les ids descendants d'une enveloppe (récursif, tous niveaux). */
export function descendantsIds(envId, envelopes) {
  const out = []
  for (const child of envelopes.filter(e => e.parent_id === envId)) {
    out.push(child.id)
    out.push(...descendantsIds(child.id, envelopes))
  }
  return out
}

/**
 * Mouvements non-annulés pertinents pour une enveloppe :
 *   - 'total'   : income sur Patrimoine + spend de toutes les normales
 *   - 'normal'  : ses mouvements + ceux de tous ses descendants
 *   - 'creance' : ses propres mouvements
 */
export function mouvementsDeLArbre(envId, envelopes, mouvements) {
  const env = envelopes.find(e => e.id === envId)
  if (!env) return []
  if (env.type === 'total') {
    const idsNormales = new Set(envelopes.filter(e => e.type === 'normal').map(e => e.id))
    return mouvements.filter(m =>
      !m.is_undone && (
        (m.envelope_id === envId && m.type === 'income') ||
        (m.type === 'spend' && idsNormales.has(m.envelope_id))
      )
    )
  }
  const ids = new Set([envId, ...descendantsIds(envId, envelopes)])
  return mouvements.filter(m => !m.is_undone && ids.has(m.envelope_id))
}

/** Dernier mouvement (le plus récent) de l'arbre d'une enveloppe. */
export function dernierMouvement(envId, envelopes, mouvements) {
  const mvs = mouvementsDeLArbre(envId, envelopes, mouvements)
  if (mvs.length === 0) return null
  return [...mvs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
}

/**
 * Évolution du solde au fil du temps (cumul des mouvements de l'arbre).
 * @returns Array<{ date: Date, solde: number }>
 */
export function reconstruireHistorique(envId, envelopes, mouvements) {
  const pertinents = [...mouvementsDeLArbre(envId, envelopes, mouvements)]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const points = []
  let solde = 0
  for (const m of pertinents) {
    if (['income', 'allocate', 'creance_add', 'savings_add'].includes(m.type)) solde += Number(m.amount)
    else solde -= Number(m.amount)
    if (solde < 0) solde = 0
    points.push({ date: new Date(m.created_at), solde })
  }
  return points
}

/**
 * Prépare les points d'une courbe pour l'affichage :
 *   - étend l'axe à toute la fenêtre [maintenant - jours ; maintenant]
 *     (un point de départ porté + un point final), pour que la courbe ne
 *     commence/finisse pas au premier/dernier mouvement
 *   - agrège par jour si demandé (un point/jour = dernier solde du jour)
 *
 * @param points          Array<{ date: Date|string, valeur: number }>
 * @param jours           taille de la fenêtre en jours, ou null pour "tout"
 * @param agregerParJour  true pour 3M / TOUT, false pour 7J / 30J
 * @returns Array<{ date: ISOstring, valeur: number }>
 */
export function preparerCourbe(points, jours, agregerParJour) {
  const norm = (points || [])
    .map(p => ({ t: new Date(p.date).getTime(), valeur: Number(p.valeur ?? p.solde ?? 0) }))
    .filter(p => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)

  const now = Date.now()
  const cutoff = jours ? now - jours * 86400000 : null

  // Valeur du solde juste avant le début de la fenêtre
  let valeurAvant = 0
  let dansFenetre = norm
  if (cutoff !== null) {
    for (const p of norm) {
      if (p.t < cutoff) valeurAvant = p.valeur
    }
    dansFenetre = norm.filter(p => p.t >= cutoff)
  }

  // Série = point de départ + points dans la fenêtre + point final
  let serie = dansFenetre.map(p => ({ t: p.t, valeur: p.valeur }))

  const tDebut = cutoff !== null
    ? cutoff
    : (norm.length > 0 ? norm[0].t - 1000 : now - 1000)
  const valeurDebut = cutoff !== null ? valeurAvant : 0
  serie.unshift({ t: tDebut, valeur: valeurDebut })

  const derniereValeur = serie[serie.length - 1].valeur
  serie.push({ t: now, valeur: derniereValeur })

  // Agrégation par jour : on garde le dernier point de chaque jour
  if (agregerParJour) {
    const parJour = new Map()
    for (const pt of serie) {
      const cle = new Date(pt.t).toISOString().slice(0, 10)
      parJour.set(cle, pt)
    }
    serie = Array.from(parJour.values()).sort((a, b) => a.t - b.t)
  }

  return serie.map(pt => ({ date: new Date(pt.t).toISOString(), valeur: pt.valeur }))
}