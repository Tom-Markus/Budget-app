/**
 * src/pages/Accueil.jsx — version Bloc G
 * ----------------------------------------------------------------------------
 * Bloc F-bis + drag & drop des enveloppes racines (dnd-kit) et indicateur
 * de synchronisation (SyncingDot) sur Patrimoine et chaque enveloppe.
 *
 * Drag : poignée ⠿ en haut-gauche (souris : 8 px ; tactile : appui 500 ms).
 * Désactivé en mode édition. Sous-enveloppes non réordonnables en v1.
 * ----------------------------------------------------------------------------
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DndContext, closestCenter,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../hooks/useApp'
import { useAuth } from '../hooks/useAuth'
import GrandeEnveloppe from '../components/GrandeEnveloppe'
import PetiteEnveloppe from '../components/PetiteEnveloppe'
import BoutonNouvelleEnveloppe from '../components/BoutonNouvelleEnveloppe'
import PopupConfirmation from '../components/PopupConfirmation'
import Graphique from '../components/Graphique'
import { LoaderNoble, SyncingDot } from '../components/Toast'
import { dernierMouvement, reconstruireHistorique, mouvementsDeLArbre } from '../lib/calculs'
import { formatEuros } from '../lib/formatters'

// ----- Helpers direction / dernier mouvement -----
function dirEtMontant(env, envelopes, mouvements) {
  const mv = dernierMouvement(env.id, envelopes, mouvements)
  if (!mv) return { direction: 'transfert', signeMontant: 0 }
  if (env.type === 'normal' && mv.type === 'unallocate') {
    return { direction: 'transfert', signeMontant: -Number(mv.amount) }
  }
  if (['income', 'allocate', 'creance_add'].includes(mv.type)) {
    return { direction: 'up', signeMontant: Number(mv.amount) }
  }
  return { direction: 'down', signeMontant: -Number(mv.amount) }
}

function dirEtMontantARepartir(patrimoineId, mouvements) {
  const candidats = mouvements
    .filter(m => !m.is_undone)
    .filter(m => (
      m.type === 'allocate' ||
      m.type === 'unallocate' ||
      (m.type === 'income' && m.envelope_id === patrimoineId)
    ))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const mv = candidats[0]
  if (!mv) return { direction: 'transfert', signeMontant: 0 }
  if (mv.type === 'income' || mv.type === 'unallocate') {
    return { direction: 'up', signeMontant: Number(mv.amount) }
  }
  return { direction: 'down', signeMontant: -Number(mv.amount) }
}

// ----- Wrapper sortable d'une enveloppe normale racine -----
function EnveloppeDraggable({ envId, petiteProps, disabled, syncing, dndActive }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: envId, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: [transition, 'filter 0.2s ease'].filter(Boolean).join(', '),
    position: 'relative',
    zIndex: isDragging ? 20 : 'auto',
    filter: isDragging ? 'drop-shadow(0 12px 24px rgba(31,24,16,0.18))' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {syncing && (
        <span className="absolute top-2.5 right-2.5 z-30">
          <SyncingDot active />
        </span>
      )}
      <PetiteEnveloppe
        {...petiteProps}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export default function Accueil() {
  const isDesktop = useIsDesktop()
  const { user } = useAuth()
  const {
    loading, error,
    patrimoine, racines, envelopes, mouvements,
    soldeDe, aRepartir, enfantsDe, aDesEnfants,
    actions, estSyncing,
  } = useApp()

  const storageKey = user ? `envelope-cols-${user.id}` : null

  const [inputActif, setInputActif] = useState({})
  const [modeEdition, setModeEdition] = useState({})
  const [descOuverte, setDescOuverte] = useState({})
  const [graphEnvId, setGraphEnvId] = useState(null)
  const [popupDel, setPopupDel] = useState(null)
  const [popupSousCat, setPopupSousCat] = useState(null)
  const [titreSousCat, setTitreSousCat] = useState('')
  const [descSousCat, setDescSousCat] = useState('')

  const pendingRef = useRef({})
  const saveTimerRef = useRef({})

  // ----- État des colonnes (distribution libre gauche / droite) -----
  const [cols, setCols] = useState({ left: [], right: [] })
  const colsRef = useRef({ left: [], right: [] })
  useEffect(() => { colsRef.current = cols }, [cols])

  const [dndActive, setDndActive] = useState(false)
  const colsSnapshotRef = useRef(null)
  const startContainerRef = useRef(null)

  // Synchronise les colonnes quand racines change (ajout / suppression / chargement initial)
  useEffect(() => {
    if (racines.length === 0) return
    setCols(prev => {
      const currentIds = new Set(racines.map(r => r.id))
      let left = prev.left.filter(id => currentIds.has(id))
      let right = prev.right.filter(id => currentIds.has(id))
      const allKnown = new Set([...left, ...right])
      const newItems = racines.filter(r => !allKnown.has(r.id))

      if (left.length === 0 && right.length === 0) {
        // Premier chargement : essayer localStorage d'abord
        if (storageKey) {
          try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
            if (saved && typeof saved === 'object') {
              const savedLeft = racines.filter(r => saved[r.id] === 0).map(r => r.id)
              const savedRight = racines.filter(r => saved[r.id] === 1).map(r => r.id)
              // Nouvelles enveloppes absentes du stockage → colonne la plus courte
              racines.filter(r => saved[r.id] === undefined).forEach(r => {
                if (savedLeft.length <= savedRight.length) savedLeft.push(r.id)
                else savedRight.push(r.id)
              })
              return { left: savedLeft, right: savedRight }
            }
          } catch { /* ignore */ }
        }
        // Pas de données sauvegardées : première moitié à gauche, deuxième à droite
        const mid = Math.ceil(racines.length / 2)
        return {
          left: racines.slice(0, mid).map(r => r.id),
          right: racines.slice(mid).map(r => r.id),
        }
      }

      if (newItems.length === 0 && left.length === prev.left.length && right.length === prev.right.length) {
        return prev
      }
      newItems.forEach(r => {
        if (left.length <= right.length) left.push(r.id)
        else right.push(r.id)
      })
      return { left: [...left], right: [...right] }
    })
  }, [racines, storageKey])

  const findContainer = useCallback((id) => {
    const c = colsRef.current
    if (c.left.includes(id)) return 'left'
    if (c.right.includes(id)) return 'right'
    return null
  }, [])

  // Capteurs dnd-kit : souris (8 px) + tactile (appui long 500 ms)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
  )

  const hasUndoable = useCallback((envId) => {
    const env = envelopes.find(e => e.id === envId)
    if (!env) return false
    const types = env.type === 'total' ? ['income']
      : env.type === 'creance' ? ['creance_add', 'creance_repaid']
      : ['allocate', 'spend', 'unallocate']
    return mouvements.some(m =>
      m.envelope_id === envId && !m.is_undone && types.includes(m.type)
    )
  }, [envelopes, mouvements])

  const onSaveEditionFor = useCallback((env) => ({ titre, description }) => {
    const p = pendingRef.current[env.id] || { titre: undefined, description: undefined }
    const knownTitre = p.titre !== undefined ? p.titre : env.title
    const knownDesc  = p.description !== undefined ? p.description : (env.description || '')

    let changed = false
    if (titre !== knownTitre) { p.titre = titre; changed = true }
    if ((description || '') !== knownDesc) { p.description = description || ''; changed = true }
    pendingRef.current[env.id] = p

    if (!changed) return
    clearTimeout(saveTimerRef.current[env.id])
    saveTimerRef.current[env.id] = setTimeout(() => {
      const final = pendingRef.current[env.id]
      if (!final) return
      const patch = {}
      if (final.titre !== undefined && final.titre.trim() && final.titre.trim() !== env.title) {
        patch.title = final.titre.trim()
      }
      if (final.description !== undefined) {
        const newDesc = final.description.trim() || null
        if (newDesc !== (env.description || null)) patch.description = newDesc
      }
      if (Object.keys(patch).length > 0) actions.modifierEnveloppe(env.id, patch)
      delete pendingRef.current[env.id]
    }, 400)
  }, [actions])

  const toggleEdit = useCallback((env) => {
    const wasEditing = !!modeEdition[env.id]
    if (wasEditing) {
      clearTimeout(saveTimerRef.current[env.id])
      const final = pendingRef.current[env.id]
      if (final) {
        const patch = {}
        if (final.titre !== undefined && final.titre.trim() && final.titre.trim() !== env.title) {
          patch.title = final.titre.trim()
        }
        if (final.description !== undefined) {
          const newDesc = final.description.trim() || null
          if (newDesc !== (env.description || null)) patch.description = newDesc
        }
        if (Object.keys(patch).length > 0) actions.modifierEnveloppe(env.id, patch)
        delete pendingRef.current[env.id]
      }
    }
    setModeEdition(s => {
      const next = { ...s }
      if (wasEditing) delete next[env.id]
      else next[env.id] = true
      return next
    })
  }, [modeEdition, actions])

  const ouvrirSuppression = useCallback((env) => {
    const solde = soldeDe(env.id)
    const enfants = aDesEnfants(env.id)
    let type
    if (enfants) type = 'children'
    else if (env.type === 'creance' && solde > 0) type = 'creance'
    else if (solde > 0) type = 'soldeKept'
    else type = 'simple'
    setPopupDel({ env, solde, type })
  }, [soldeDe, aDesEnfants])

  const onValidateInputFor = useCallback((envId) => (type, { amount, note }) => {
    const env = envelopes.find(e => e.id === envId)
    if (!env) return
    if (env.type === 'normal') {
      if (type === '+')   actions.allouer(envId, amount, note || null)
      else if (type === '-')  actions.depenser(envId, amount, note || null)
      else if (type === '⤴') actions.desallouer(envId, amount, note || null)
    }
    setInputActif(s => ({ ...s, [envId]: null }))
  }, [envelopes, actions])

  const buildPetiteProps = useCallback((env, niveau) => {
    const enfants = enfantsDe(env.id)
    const { direction, signeMontant } = dirEtMontant(env, envelopes, mouvements)
    const solde = soldeDe(env.id)
    return {
      id: env.id,
      titre: env.title,
      description: env.description || '',
      montant: solde,
      dernierMouvement: signeMontant,
      direction,
      objectif: env.goal_amount ? { cible: Number(env.goal_amount) } : null,
      niveau,
      niveauHierarchique: niveau === 2 ? 'normal' : 'mini',
      modeEdition: !!modeEdition[env.id],
      canAnnuler: hasUndoable(env.id),
      canAddSubcategory: niveau < 3,
      maxAmountForMinus: solde,
      maxAmountForRenvoyer: solde,
      isDescriptionOpen: !!descOuverte[env.id],
      sousEnveloppes: enfants.map(e => buildPetiteProps(e, niveau + 1)),
      actionInputActive: inputActif[env.id] || null,
      onPlus:  () => setInputActif(s => ({ ...s, [env.id]: '+' })),
      onMinus: () => setInputActif(s => ({ ...s, [env.id]: '-' })),
      onUndo:  () => actions.annulerDernier(env.id),
      onRetourARepartir: () => setInputActif(s => ({ ...s, [env.id]: '⤴' })),
      onDescription: () => setDescOuverte(s => ({ ...s, [env.id]: !s[env.id] })),
      onGraphique: () => setGraphEnvId(env.id),
      onEdit: () => toggleEdit(env),
      onSaveEdition: onSaveEditionFor(env),
      onToggleObjectif: (newCible) => actions.modifierEnveloppe(env.id, { goal_amount: newCible }),
      onAddSubcategory: () => {
        setPopupSousCat({ parentId: env.id, parentName: env.title })
        setTitreSousCat('')
        setDescSousCat('')
      },
      onDelete: () => ouvrirSuppression(env),
      onValidateInput: onValidateInputFor(env.id),
      onCancelInput: () => setInputActif(s => ({ ...s, [env.id]: null })),
    }
  }, [
    envelopes, mouvements, modeEdition, inputActif, descOuverte,
    enfantsDe, soldeDe, hasUndoable, actions,
    toggleEdit, onSaveEditionFor, onValidateInputFor, ouvrirSuppression,
  ])

  // ----- Drag handlers -----
  const handleDragStart = useCallback(({ active }) => {
    setDndActive(true)
    colsSnapshotRef.current = colsRef.current
    startContainerRef.current = findContainer(active.id)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }, [findContainer])

  // Déplace l'item entre colonnes en temps réel pendant le drag
  const handleDragOver = useCallback(({ active, over }) => {
    if (!over) return
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setCols(prev => {
      const overItems = prev[overContainer]
      const overIndex = overItems.indexOf(over.id)
      const insertAt = overIndex >= 0 ? overIndex : overItems.length
      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter(id => id !== active.id),
        [overContainer]: [
          ...overItems.slice(0, insertAt),
          active.id,
          ...overItems.slice(insertAt),
        ],
      }
    })
  }, [findContainer])

  const handleDragEnd = useCallback(({ active, over }) => {
    setDndActive(false)
    const startContainer = startContainerRef.current
    startContainerRef.current = null
    colsSnapshotRef.current = null

    if (!over || active.id === over.id) return

    const currentCols = colsRef.current
    const endContainer = currentCols.left.includes(active.id) ? 'left'
      : currentCols.right.includes(active.id) ? 'right' : null
    if (!endContainer) return

    let finalCols = currentCols

    // Réordonnancement dans la même colonne (cross-colonne déjà géré par onDragOver)
    if (startContainer === endContainer) {
      const items = currentCols[endContainer]
      const oldIdx = items.indexOf(active.id)
      const newIdx = items.indexOf(over.id)
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        const newItems = arrayMove(items, oldIdx, newIdx)
        finalCols = { ...currentCols, [endContainer]: newItems }
        setCols(finalCols)
      }
    }

    // Persister les assignations de colonnes dans localStorage
    if (storageKey) {
      const assignments = {}
      finalCols.left.forEach(id => { assignments[id] = 0 })
      finalCols.right.forEach(id => { assignments[id] = 1 })
      localStorage.setItem(storageKey, JSON.stringify(assignments))
    }

    // Persister l'ordre en DB : gauche en premier (positions 0..n-1), droite ensuite
    actions.reordonner([...finalCols.left, ...finalCols.right])
  }, [actions, storageKey])

  const handleDragCancel = useCallback(() => {
    setDndActive(false)
    startContainerRef.current = null
    if (colsSnapshotRef.current) {
      setCols(colsSnapshotRef.current)
      colsSnapshotRef.current = null
    }
  }, [])

  // ----- États précoces -----
  if (loading) return <LoaderNoble message="Lecture du grand livre..." />
  if (error) {
    return (
      <div className="surface-velin p-6 max-w-2xl mx-auto">
        <p style={{ color: 'var(--rouge)' }}>Erreur : {error}</p>
      </div>
    )
  }
  if (!patrimoine) {
    return (
      <div className="surface-velin p-6 max-w-2xl mx-auto">
        <p style={{ color: 'var(--rouge)' }}>
          Patrimoine introuvable — déconnecte-toi et reconnecte-toi, ou contacte le développeur.
        </p>
      </div>
    )
  }

  const patrimoineDir = dirEtMontant(patrimoine, envelopes, mouvements)
  const aRepartirDir = dirEtMontantARepartir(patrimoine.id, mouvements)
  const patrimoineInputActive = inputActif[patrimoine.id] === 'income'

  // ----- Données Graphique modal -----
  let graphData = []
  let graphMouvements = []
  let graphTitre = ''
  let graphSigne = 'positif'
  if (graphEnvId) {
    const env = envelopes.find(e => e.id === graphEnvId)
    if (env) {
      graphTitre = env.title
      const pts = reconstruireHistorique(graphEnvId, envelopes, mouvements)
      graphData = pts.map(p => ({ date: p.date.toISOString(), valeur: p.solde }))

      const mvsBruts = [...mouvementsDeLArbre(graphEnvId, envelopes, mouvements)]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      graphMouvements = mvsBruts.map(m => ({
        date: m.created_at,
        montant: ['income', 'allocate', 'creance_add'].includes(m.type)
          ? Number(m.amount) : -Number(m.amount),
        note: m.note,
      }))
      const last = mvsBruts[0]
      if (last) graphSigne = ['income', 'allocate', 'creance_add'].includes(last.type) ? 'positif' : 'negatif'
    }
  }

  return (
    <div className="space-y-8">
      {/* === Patrimoine + à répartir === */}
      <div className="relative">
        {estSyncing(patrimoine.id) && (
          <span className="absolute top-3 right-3 z-30">
            <SyncingDot active />
          </span>
        )}
        <GrandeEnveloppe
          patrimoine={soldeDe(patrimoine.id)}
          patrimoineDernierMouvement={patrimoineDir.signeMontant}
          patrimoineDirection={patrimoineDir.direction}
          aRepartir={aRepartir}
          aRepartirDernierMouvement={aRepartirDir.signeMontant}
          aRepartirDirection={aRepartirDir.direction}
          onRecevoir={() => setInputActif(s => ({ ...s, [patrimoine.id]: 'income' }))}
          onAnnuler={() => actions.annulerDernier(patrimoine.id)}
          canAnnuler={hasUndoable(patrimoine.id)}
          isInputActive={patrimoineInputActive}
          onValidateRecevoir={({ amount, note }) => {
            actions.ajouterIncome(amount, note || null)
            setInputActif(s => ({ ...s, [patrimoine.id]: null }))
          }}
          onCancelRecevoir={() => setInputActif(s => ({ ...s, [patrimoine.id]: null }))}
        />
      </div>

      {/* === Enveloppes normales racines (drag & drop) === */}
      <section className="flex flex-col gap-4">
        {racines.length > 0 && (
          <h2 className="t-label-noble px-1">Mes enveloppes</h2>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {isDesktop ? (
            <div className="flex gap-4 items-start">
              <div className="flex-1 flex flex-col gap-4">
                <SortableContext items={cols.left} strategy={verticalListSortingStrategy}>
                  {cols.left.map(id => {
                    const env = racines.find(r => r.id === id)
                    if (!env) return null
                    return (
                      <EnveloppeDraggable
                        key={env.id}
                        envId={env.id}
                        petiteProps={buildPetiteProps(env, 2)}
                        disabled={!!modeEdition[env.id]}
                        syncing={estSyncing(env.id)}
                        dndActive={dndActive}
                      />
                    )
                  })}
                </SortableContext>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <SortableContext items={cols.right} strategy={verticalListSortingStrategy}>
                  {cols.right.map(id => {
                    const env = racines.find(r => r.id === id)
                    if (!env) return null
                    return (
                      <EnveloppeDraggable
                        key={env.id}
                        envId={env.id}
                        petiteProps={buildPetiteProps(env, 2)}
                        disabled={!!modeEdition[env.id]}
                        syncing={estSyncing(env.id)}
                        dndActive={dndActive}
                      />
                    )
                  })}
                </SortableContext>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <SortableContext
                items={[...cols.left, ...cols.right]}
                strategy={verticalListSortingStrategy}
              >
                {[...cols.left, ...cols.right].map(id => {
                  const env = racines.find(r => r.id === id)
                  if (!env) return null
                  return (
                    <EnveloppeDraggable
                      key={env.id}
                      envId={env.id}
                      petiteProps={buildPetiteProps(env, 2)}
                      disabled={!!modeEdition[env.id]}
                      syncing={estSyncing(env.id)}
                      dndActive={dndActive}
                    />
                  )
                })}
              </SortableContext>
            </div>
          )}
        </DndContext>

        <BoutonNouvelleEnveloppe
          variant="enveloppe"
          onCreate={async ({ titre, description }) => {
            await actions.creerEnveloppeRacine({ title: titre, description })
          }}
        />
      </section>

      {/* === Modal graphique === */}
      <Graphique
        isOpen={!!graphEnvId}
        onClose={() => setGraphEnvId(null)}
        titre={graphTitre}
        data={graphData}
        mouvements={graphMouvements}
        dernierMvtSigne={graphSigne}
      />

      {/* === Popup suppression === */}
      {popupDel && (
        <PopupSuppression
          data={popupDel}
          onClose={() => setPopupDel(null)}
          actions={actions}
        />
      )}

      {/* === Popup création sous-catégorie === */}
      <PopupConfirmation
        isOpen={!!popupSousCat}
        onClose={() => setPopupSousCat(null)}
        title={popupSousCat ? `Sous-catégorie de « ${popupSousCat.parentName} »` : ''}
        message={
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={titreSousCat}
              onChange={e => setTitreSousCat(e.target.value)}
              placeholder="Nom de la sous-catégorie"
              className="w-full bg-velin-clair border border-[rgba(31,24,16,0.12)] rounded-md px-3 h-10 text-encre placeholder:text-encre-tertiaire focus:outline-none focus:border-or/40 font-serif italic"
            />
            <textarea
              value={descSousCat}
              onChange={e => setDescSousCat(e.target.value)}
              placeholder="Description (optionnelle)"
              rows={2}
              className="w-full bg-velin-clair border border-[rgba(31,24,16,0.12)] rounded-md px-3 py-2 text-encre placeholder:text-encre-tertiaire focus:outline-none focus:border-or/40 font-serif italic resize-none"
            />
          </div>
        }
        actions={[
          { label: 'Annuler', variant: 'ghost', onClick: () => setPopupSousCat(null) },
          {
            label: 'Créer', variant: 'primary',
            onClick: async () => {
              if (!titreSousCat.trim() || !popupSousCat) return
              await actions.creerSousEnveloppe(popupSousCat.parentId, {
                title: titreSousCat,
                description: descSousCat,
              })
              setPopupSousCat(null)
            },
          },
        ]}
      />
    </div>
  )
}

function PopupSuppression({ data, onClose, actions }) {
  const { env, solde, type } = data

  let message, buttons
  if (type === 'simple') {
    message = `Cette enveloppe est vide. Tu peux la supprimer sans conséquence.`
    buttons = [
      { label: 'Annuler', variant: 'ghost', onClick: onClose },
      {
        label: 'Supprimer', variant: 'destructive',
        onClick: async () => { await actions.supprimerEnveloppe(env.id, 'cascade'); onClose() },
      },
    ]
  } else if (type === 'soldeKept') {
    message = (<>Son contenu (<strong>{formatEuros(solde)}</strong>) retournera dans « à répartir ».</>)
    buttons = [
      { label: 'Annuler', variant: 'ghost', onClick: onClose },
      {
        label: 'Supprimer', variant: 'destructive',
        onClick: async () => { await actions.supprimerEnveloppe(env.id, 'cascade'); onClose() },
      },
    ]
  } else if (type === 'creance') {
    message = (<>Son contenu (<strong>{formatEuros(solde)}</strong>) retournera dans « à répartir » comme un remboursement final.</>)
    buttons = [
      { label: 'Annuler', variant: 'ghost', onClick: onClose },
      {
        label: 'Supprimer', variant: 'destructive',
        onClick: async () => { await actions.supprimerEnveloppe(env.id, 'cascade'); onClose() },
      },
    ]
  } else {
    message = (
      <>Cette enveloppe contient des sous-catégories. Choisis comment procéder :
        <ul className="mt-2 space-y-1 text-sm">
          <li>• <strong>Remonter les enfants</strong> : les sous-cats deviennent autonomes au niveau supérieur.</li>
          <li>• <strong>Supprimer en cascade</strong> : tout est supprimé, soldes libérés dans « à répartir ».</li>
        </ul>
      </>
    )
    buttons = [
      { label: 'Annuler', variant: 'ghost', onClick: onClose },
      {
        label: 'Remonter les enfants', variant: 'primary',
        onClick: async () => { await actions.supprimerEnveloppe(env.id, 'promote'); onClose() },
      },
      {
        label: 'Supprimer en cascade', variant: 'destructive',
        onClick: async () => { await actions.supprimerEnveloppe(env.id, 'cascade'); onClose() },
      },
    ]
  }

  return (
    <PopupConfirmation
      isOpen={true}
      onClose={onClose}
      title={`Supprimer « ${env.title} » ?`}
      message={message}
      tone="destructive"
      actions={buttons}
    />
  )
}
