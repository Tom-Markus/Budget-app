/**
 * src/pages/GraphesEtDettes.jsx — version Bloc G
 * ----------------------------------------------------------------------------
 * Bloc F-bis + drag & drop des créances (dnd-kit) + SyncingDot.
 *
 * EnveloppeCreance n'a pas de poignée dédiée → la carte entière est la zone
 * de drag (souris : 8 px ; tactile : appui 500 ms ; clics préservés).
 * ----------------------------------------------------------------------------
 */
import { useState, useCallback } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Trash2, GripHorizontal } from 'lucide-react'
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
import Camembert from '../components/Camembert'
import EnveloppeCreance from '../components/EnveloppeCreance'
import EnveloppeEpargne from '../components/EnveloppeEpargne'
import GrandLivre from '../components/GrandLivre'
import Graphique from '../components/Graphique'
import BoutonNouvelleEnveloppe from '../components/BoutonNouvelleEnveloppe'
import PopupConfirmation from '../components/PopupConfirmation'
import { LoaderNoble, SyncingDot } from '../components/Toast'
import { dernierMouvement, reconstruireHistorique, preparerCourbe } from '../lib/calculs'
import { formatEuros, formatDateHistorique } from '../lib/formatters'

const PERIODES = [
  { id: '7J', label: '7 jours', jours: 7, agreger: false },
  { id: '30J', label: '30 jours', jours: 30, agreger: false },
  { id: '3M', label: '3 mois', jours: 90, agreger: true },
  { id: 'TOUT', label: 'Tout', jours: null, agreger: true },
]

function CourbeTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const { date, valeur } = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-md" style={{
      background: 'var(--velin-clair)', boxShadow: 'var(--shadow-md)',
      border: '1px solid var(--border-doux)',
    }}>
      <div className="t-label-noble">{formatDateHistorique(new Date(date))}</div>
      <div className="font-sans font-medium text-encre tabular-nums mt-0.5">
        {formatEuros(valeur)}
      </div>
    </div>
  )
}

// ----- Wrapper sortable d'une créance (drag depuis toute la carte) -----
function CreanceDraggable({ creanceId, disabled, syncing, children }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: creanceId, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : 'auto',
    boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
    borderRadius: isDragging ? 'var(--radius-lg)' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} data-creance-id={creanceId}>
      <button
        type="button"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label="Réordonner par glisser-déposer"
        className={`
          w-full flex justify-center py-1 rounded-t-md
          text-encre-tertiaire transition-colors duration-200
          ${disabled
            ? 'opacity-0 pointer-events-none'
            : 'cursor-grab active:cursor-grabbing hover:text-or hover:bg-or/5'}
        `}
      >
        <GripHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {syncing && (
        <span className="absolute top-2.5 right-2.5 z-30">
          <SyncingDot active />
        </span>
      )}
      {children}
    </div>
  )
}

// ----- Wrapper sortable d'un compte épargne (même mécanique que les créances) -----
function EpargneDraggable({ epargneId, disabled, syncing, children }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: epargneId, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : 'auto',
    boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
    borderRadius: isDragging ? 'var(--radius-lg)' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} data-epargne-id={epargneId}>
      <button
        type="button"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label="Réordonner par glisser-déposer"
        className={`
          w-full flex justify-center py-1 rounded-t-md
          text-encre-tertiaire transition-colors duration-200
          ${disabled
            ? 'opacity-0 pointer-events-none'
            : 'cursor-grab active:cursor-grabbing hover:text-vert hover:bg-vert/5'}
        `}
      >
        <GripHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {syncing && (
        <span className="absolute top-2.5 right-2.5 z-30">
          <SyncingDot active />
        </span>
      )}
      {children}
    </div>
  )
}

