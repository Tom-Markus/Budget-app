import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Plus, X, Trash2, Lock, CheckCircle2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import PopupConfirmation from '../components/PopupConfirmation'
import {
  chargerInvestissements,
  ajouterInvestissement,
  cloturerInvestissement,
  supprimerInvestissement,
} from '../lib/investmentsMutations'

// ============================================================================
// Config types
// ============================================================================
const TYPES = {
  action: { label: 'Action',   bg: 'bg-nuit/10',      text: 'text-nuit-clair' },
  etf:    { label: 'ETF',      bg: 'bg-vert/10',      text: 'text-vert'       },
  crypto: { label: 'Crypto',   bg: 'bg-or/15',        text: 'text-or-fonce'   },
  or:     { label: 'Or (XAU)', bg: 'bg-bordeaux/10',  text: 'text-bordeaux-clair' },
}

// ============================================================================
// Formatters
// ============================================================================
function formatEur(n) {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function formatPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + ' %'
}

function formatDate(d) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(d + 'T00:00:00'))
}

// ============================================================================
// Primitives UI réutilisables (scope local à ce fichier)
// ============================================================================
const inputCls =
  'w-full bg-velin-clair border border-[rgba(31,24,16,0.12)] rounded-md px-3 h-10 ' +
  'text-encre placeholder:text-encre-tertiaire font-sans text-sm ' +
  'focus:outline-none focus:border-or/40 transition-colors duration-200'

function Champ({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.75rem] uppercase tracking-wider text-encre-tertiaire font-medium">
        {label}
      </span>
      {children}
    </div>
  )
}

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_ABREV = ['L','M','M','J','V','S','D']

