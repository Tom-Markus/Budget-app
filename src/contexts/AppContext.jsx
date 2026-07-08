/**
 * src/contexts/AppContext.jsx — version Bloc G
 * ----------------------------------------------------------------------------
 * Identique au Bloc F-bis + une action `reordonner` (drag & drop) avec
 * mise à jour optimiste de l'ordre et rollback en cas d'échec serveur.
 * ----------------------------------------------------------------------------
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { AppContext } from '../hooks/useApp'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  calculerSoldes, calculerARepartir, simulerAnnulationSure,
} from '../lib/calculs'
import { formatEuros } from '../lib/formatters'
import * as mutations from '../lib/mutations'

const LIMITE_ENVELOPPES = 100

// Tolérance flottante pour les comparaisons de montants (les montants sont
// des numeric(12,2) mais transitent en float côté JS : 0.1 + 0.2 ≠ 0.3).
const EPSILON = 0.005

function appliquerDelta(prev, payload) {
  switch (payload.eventType) {
    case 'INSERT':
      if (prev.some(x => x.id === payload.new.id)) return prev
      return [...prev, payload.new]
    case 'UPDATE':
      return prev.map(x => (x.id === payload.new.id ? payload.new : x))
    case 'DELETE':
      return prev.filter(x => x.id !== payload.old.id)
    default:
      return prev
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const uid = user?.id ?? null

  const [envelopes, setEnvelopes] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [loading, setLoading] = useState(!!uid)
  const [error, setError] = useState(null)
  const [syncingIds, setSyncingIds] = useState(() => new Set())

  // Reset synchrone quand l'utilisateur change (login/logout) — fait pendant
  // le rendu (pattern React « adjusting state during render ») plutôt que
  // dans un effet, pour éviter un rendu intermédiaire avec les données de
  // l'ancien utilisateur.
  const [prevUid, setPrevUid] = useState(uid)
  if (prevUid !== uid) {
    setPrevUid(uid)
    setEnvelopes([])
    setMouvements([])
    setError(null)
    setLoading(!!uid)
  }

  // Fetch initial + Realtime
  useEffect(() => {
    if (!uid) return
    let mounted = true

    ;(async () => {
      try {
        const [envRes, mvRes] = await Promise.all([
          supabase.from('envelopes').select('*')
            .eq('user_id', uid)
            .order('position', { ascending: true }),
          supabase.from('movements').select('*')
            .order('created_at', { ascending: true }),
        ])
        if (!mounted) return
        if (envRes.error) throw envRes.error
        if (mvRes.error) throw mvRes.error
        setEnvelopes(envRes.data ?? [])
        setMouvements(mvRes.data ?? [])

        // Rattrapage des versements automatiques d'épargne échus.
        // Best-effort : un échec ici ne doit pas bloquer le chargement.
        try {
          const epargnesAvecRecurrence = (envRes.data ?? [])
            .filter(e => e.type === 'savings' && Number(e.recurring_amount) > 0)
          if (epargnesAvecRecurrence.length > 0) {
            await mutations.executerRecurrencesDues(epargnesAvecRecurrence)
          }
        } catch (errRec) {
          console.error('Rattrapage récurrences épargne :', errRec)
        }
      } catch (err) {
        if (!mounted) return
        console.error('Fetch initial :', err)
        setError(err.message || 'Erreur de chargement')
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    // Filtre user_id sur envelopes : la RLS couvre déjà INSERT/UPDATE, mais
    // les événements DELETE de Postgres Changes ne sont PAS filtrés par la
    // RLS — sans ce filtre on recevrait les suppressions de tous les comptes.
    // (movements n'a pas de colonne user_id : pas de filtre possible, mais
    // les payloads DELETE ne contiennent que l'id — sans impact.)
    const envCh = supabase.channel(`envelopes-${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'envelopes', filter: `user_id=eq.${uid}` },
        (payload) => mounted && setEnvelopes(prev => appliquerDelta(prev, payload)))
      .subscribe()
    const mvCh = supabase.channel(`movements-${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'movements' },
        (payload) => mounted && setMouvements(prev => appliquerDelta(prev, payload)))
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(envCh)
      supabase.removeChannel(mvCh)
    }
  }, [uid])

  // Calculs dérivés
  const soldes = useMemo(() => calculerSoldes(envelopes, mouvements), [envelopes, mouvements])
  const aRepartir = useMemo(() => calculerARepartir(envelopes, mouvements), [envelopes, mouvements])
  const patrimoine = useMemo(() => envelopes.find(e => e.type === 'total') ?? null, [envelopes])
  const racines = useMemo(
    () => envelopes.filter(e => e.type === 'normal' && !e.parent_id).sort((a, b) => a.position - b.position),
    [envelopes]
  )
  const creances = useMemo(
    () => envelopes.filter(e => e.type === 'creance').sort((a, b) => a.position - b.position),
    [envelopes]
  )
  const epargnes = useMemo(
    () => envelopes.filter(e => e.type === 'savings').sort((a, b) => a.position - b.position),
    [envelopes]
  )

  const soldeDe = useCallback((id) => soldes.get(id) ?? 0, [soldes])
  const enfantsDe = useCallback(
    (id) => envelopes.filter(e => e.parent_id === id).sort((a, b) => a.position - b.position),
    [envelopes]
  )
  const aDesEnfants = useCallback((id) => envelopes.some(e => e.parent_id === id), [envelopes])

  const marquerSync = useCallback((id, on) => {
    setSyncingIds(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }, [])
  const estSyncing = useCallback((id) => syncingIds.has(id), [syncingIds])

  const wrap = useCallback(async (envIdForSync, fn) => {
    if (envIdForSync) marquerSync(envIdForSync, true)
    try {
      await fn()
    } catch (err) {
      console.error('Action échouée :', err)
      showToast({ message: err.message || 'Action impossible', type: 'erreur', duration: 3000 })
    } finally {
      if (envIdForSync) marquerSync(envIdForSync, false)
    }
  }, [marquerSync, showToast])

  const actions = useMemo(() => ({
    ajouterIncome: (montant, note) =>
      wrap(patrimoine?.id, () => mutations.ajouterIncome(patrimoine.id, montant, note)),

    allouer: (envId, montant, note) =>
      wrap(envId, async () => {
        if (montant > aRepartir + EPSILON) {
          throw new Error(`Montant trop élevé : il ne reste que ${formatEuros(aRepartir)} à répartir.`)
        }
        await mutations.allouer(envId, montant, note)
      }),

    depenser: (envId, montant, note) =>
      wrap(envId, async () => {
        const solde = soldeDe(envId)
        if (montant > solde + EPSILON) {
          throw new Error(`Montant trop élevé : il ne reste que ${formatEuros(solde)} dans cette enveloppe.`)
        }
        await mutations.depenser(envId, montant, note)
      }),

    desallouer: (envId, montant, note) =>
      wrap(envId, async () => {
        const solde = soldeDe(envId)
        if (montant > solde + EPSILON) {
          throw new Error(`Montant trop élevé : il ne reste que ${formatEuros(solde)} dans cette enveloppe.`)
        }
        await mutations.desallouer(envId, montant, note)
      }),

    ajouterCreance: (envId, montant, note) =>
      wrap(envId, () => mutations.ajouterCreance(envId, montant, note)),

    rembourserCreance: (envId, montant, note) =>
      wrap(envId, async () => {
        const solde = soldeDe(envId)
        if (montant > solde + EPSILON) {
          throw new Error(`Montant trop élevé : la dette n'est que de ${formatEuros(solde)}.`)
        }
        await mutations.rembourserCreance(envId, patrimoine.id, montant, note)
      }),

    annulerDernier: (envId) =>
      wrap(envId, async () => {
        const sim = simulerAnnulationSure(envId, envelopes, mouvements)
        if (!sim.ok) throw new Error(sim.raison)
        await mutations.annulerDernier(envId)
        showToast({ message: 'Annulé', type: 'info', duration: 2000 })
      }),

    creerEnveloppeRacine: ({ title, description }) =>
      wrap(null, async () => {
        if (envelopes.length >= LIMITE_ENVELOPPES) {
          throw new Error('Limite atteinte, contactez le développeur.')
        }
        await mutations.creerEnveloppeRacine(user.id, { title, description })
      }),
    creerSousEnveloppe: (parentId, { title, description }) =>
      wrap(parentId, async () => {
        if (envelopes.length >= LIMITE_ENVELOPPES) {
          throw new Error('Limite atteinte, contactez le développeur.')
        }
        const soldeParente = soldeDe(parentId)
        await mutations.creerSousEnveloppe(user.id, parentId, soldeParente, { title, description })
      }),
    creerCreance: ({ title }) =>
      wrap(null, async () => {
        if (envelopes.length >= LIMITE_ENVELOPPES) {
          throw new Error('Limite atteinte, contactez le développeur.')
        }
        await mutations.creerCreance(user.id, { title })
      }),

    // --- Comptes épargne (indépendants du Patrimoine) ---
    creerEpargne: ({ title }) =>
      wrap(null, async () => {
        if (envelopes.length >= LIMITE_ENVELOPPES) {
          throw new Error('Limite atteinte, contactez le développeur.')
        }
        await mutations.creerEpargne(user.id, { title })
      }),

    ajouterEpargne: (envId, montant, note) =>
      wrap(envId, () => mutations.ajouterEpargne(envId, montant, note)),

    retirerEpargne: (envId, montant, note) =>
      wrap(envId, async () => {
        const solde = soldeDe(envId)
        if (montant > solde + EPSILON) {
          throw new Error(`Montant trop élevé : il ne reste que ${formatEuros(solde)} sur ce compte.`)
        }
        await mutations.retirerEpargne(envId, montant, note)
      }),

    definirRecurrenceEpargne: (envId, montant, interval) =>
      wrap(envId, () => mutations.definirRecurrenceEpargne(envId, montant, interval)),

    modifierEnveloppe: (envId, patch) =>
      wrap(envId, async () => {
        const snapshot = envelopes
        setEnvelopes(prev => prev.map(e => e.id === envId ? { ...e, ...patch } : e))
        try {
          await mutations.modifierEnveloppe(envId, patch)
        } catch (err) {
          setEnvelopes(snapshot)
          throw err
        }
      }),

    modifierNoteMouvement: (mouvementId, note) =>
      wrap(null, async () => {
        const snapshot = mouvements
        setMouvements(prev => prev.map(m => m.id === mouvementId ? { ...m, note: note?.trim() || null } : m))
        try {
          await mutations.modifierNoteMouvement(mouvementId, note)
        } catch (err) {
          setMouvements(snapshot)
          throw err
        }
      }),

    supprimerEnveloppe: (envId, modeAvecEnfants = 'cascade') =>
      wrap(envId, async () => {
        const env = envelopes.find(e => e.id === envId)
        if (!env) throw new Error('Enveloppe introuvable.')
        const solde = soldeDe(envId)
        const aEnfants = aDesEnfants(envId)
        await mutations.supprimerEnveloppe(env, solde, aEnfants, patrimoine?.id, modeAvecEnfants)
      }),

    // --- Réorganisation (drag & drop) ---
    // Optimistic : on applique le nouvel ordre tout de suite (UI fluide),
    // puis on persiste. En cas d'échec serveur, on restaure l'ordre précédent.
    reordonner: (idsOrdonnes) =>
      wrap(null, async () => {
        const updates = idsOrdonnes.map((id, index) => ({ id, position: index }))
        const snapshot = envelopes
        setEnvelopes(prev => prev.map(e => {
          const u = updates.find(x => x.id === e.id)
          return u ? { ...e, position: u.position } : e
        }))
        try {
          await mutations.reordonnerPositions(updates)
        } catch (err) {
          setEnvelopes(snapshot)
          throw err
        }
      }),
  }), [
    wrap, patrimoine, envelopes, mouvements, soldeDe, aDesEnfants,
    aRepartir, user, showToast,
  ])

  const value = {
    envelopes, mouvements, loading, error,
    patrimoine, racines, creances, epargnes,
    soldes, soldeDe, aRepartir,
    enfantsDe, aDesEnfants,
    marquerSync, estSyncing,
    actions,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