export default function GraphesEtDettes() {
  const {
    loading, patrimoine, racines, creances, epargnes,
    envelopes, mouvements,
    soldeDe, actions, estSyncing,
  } = useApp()

  const chartGrid = 'var(--chart-grid)'
  const chartAxis = 'var(--chart-axis)'

  const [periodeCourbe, setPeriodeCourbe] = useState('30J')
  const [inputCreance, setInputCreance] = useState({})
  const [editCreance, setEditCreance] = useState({})
  const [popupDelCreance, setPopupDelCreance] = useState(null)
  const [graphCreanceId, setGraphCreanceId] = useState(null)

  const [inputEpargne, setInputEpargne] = useState({})
  const [editEpargne, setEditEpargne] = useState({})
  const [popupDelEpargne, setPopupDelEpargne] = useState(null)
  const [graphEpargneId, setGraphEpargneId] = useState(null)

  // Brouillons de titre en mode édition (remplis par onTitreChange des
  // composants enfants — remplace l'ancienne lecture fragile du DOM)
  const [draftTitres, setDraftTitres] = useState({})
  const onTitreChange = useCallback((envId, value) => {
    setDraftTitres(s => ({ ...s, [envId]: value }))
  }, [])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
  )

  const hasUndoableCreance = useCallback((envId) => {
    return mouvements.some(m =>
      m.envelope_id === envId && !m.is_undone &&
      ['creance_add', 'creance_repaid'].includes(m.type)
    )
  }, [mouvements])

  const dirCreance = useCallback((env) => {
    const mv = dernierMouvement(env.id, envelopes, mouvements)
    if (!mv) return { direction: 'transfert', signeMontant: 0 }
    if (mv.type === 'creance_add')    return { direction: 'up',   signeMontant: Number(mv.amount) }
    if (mv.type === 'creance_repaid') return { direction: 'down', signeMontant: -Number(mv.amount) }
    return { direction: 'up', signeMontant: 0 }
  }, [envelopes, mouvements])

  const historiqueCreance = useCallback((envId) => {
    return mouvements
      .filter(m => !m.is_undone && m.envelope_id === envId
                   && ['creance_add', 'creance_repaid'].includes(m.type))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(m => ({
        date: m.created_at,
        montant: m.type === 'creance_add' ? Number(m.amount) : -Number(m.amount),
        note: m.note,
      }))
  }, [mouvements])

  const toggleEditCreance = useCallback((env) => {
    const wasEditing = !!editCreance[env.id]
    if (wasEditing) {
      const draft = draftTitres[env.id]
      if (draft !== undefined && draft.trim() && draft.trim() !== env.title) {
        actions.modifierEnveloppe(env.id, { title: draft.trim() })
      }
      setDraftTitres(s => { const n = { ...s }; delete n[env.id]; return n })
    }
    setEditCreance(s => {
      const next = { ...s }
      if (wasEditing) delete next[env.id]
      else next[env.id] = true
      return next
    })
  }, [editCreance, draftTitres, actions])

  const onValidateInputCreance = useCallback((envId) => (type, { amount, note }) => {
    if (type === '+')      actions.ajouterCreance(envId, amount, note)
    else if (type === '-') actions.rembourserCreance(envId, amount, note)
    setInputCreance(s => ({ ...s, [envId]: null }))
  }, [actions])

  const handleDragStart = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = creances.findIndex(c => c.id === active.id)
    const newIndex = creances.findIndex(c => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const nouvelOrdre = arrayMove(creances, oldIndex, newIndex)
    actions.reordonner(nouvelOrdre.map(c => c.id))
  }, [creances, actions])

  // ----- Helpers comptes épargne -----
  const hasUndoableEpargne = useCallback((envId) => {
    return mouvements.some(m =>
      m.envelope_id === envId && !m.is_undone &&
      ['savings_add', 'savings_withdraw'].includes(m.type)
    )
  }, [mouvements])

  const dirEpargne = useCallback((env) => {
    const mv = dernierMouvement(env.id, envelopes, mouvements)
    if (!mv) return { direction: 'transfert', signeMontant: 0 }
    if (mv.type === 'savings_add')      return { direction: 'up',   signeMontant: Number(mv.amount) }
    if (mv.type === 'savings_withdraw') return { direction: 'down', signeMontant: -Number(mv.amount) }
    return { direction: 'up', signeMontant: 0 }
  }, [envelopes, mouvements])

  const historiqueEpargne = useCallback((envId) => {
    return mouvements
      .filter(m => !m.is_undone && m.envelope_id === envId
                   && ['savings_add', 'savings_withdraw'].includes(m.type))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(m => ({
        date: m.created_at,
        montant: m.type === 'savings_add' ? Number(m.amount) : -Number(m.amount),
        note: m.note,
      }))
  }, [mouvements])

  const toggleEditEpargne = useCallback((env) => {
    const wasEditing = !!editEpargne[env.id]
    if (wasEditing) {
      const draft = draftTitres[env.id]
      if (draft !== undefined && draft.trim() && draft.trim() !== env.title) {
        actions.modifierEnveloppe(env.id, { title: draft.trim() })
      }
      setDraftTitres(s => { const n = { ...s }; delete n[env.id]; return n })
    }
    setEditEpargne(s => {
      const next = { ...s }
      if (wasEditing) delete next[env.id]
      else next[env.id] = true
      return next
    })
  }, [editEpargne, draftTitres, actions])

  const onValidateInputEpargne = useCallback((envId) => (type, { amount, note }) => {
    if (type === '+')      actions.ajouterEpargne(envId, amount, note)
    else if (type === '-') actions.retirerEpargne(envId, amount, note)
    setInputEpargne(s => ({ ...s, [envId]: null }))
  }, [actions])

  const handleDragEndEpargne = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = epargnes.findIndex(e => e.id === active.id)
    const newIndex = epargnes.findIndex(e => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const nouvelOrdre = arrayMove(epargnes, oldIndex, newIndex)
    actions.reordonner(nouvelOrdre.map(e => e.id))
  }, [epargnes, actions])

  // ----- Données graphique épargne -----
  let graphEpData = []
  let graphEpMouvements = []
  let graphEpTitre = ''
  let graphEpSigne = 'positif'
  if (graphEpargneId) {
    const env = envelopes.find(e => e.id === graphEpargneId)
    if (env) {
      graphEpTitre = env.title
      const pts = reconstruireHistorique(graphEpargneId, envelopes, mouvements)
      graphEpData = pts.map(p => ({ date: p.date.toISOString(), valeur: p.solde }))
      const mvsBruts = mouvements
        .filter(m => !m.is_undone && m.envelope_id === graphEpargneId
          && ['savings_add', 'savings_withdraw'].includes(m.type))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      graphEpMouvements = mvsBruts.map(m => ({
        date: m.created_at,
        montant: m.type === 'savings_add' ? Number(m.amount) : -Number(m.amount),
        note: m.note,
      }))
      const last = mvsBruts[0]
      if (last) graphEpSigne = last.type === 'savings_add' ? 'positif' : 'negatif'
    }
  }

  // ----- Données graphique créance -----
  let graphData = []
  let graphMouvements = []
  let graphTitre = ''
  let graphSigne = 'positif'
  if (graphCreanceId) {
    const env = envelopes.find(e => e.id === graphCreanceId)
    if (env) {
      graphTitre = env.title
      const pts = reconstruireHistorique(graphCreanceId, envelopes, mouvements)
      graphData = pts.map(p => ({ date: p.date.toISOString(), valeur: p.solde }))
      const mvsBruts = mouvements
        .filter(m => !m.is_undone && m.envelope_id === graphCreanceId
          && ['creance_add', 'creance_repaid'].includes(m.type))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      graphMouvements = mvsBruts.map(m => ({
        date: m.created_at,
        montant: m.type === 'creance_add' ? Number(m.amount) : -Number(m.amount),
        note: m.note,
      }))
      const last = mvsBruts[0]
      if (last) graphSigne = last.type === 'creance_add' ? 'positif' : 'negatif'
    }
  }

  if (loading) return <LoaderNoble message="Lecture des dettes..." />
  if (!patrimoine) {
    return (
      <div className="surface-velin p-6 max-w-2xl mx-auto">
        <p style={{ color: 'var(--rouge)' }}>
          Patrimoine introuvable — déconnecte-toi et reconnecte-toi, ou contacte le développeur.
        </p>
      </div>
    )
  }

  // Camembert
  const donneesCamembert = []
  for (const r of racines) {
    const s = soldeDe(r.id)
    if (s > 0) donneesCamembert.push({ nom: r.title, valeur: s })
  }
  const aRepartirValeur = soldeDe(patrimoine.id)
    - donneesCamembert.reduce((a, d) => a + d.valeur, 0)
  if (aRepartirValeur > 0.001) donneesCamembert.push({ nom: 'À répartir', valeur: aRepartirValeur })

  // Courbe Patrimoine
  const pointsPatrimoine = reconstruireHistorique(patrimoine.id, envelopes, mouvements)
  const periodeObj = PERIODES.find(p => p.id === periodeCourbe)
  const courbeAffichee = preparerCourbe(
    pointsPatrimoine.map(p => ({ date: p.date, valeur: p.solde })),
    periodeObj?.jours ?? null,
    !!periodeObj?.agreger,
  )
  const aHistorique = pointsPatrimoine.length > 0

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* === 1. Camembert === */}
      <section className="surface-velin p-6 md:p-8">
        <p className="t-label">Répartition</p>
        <h2 className="t-h2 mt-2">Où est ton argent</h2>
        {donneesCamembert.length === 0 ? (
          <p className="t-body-secondaire mt-6 italic text-center py-8">
            Ton Patrimoine est vide. Reçois un montant pour voir la répartition.
          </p>
        ) : (
          <div className="mt-4">
            <Camembert donnees={donneesCamembert} />
          </div>
        )}
      </section>

      {/* === 2. Courbe Patrimoine === */}
      <section className="surface-velin p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="t-label">Évolution</p>
            <h2 className="t-h2 mt-2">Patrimoine au fil du temps</h2>
          </div>
          <div className="flex gap-1" role="group" aria-label="Période d'affichage">
            {PERIODES.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodeCourbe(p.id)}
                aria-pressed={periodeCourbe === p.id}
                className={`
                  px-3 h-8 rounded-md text-xs font-medium transition-colors duration-200
                  ${periodeCourbe === p.id
                    ? 'bg-nuit text-velin-clair'
                    : 'bg-transparent text-encre-secondaire hover:bg-velin-fonce'}
                `}
              >
                {p.id}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-64">
          {!aHistorique && (
            <p className="t-meta italic text-center pb-2">Pas encore d'historique</p>
          )}
          <ResponsiveContainer width="100%" height={!aHistorique ? '85%' : '100%'}>
            <AreaChart data={courbeAffichee} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="patrimoine-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--encre)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="var(--encre)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDateHistorique(new Date(d))}
                tick={{ fontSize: 11, fill: 'var(--encre-tertiaire)' }}
                axisLine={{ stroke: chartAxis }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(v) => v.toLocaleString('fr-BE', { maximumFractionDigits: 0 })}
                tick={{ fontSize: 11, fill: 'var(--encre-tertiaire)' }}
                axisLine={{ stroke: chartAxis }}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CourbeTooltip />} />
              <Area
                type="monotone"
                dataKey="valeur"
                stroke="var(--encre)"
                strokeWidth={2}
                fill="url(#patrimoine-fill)"
                dot={false}
                activeDot={{ r: 5, fill: 'var(--or)', strokeWidth: 0 }}
                isAnimationActive={aHistorique}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* === 3. Le Grand Livre (journal des mouvements) === */}
      <GrandLivre envelopes={envelopes} mouvements={mouvements} />

      {/* === 4. Créances (drag & drop) === */}
      <section className="flex flex-col gap-4">
        {creances.length > 0 && (
          <h2 className="t-label-noble px-1">Personnes qui te doivent</h2>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={creances.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {creances.map(c => {
              const { direction, signeMontant } = dirCreance(c)
              const enEdition = !!editCreance[c.id]
              const solde = soldeDe(c.id)
              return (
                <CreanceDraggable
                  key={c.id}
                  creanceId={c.id}
                  disabled={enEdition}
                  syncing={estSyncing(c.id)}
                >
                  <div className="flex flex-col gap-2">
                    <EnveloppeCreance
                      nom={c.title}
                      montant={solde}
                      dernierMouvement={signeMontant}
                      direction={direction}
                      historique={historiqueCreance(c.id)}
                      modeEdition={enEdition}
                      canAnnuler={hasUndoableCreance(c.id)}
                      onTitreChange={(v) => onTitreChange(c.id, v)}
                      onPlus={()  => setInputCreance(s => ({ ...s, [c.id]: '+' }))}
                      onMinus={() => setInputCreance(s => ({ ...s, [c.id]: '-' }))}
                      onUndo={()  => actions.annulerDernier(c.id)}
                      onEdit={()  => toggleEditCreance(c)}
                      onGraphique={() => setGraphCreanceId(c.id)}
                      actionInputActive={inputCreance[c.id] || null}
                      onValidateInput={onValidateInputCreance(c.id)}
                      onCancelInput={() => setInputCreance(s => ({ ...s, [c.id]: null }))}
                    />
                    {enEdition && (
                      <button
                        type="button"
                        onClick={() => setPopupDelCreance({ env: c, solde })}
                        className="
                          self-end inline-flex items-center gap-2 px-3 h-9 rounded-md
                          bg-transparent border border-rouge/40 text-rouge
                          hover:bg-rouge/10 transition-colors duration-200
                          text-sm font-medium
                          focus-visible:outline-2 focus-visible:outline-rouge focus-visible:outline-offset-2
                        "
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                        Supprimer cette créance
                      </button>
                    )}
                  </div>
                </CreanceDraggable>
              )
            })}
          </SortableContext>
        </DndContext>

        <BoutonNouvelleEnveloppe
          variant="creance"
          onCreate={async ({ titre }) => {
            await actions.creerCreance({ title: titre })
          }}
        />
      </section>

      {/* === 5. Comptes épargne (indépendants — drag & drop) === */}
      <section className="flex flex-col gap-4">
        <h2 className="t-label-noble px-1">Comptes épargne</h2>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEndEpargne}
        >
          <SortableContext
            items={epargnes.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {epargnes.map(ep => {
              const { direction, signeMontant } = dirEpargne(ep)
              const enEdition = !!editEpargne[ep.id]
              const solde = soldeDe(ep.id)
              const recurrence = ep.recurring_amount != null
                ? { amount: Number(ep.recurring_amount), interval: ep.recurring_interval }
                : null
              return (
                <EpargneDraggable
                  key={ep.id}
                  epargneId={ep.id}
                  disabled={enEdition}
                  syncing={estSyncing(ep.id)}
                >
                  <div className="flex flex-col gap-2">
                    <EnveloppeEpargne
                      nom={ep.title}
                      montant={solde}
                      dernierMouvement={signeMontant}
                      direction={direction}
                      historique={historiqueEpargne(ep.id)}
                      modeEdition={enEdition}
                      canAnnuler={hasUndoableEpargne(ep.id)}
                      recurrence={recurrence}
                      onTitreChange={(v) => onTitreChange(ep.id, v)}
                      onPlus={()  => setInputEpargne(s => ({ ...s, [ep.id]: '+' }))}
                      onMinus={() => setInputEpargne(s => ({ ...s, [ep.id]: '-' }))}
                      onUndo={()  => actions.annulerDernier(ep.id)}
                      onEdit={()  => toggleEditEpargne(ep)}
                      onGraphique={() => setGraphEpargneId(ep.id)}
                      onSaveRecurrence={(amount, interval) => actions.definirRecurrenceEpargne(ep.id, amount, interval)}
                      onDisableRecurrence={() => actions.definirRecurrenceEpargne(ep.id, null, null)}
                      actionInputActive={inputEpargne[ep.id] || null}
                      onValidateInput={onValidateInputEpargne(ep.id)}
                      onCancelInput={() => setInputEpargne(s => ({ ...s, [ep.id]: null }))}
                    />
                    {enEdition && (
                      <button
                        type="button"
                        onClick={() => setPopupDelEpargne({ env: ep, solde })}
                        className="
                          self-end inline-flex items-center gap-2 px-3 h-9 rounded-md
                          bg-transparent border border-rouge/40 text-rouge
                          hover:bg-rouge/10 transition-colors duration-200
                          text-sm font-medium
                          focus-visible:outline-2 focus-visible:outline-rouge focus-visible:outline-offset-2
                        "
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                        Supprimer ce compte épargne
                      </button>
                    )}
                  </div>
                </EpargneDraggable>
              )
            })}
          </SortableContext>
        </DndContext>

        <BoutonNouvelleEnveloppe
          variant="epargne"
          onCreate={async ({ titre }) => {
            await actions.creerEpargne({ title: titre })
          }}
        />
      </section>

      <Graphique
        isOpen={!!graphCreanceId}
        onClose={() => setGraphCreanceId(null)}
        titre={graphTitre}
        data={graphData}
        mouvements={graphMouvements}
        dernierMvtSigne={graphSigne}
      />

      <Graphique
        isOpen={!!graphEpargneId}
        onClose={() => setGraphEpargneId(null)}
        titre={graphEpTitre}
        data={graphEpData}
        mouvements={graphEpMouvements}
        dernierMvtSigne={graphEpSigne}
      />

      {popupDelEpargne && (
        <PopupConfirmation
          isOpen={true}
          onClose={() => setPopupDelEpargne(null)}
          title={`Supprimer « ${popupDelEpargne.env.title} » ?`}
          tone="destructive"
          message={popupDelEpargne.solde > 0
            ? <>Ce compte épargne contient <strong>{formatEuros(popupDelEpargne.solde)}</strong>. La suppression effacera ce compte et tout son historique. (Ce montant n'est lié à rien d'autre sur le site.)</>
            : `Ce compte épargne est vide. Tu peux le supprimer sans conséquence.`}
          actions={[
            { label: 'Annuler', variant: 'ghost', onClick: () => setPopupDelEpargne(null) },
            {
              label: 'Supprimer', variant: 'destructive',
              onClick: async () => {
                await actions.supprimerEnveloppe(popupDelEpargne.env.id, 'cascade')
                setPopupDelEpargne(null)
              },
            },
          ]}
        />
      )}

      {popupDelCreance && (
        <PopupConfirmation
          isOpen={true}
          onClose={() => setPopupDelCreance(null)}
          title={`Supprimer « ${popupDelCreance.env.title} » ?`}
          tone="destructive"
          message={popupDelCreance.solde > 0
            ? <>Son solde (<strong>{formatEuros(popupDelCreance.solde)}</strong>) retournera dans « à répartir » comme un remboursement final.</>
            : `Cette créance est soldée. Tu peux la supprimer sans conséquence.`}
          actions={[
            { label: 'Annuler', variant: 'ghost', onClick: () => setPopupDelCreance(null) },
            {
              label: 'Supprimer', variant: 'destructive',
              onClick: async () => {
                await actions.supprimerEnveloppe(popupDelCreance.env.id, 'cascade')
                setPopupDelCreance(null)
              },
            },
          ]}
        />
      )}
    </div>
  )
}