function DatePicker({ value, onChange, placeholder = 'JJ / MM / AAAA' }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => value ? new Date(value + 'T00:00:00') : new Date())
  const triggerRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (value) setView(new Date(value + 'T00:00:00'))
  }, [value])

  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (!triggerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  function handleOpen() {
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 272) })
    setOpen(true)
  }

  const selected = value ? new Date(value + 'T00:00:00') : null
  const today = new Date(); today.setHours(0,0,0,0)
  const year = view.getFullYear()
  const month = view.getMonth()

  const days = []
  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  for (let i = startDow - 1; i >= 0; i--)       days.push({ d: new Date(year, month, -i),     other: true })
  for (let i = 1; i <= new Date(year, month+1, 0).getDate(); i++) days.push({ d: new Date(year, month, i), other: false })
  while (days.length < 42)                        days.push({ d: new Date(year, month+1, days.length - startDow - new Date(year,month+1,0).getDate() + 1), other: true })

  function pick(d) {
    onChange(d.toLocaleDateString('fr-CA')) // YYYY-MM-DD
    setOpen(false)
  }

  const display = selected
    ? new Intl.DateTimeFormat('fr-BE', { day:'2-digit', month:'2-digit', year:'numeric' }).format(selected)
    : ''

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={handleOpen}
        className={`${inputCls} flex items-center justify-between gap-2 cursor-pointer`}
      >
        <span className={display ? 'text-encre' : 'text-encre-tertiaire'}>{display || placeholder}</span>
        <Calendar size={14} className="text-encre-tertiaire shrink-0" strokeWidth={1.75} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 300 }}
              className="surface-velin p-3"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Navigation mois */}
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={() => setView(new Date(year, month - 1, 1))}
                  className="h-7 w-7 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-150"
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
                <span className="font-serif italic text-encre text-sm">
                  {MOIS[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={() => setView(new Date(year, month + 1, 1))}
                  className="h-7 w-7 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-150"
                >
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>

              {/* En-têtes jours */}
              <div className="grid grid-cols-7 mb-1">
                {JOURS_ABREV.map((j, i) => (
                  <div key={i} className="text-center text-[0.6rem] uppercase tracking-wider text-encre-tertiaire py-1 font-medium">
                    {j}
                  </div>
                ))}
              </div>

              {/* Grille jours */}
              <div className="grid grid-cols-7 gap-px">
                {days.map(({ d, other }, i) => {
                  const isSel   = selected && d.toDateString() === selected.toDateString()
                  const isToday = d.toDateString() === today.toDateString()
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pick(d)}
                      className={[
                        'h-8 w-full rounded-sm text-xs font-sans transition-colors duration-100 flex items-center justify-center',
                        other   ? 'text-encre-tertiaire/35' : 'text-encre-secondaire',
                        isSel   ? 'bg-bordeaux text-velin-clair font-semibold' : '',
                        isToday && !isSel ? 'bg-or/20 text-or-fonce font-semibold' : '',
                        !isSel  ? 'hover:bg-velin-fonce' : '',
                      ].join(' ')}
                    >
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// Modal générique (portal, backdrop blur, escape)
// ============================================================================
function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          role="dialog" aria-modal="true"
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(14,31,58,0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-lg surface-velin p-6 md:p-7 flex flex-col gap-5 overflow-y-auto max-h-[90vh]"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute top-3 right-3 p-2 rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-200"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function BoutonSubmit({ disabled, loading, label }) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`h-10 px-5 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2
        ${!disabled && !loading
          ? 'bg-bordeaux text-velin-clair hover:bg-bordeaux-clair'
          : 'bg-encre/10 text-encre-tertiaire cursor-not-allowed'
        }`}
    >
      {loading && (
        <span className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
      )}
      {label}
    </button>
  )
}

// ============================================================================
// Formulaire — Ajouter un investissement
// ============================================================================
const FORM_VIDE = { type: 'action', nom: '', ticker: '', date_achat: '', cours_achat: '', montant_paye: '', notes: '' }

function FormulaireAjout({ isOpen, onClose, onSubmit, loading }) {
  const [form, setForm] = useState(FORM_VIDE)

  useEffect(() => {
    if (isOpen) setForm(FORM_VIDE)
  }, [isOpen])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const cours   = Number(form.cours_achat)
  const montant = Number(form.montant_paye)
  const quantite = cours > 0 && montant > 0 ? montant / cours : null

  const valide = form.nom.trim() && form.date_achat && cours > 0 && montant > 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!valide) return
    onSubmit({
      type: form.type,
      nom: form.nom.trim(),
      ticker: form.ticker.trim() || null,
      date_achat: form.date_achat,
      prix_achat: cours,
      quantite: montant / cours,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="font-serif italic font-medium text-2xl text-encre pr-8">
        Nouvel investissement
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Champ label="Type">
          <select value={form.type} onChange={set('type')} className={inputCls}>
            {Object.entries(TYPES).map(([id, t]) => (
              <option key={id} value={id}>{t.label}</option>
            ))}
          </select>
        </Champ>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="Nom *">
            <input
              type="text" value={form.nom} onChange={set('nom')}
              placeholder="ex: Apple" className={inputCls} required
            />
          </Champ>
          <Champ label="Ticker">
            <input
              type="text" value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              placeholder="ex: AAPL" maxLength={12} className={inputCls}
            />
          </Champ>
        </div>

        <Champ label="Date d'achat *">
          <DatePicker value={form.date_achat} onChange={(v) => setForm((f) => ({ ...f, date_achat: v }))} />
        </Champ>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="Cours à l'achat (€) *">
            <input
              type="number" step="any" min="0"
              value={form.cours_achat} onChange={set('cours_achat')}
              placeholder="ex : 182.50" className={inputCls} required
            />
          </Champ>
          <Champ label="Montant payé (€) *">
            <input
              type="number" step="any" min="0"
              value={form.montant_paye} onChange={set('montant_paye')}
              placeholder="ex : 1 000" className={inputCls} required
            />
          </Champ>
        </div>

        {quantite !== null && (
          <p className="text-xs text-encre-tertiaire -mt-1">
            Quantité calculée : <span className="text-encre font-medium">{quantite.toFixed(6).replace(/\.?0+$/, '')}</span>
          </p>
        )}

        <Champ label="Notes">
          <input
            type="text" value={form.notes} onChange={set('notes')}
            placeholder="Optionnel…" className={inputCls}
          />
        </Champ>

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button" onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-encre-secondaire hover:bg-velin-fonce transition-colors duration-200"
          >
            Annuler
          </button>
          <BoutonSubmit disabled={!valide} loading={loading} label="Enregistrer" />
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Formulaire — Clôturer (vendre)
// ============================================================================
function FormulaireCloturer({ investissement, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ date_vente: '', prix_vente: '' })

  useEffect(() => {
    if (investissement) setForm({ date_vente: '', prix_vente: '' })
  }, [investissement])

  const prixVente = Number(form.prix_vente)
  const valide = form.date_vente && prixVente > 0

  const pnl = investissement && prixVente > 0
    ? (prixVente - investissement.prix_achat) * investissement.quantite
    : null
  const pnlPct = investissement && prixVente > 0
    ? (prixVente / investissement.prix_achat - 1) * 100
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!valide) return
    onSubmit({ date_vente: form.date_vente, prix_vente: prixVente })
  }

  return (
    <Modal isOpen={!!investissement} onClose={onClose}>
      <h2 className="font-serif italic font-medium text-2xl text-encre pr-8">
        Clôturer — {investissement?.nom}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Champ label="Date de vente *">
          <DatePicker value={form.date_vente} onChange={(v) => setForm((f) => ({ ...f, date_vente: v }))} />
        </Champ>

        <Champ label="Prix de vente (€) *">
          <input
            type="number" step="any" min="0"
            value={form.prix_vente}
            onChange={(e) => setForm((f) => ({ ...f, prix_vente: e.target.value }))}
            placeholder="0.00" className={inputCls} required
          />
        </Champ>

        {pnl !== null && (
          <div className="rounded-md bg-velin-fonce px-4 py-3 text-sm">
            P&L estimé :{' '}
            <span className={`font-medium ${pnl >= 0 ? 'text-vert' : 'text-rouge'}`}>
              {formatEur(pnl)} ({formatPct(pnlPct)})
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button" onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-encre-secondaire hover:bg-velin-fonce transition-colors duration-200"
          >
            Annuler
          </button>
          <BoutonSubmit disabled={!valide} loading={loading} label="Confirmer la vente" />
        </div>
      </form>
    </Modal>
  )
}

// ============================================================================
// Composants affichage
// ============================================================================
function StatCard({ label, value, sub, couleur }) {
  return (
    <div className="surface-velin p-4 flex flex-col gap-1">
      <span className="text-[0.7rem] uppercase tracking-wider text-encre-tertiaire font-medium">
        {label}
      </span>
      <span className={`font-serif italic text-2xl ${couleur || 'text-encre'}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-encre-tertiaire">{sub}</span>}
    </div>
  )
}

function TypeBadge({ type }) {
  const cfg = TYPES[type] || { label: type, bg: 'bg-encre/10', text: 'text-encre-secondaire' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[0.65rem] font-medium uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function CarteInvestissement({ inv, onCloturer, onSupprimer, cloture }) {
  const montantInvesti = inv.prix_achat * inv.quantite
  const estCloture = inv.date_vente && inv.prix_vente
  const pnl = estCloture ? (inv.prix_vente - inv.prix_achat) * inv.quantite : null
  const pnlPct = estCloture ? (inv.prix_vente / inv.prix_achat - 1) * 100 : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className={`surface-velin p-4 flex flex-col gap-3 ${cloture ? 'opacity-60' : ''}`}
      style={cloture
        ? { borderLeft: '3px solid rgba(31,24,16,0.18)' }
        : { borderLeft: '3px solid var(--vert)' }
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <TypeBadge type={inv.type} />
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-serif italic text-lg text-encre truncate">{inv.nom}</span>
            {inv.ticker && (
              <span className="text-xs text-encre-tertiaire uppercase tracking-wider shrink-0">
                {inv.ticker}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {!estCloture && onCloturer && (
            <button
              onClick={() => onCloturer(inv)}
              title="Clôturer la position"
              className="h-8 w-8 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-bordeaux hover:bg-bordeaux/10 transition-colors duration-200"
            >
              <Lock size={14} strokeWidth={1.75} />
            </button>
          )}
          <button
            onClick={() => onSupprimer(inv.id)}
            title="Supprimer"
            className="h-8 w-8 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-rouge hover:bg-rouge/10 transition-colors duration-200"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 text-xs text-encre-tertiaire">
        <span>Achat {formatDate(inv.date_achat)}</span>
        {estCloture && (
          <>
            <span aria-hidden="true">→</span>
            <span>Vente {formatDate(inv.date_vente)}</span>
          </>
        )}
      </div>

      {/* Montants + P&L */}
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs text-encre-tertiaire leading-5">
          {inv.quantite} × {formatEur(inv.prix_achat)}
          <br />
          <span className="text-encre font-medium text-sm">{formatEur(montantInvesti)}</span>
        </div>

        {estCloture && pnl !== null && (
          <div className={`text-right font-medium text-sm ${pnl >= 0 ? 'text-vert' : 'text-rouge'}`}>
            {pnl >= 0 ? '+' : ''}{formatEur(pnl)}
            <br />
            <span className="text-xs">{formatPct(pnlPct)}</span>
          </div>
        )}
      </div>

      {inv.notes && (
        <p className="text-xs text-encre-tertiaire italic border-t border-[rgba(31,24,16,0.06)] pt-2 mt-1">
          {inv.notes}
        </p>
      )}
    </motion.div>
  )
}

// ============================================================================
// Page principale
// ============================================================================
export default function Investments() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [investissements, setInvestissements] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalAjout, setModalAjout] = useState(false)
  const [cloturerTarget, setCloturerTarget] = useState(null)
  const [supprimerTarget, setSupprimerTarget] = useState(null)

  const charger = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setInvestissements(await chargerInvestissements(user.id))
    } catch (err) {
      showToast({ type: 'erreur', message: err.message })
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  useEffect(() => { charger() }, [charger])

  async function handleAjouter(data) {
    setSaving(true)
    try {
      await ajouterInvestissement(user.id, data)
      setModalAjout(false)
      await charger()
      showToast({ message: `${data.nom} ajouté.` })
    } catch (err) {
      showToast({ type: 'erreur', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleCloturer(data) {
    setSaving(true)
    try {
      await cloturerInvestissement(cloturerTarget.id, data)
      const nom = cloturerTarget.nom
      setCloturerTarget(null)
      await charger()
      showToast({ message: `${nom} clôturé.` })
    } catch (err) {
      showToast({ type: 'erreur', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleSupprimer() {
    const id = supprimerTarget
    setSupprimerTarget(null)
    try {
      await supprimerInvestissement(id)
      setInvestissements((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      showToast({ type: 'erreur', message: err.message })
    }
  }

  const ouvertes  = investissements.filter((i) => !i.date_vente)
  const cloturees = investissements.filter((i) => i.date_vente)

  const totalInvesti      = investissements.reduce((s, i) => s + i.prix_achat * i.quantite, 0)
  const pnlRealise        = cloturees.reduce((s, i) => s + (i.prix_vente - i.prix_achat) * i.quantite, 0)
  const valeurPortefeuille = totalInvesti + pnlRealise

  return (
    <>
      {/* En-tête de page */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif italic text-3xl text-encre">Investments</h1>
        <button
          onClick={() => setModalAjout(true)}
          className="flex items-center gap-2 h-10 px-4 bg-bordeaux text-velin-clair rounded-md text-sm font-medium hover:bg-bordeaux-clair transition-colors duration-200"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Ajouter
        </button>
      </div>

      {/* Résumé chiffres clés */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard
          label="Portefeuille"
          value={formatEur(valeurPortefeuille)}
          sub={`investi ${formatEur(totalInvesti)}`}
          couleur={valeurPortefeuille >= totalInvesti ? 'text-encre' : 'text-rouge'}
        />
        <StatCard
          label="P&L réalisé"
          value={formatEur(pnlRealise)}
          couleur={pnlRealise >= 0 ? 'text-vert' : 'text-rouge'}
        />
        <StatCard
          label="Positions ouvertes"
          value={ouvertes.length}
          sub={cloturees.length > 0 ? `${cloturees.length} clôturée${cloturees.length > 1 ? 's' : ''}` : undefined}
        />
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span
            className="animate-spin h-6 w-6 border-2 border-t-transparent rounded-full"
            style={{ borderColor: 'var(--or)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : investissements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <TrendingUp size={44} className="text-or opacity-40" aria-hidden="true" />
          <p className="font-serif italic text-xl text-encre-secondaire">Aucun investissement enregistré</p>
          <p className="text-sm text-encre-tertiaire">
            Clique sur « Ajouter » pour saisir ton premier placement.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {ouvertes.length > 0 && (
            <section
              className="rounded-xl p-5"
              style={{ background: 'color-mix(in srgb, var(--vert) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--vert) 20%, transparent)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} strokeWidth={2} style={{ color: 'var(--vert)' }} />
                <h2 className="font-serif italic text-xl text-encre">
                  Positions ouvertes
                </h2>
                <span
                  className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium font-sans"
                  style={{ background: 'color-mix(in srgb, var(--vert) 15%, transparent)', color: 'var(--vert)' }}
                >
                  {ouvertes.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {ouvertes.map((inv) => (
                    <CarteInvestissement
                      key={inv.id}
                      inv={inv}
                      onCloturer={setCloturerTarget}
                      onSupprimer={setSupprimerTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {cloturees.length > 0 && (
            <section
              className="rounded-xl p-5"
              style={{ background: 'rgba(31,24,16,0.03)', border: '1px solid rgba(31,24,16,0.08)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={16} strokeWidth={1.75} className="text-encre-tertiaire" />
                <h2 className="font-serif italic text-xl text-encre-secondaire">
                  Positions clôturées
                </h2>
                <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-medium font-sans bg-encre/8 text-encre-tertiaire">
                  {cloturees.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {cloturees.map((inv) => (
                    <CarteInvestissement
                      key={inv.id}
                      inv={inv}
                      cloture
                      onCloturer={null}
                      onSupprimer={setSupprimerTarget}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modals */}
      <FormulaireAjout
        isOpen={modalAjout}
        onClose={() => setModalAjout(false)}
        onSubmit={handleAjouter}
        loading={saving}
      />
      <FormulaireCloturer
        investissement={cloturerTarget}
        onClose={() => setCloturerTarget(null)}
        onSubmit={handleCloturer}
        loading={saving}
      />
      <PopupConfirmation
        isOpen={!!supprimerTarget}
        onClose={() => setSupprimerTarget(null)}
        title="Supprimer cet investissement ?"
        message="Cette action est irréversible."
        tone="destructive"
        actions={[
          { label: 'Annuler',    variant: 'ghost',       onClick: () => setSupprimerTarget(null) },
          { label: 'Supprimer',  variant: 'destructive', onClick: handleSupprimer },
        ]}
      />
    </>
  )
}
