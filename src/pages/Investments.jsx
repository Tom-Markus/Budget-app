import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Plus, X, Trash2, Lock, CheckCircle2,
  ChevronLeft, ChevronRight, Calendar, BarChart2,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import PopupConfirmation from '../components/PopupConfirmation'
import { fetchMarkets, fetchStocks } from '../lib/newsApi'
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

// Couleurs recharts pour le donut
const DONUT_COLORS = {
  action: '#0E1F3A',
  etf:    '#0EA371',
  crypto: '#B8954A',
  or:     '#5C1A24',
}

// Mapping ticker crypto → clé CoinGecko retournée par fetchMarkets
const CRYPTO_TICKER_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  XRP: 'ripple',  BNB: 'binancecoin', AVAX: 'avalanche', DOGE: 'dogecoin',
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

function formatUsd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function formatPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + ' %'
}

function formatQte(n) {
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(6)).toString()
}

function formatDate(d) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(d + 'T00:00:00'))
}

function formatDateCompacte(d) {
  return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit' }).format(new Date(d))
}

// ============================================================================
// Helper — prix live d'un investissement
// ============================================================================
function getLivePrice(inv, liveMarkets, liveStocks) {
  if (!inv || !liveMarkets) return null

  if (inv.type === 'or') {
    return liveMarkets.gold?.usd ?? null
  }

  if (inv.type === 'crypto') {
    if (!inv.ticker) return null
    const coinKey = CRYPTO_TICKER_MAP[inv.ticker.toUpperCase()]
    return coinKey ? (liveMarkets[coinKey]?.usd ?? null) : null
  }

  if (inv.type === 'action' || inv.type === 'etf') {
    if (!inv.ticker || !liveStocks) return null
    return liveStocks[inv.ticker.toLowerCase()]?.price ?? null
  }

  return null
}

// ============================================================================
// Helper — historique de valeur du portefeuille
// ============================================================================
function buildPortfolioHistory(investissements, liveMarkets, liveStocks) {
  if (!investissements || investissements.length === 0) return []

  const events = []
  for (const inv of investissements) {
    if (!inv.date_achat) continue
    events.push({ date: inv.date_achat, type: 'achat', inv })
    if (inv.date_vente && inv.prix_vente != null) {
      events.push({ date: inv.date_vente, type: 'vente', inv })
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date))
  if (events.length === 0) return []

  // openPositions track le coût des positions actuellement ouvertes
  const openPositions = new Map() // id → inv
  let openCost = 0
  let closedProceeds = 0

  const points = []

  for (const ev of events) {
    if (ev.type === 'achat') {
      openCost += ev.inv.prix_achat * ev.inv.quantite
      openPositions.set(ev.inv.id, ev.inv)
    } else {
      openCost -= ev.inv.prix_achat * ev.inv.quantite
      closedProceeds += ev.inv.prix_vente * ev.inv.quantite
      openPositions.delete(ev.inv.id)
    }
    points.push({
      date: ev.date,
      valeur: Math.max(0, openCost + closedProceeds),
    })
  }

  // Point "aujourd'hui" : positions ouvertes au prix live si dispo, sinon coût
  const today = new Date().toISOString().slice(0, 10)
  let liveOpenValue = 0
  for (const inv of openPositions.values()) {
    const lp = getLivePrice(inv, liveMarkets, liveStocks)
    liveOpenValue += (lp ?? inv.prix_achat) * inv.quantite
  }
  points.push({ date: today, valeur: Math.max(0, liveOpenValue + closedProceeds) })

  // Dédoublonner si deux points à la même date (garder le dernier)
  const byDate = new Map()
  for (const p of points) byDate.set(p.date, p)
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ============================================================================
// Primitives UI
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
  const [yearMode, setYearMode] = useState(false)
  const [yearStart, setYearStart] = useState(() => {
    const y = value ? new Date(value + 'T00:00:00').getFullYear() : new Date().getFullYear()
    return y - 7
  })
  const triggerRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (value) setView(new Date(value + 'T00:00:00'))
  }, [value])

  useEffect(() => {
    if (!open) return
    const fn = (e) => { if (!triggerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    document.addEventListener('touchstart', fn, { passive: true })
    return () => {
      document.removeEventListener('mousedown', fn)
      document.removeEventListener('touchstart', fn)
    }
  }, [open])

  function handleOpen() {
    const r = triggerRef.current.getBoundingClientRect()
    const CAL_H = 320
    const CAL_W = Math.max(r.width, 272)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const top  = r.bottom + 6 + CAL_H > vh ? r.top - CAL_H - 6 : r.bottom + 6
    const left = Math.min(r.left, vw - CAL_W - 8)
    setPos({ top, left, width: CAL_W })
    setYearMode(false)
    setYearStart(view.getFullYear() - 7)
    setOpen(true)
  }

  const selected = value ? new Date(value + 'T00:00:00') : null
  const today = new Date(); today.setHours(0,0,0,0)
  const year = view.getFullYear()
  const month = view.getMonth()

  const days = []
  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  for (let i = startDow - 1; i >= 0; i--)
    days.push({ d: new Date(year, month, -i), other: true })
  for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++)
    days.push({ d: new Date(year, month, i), other: false })
  let nextDay = 1
  while (days.length < 42)
    days.push({ d: new Date(year, month + 1, nextDay++), other: true })

  function pick(d) {
    onChange(d.toLocaleDateString('fr-CA'))
    setOpen(false)
  }

  const display = selected
    ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selected)
    : ''

  const years = Array.from({ length: 16 }, (_, i) => yearStart + i)

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
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={() => yearMode ? setYearStart(s => s - 16) : setView(new Date(year, month - 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-150"
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>

                <button
                  type="button"
                  onClick={() => setYearMode(m => !m)}
                  className="font-serif italic text-encre text-sm hover:text-or transition-colors duration-150 px-2 py-1 rounded-sm hover:bg-velin-fonce"
                >
                  {yearMode ? `${yearStart} – ${yearStart + 15}` : `${MOIS[month]} ${year}`}
                </button>

                <button
                  type="button"
                  onClick={() => yearMode ? setYearStart(s => s + 16) : setView(new Date(year, month + 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-150"
                >
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>

              {yearMode ? (
                <div className="grid grid-cols-4 gap-1">
                  {years.map(y => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { setView(new Date(y, month, 1)); setYearMode(false) }}
                      className={[
                        'h-9 rounded-sm text-xs font-sans transition-colors duration-100',
                        y === year ? 'bg-bordeaux text-velin-clair font-semibold' : 'text-encre-secondaire hover:bg-velin-fonce',
                      ].join(' ')}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 mb-1">
                    {JOURS_ABREV.map((j, i) => (
                      <div key={i} className="text-center text-[0.6rem] uppercase tracking-wider text-encre-tertiaire py-1 font-medium">
                        {j}
                      </div>
                    ))}
                  </div>
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
                            'h-10 w-full rounded-sm text-xs font-sans transition-colors duration-100 flex items-center justify-center',
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
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// Modal générique
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
            style={{ background: 'rgba(14,31,58,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
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
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TYPES).map(([id, t]) => {
              const selected = form.type === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: id }))}
                  className={[
                    'h-10 rounded-md text-sm font-medium font-sans transition-colors duration-150 border',
                    selected
                      ? `${t.bg} ${t.text} border-current/30`
                      : 'bg-transparent text-encre-tertiaire border-[rgba(31,24,16,0.10)] hover:bg-velin-fonce hover:text-encre',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
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
          <Champ label="Cours à l'achat *">
            <input
              type="number" step="any" min="0"
              value={form.cours_achat} onChange={set('cours_achat')}
              placeholder="ex : 182.50" className={inputCls} required
            />
          </Champ>
          <Champ label="Montant payé *">
            <input
              type="number" step="any" min="0"
              value={form.montant_paye} onChange={set('montant_paye')}
              placeholder="ex : 1000" className={inputCls} required
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

        <Champ label="Cours de vente *">
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
// Badge de performance (positions clôturées)
// ============================================================================
function PerfBadge({ pct }) {
  if (pct === null || pct === undefined) return null

  let bg, text, Icon
  if (pct >= 15)      { bg = 'bg-vert/12';     text = 'text-vert';      Icon = TrendingUp   }
  else if (pct >= 5)  { bg = 'bg-or/12';       text = 'text-or-fonce';  Icon = TrendingUp   }
  else if (pct >= 0)  { bg = 'bg-graphite/10'; text = 'text-graphite';  Icon = Minus        }
  else                { bg = 'bg-rouge/10';     text = 'text-rouge';     Icon = TrendingDown }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[0.65rem] font-medium uppercase tracking-wider ${bg} ${text}`}
    >
      <Icon size={9} strokeWidth={2.5} aria-hidden="true" />
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ============================================================================
// Composants affichage
// ============================================================================
function StatCard({ label, value, sub, couleur, onChart }) {
  return (
    <div className="surface-velin p-3 sm:p-4 flex flex-col gap-1 min-w-0 relative">
      {onChart && (
        <button
          type="button"
          onClick={onChart}
          aria-label="Voir l'évolution du portefeuille"
          className="absolute top-2 right-2 p-1.5 rounded-sm text-encre-tertiaire hover:text-or hover:bg-velin-fonce transition-colors duration-200"
        >
          <BarChart2 size={13} strokeWidth={1.75} />
        </button>
      )}
      <span className="text-[0.65rem] sm:text-[0.7rem] uppercase tracking-wider text-encre-tertiaire font-medium truncate pr-6">
        {label}
      </span>
      <span className={`font-serif italic text-lg sm:text-2xl truncate ${couleur || 'text-encre'}`}>
        {value}
      </span>
      {sub && <span className="text-[0.65rem] sm:text-xs text-encre-tertiaire truncate">{sub}</span>}
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

// ── Tooltip live P&L ──────────────────────────────────────────────────────────
function LiveTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const { date, valeur } = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-md text-xs" style={{
      background: 'var(--velin-clair)', boxShadow: 'var(--shadow-md)',
      border: '1px solid rgba(31,24,16,0.08)',
    }}>
      <div className="t-label-noble">{formatDateCompacte(date)}</div>
      <div className="font-sans font-medium text-encre tabular-nums mt-0.5">
        {formatUsd(valeur)}
      </div>
    </div>
  )
}

// ── Graphe portefeuille (modal) ───────────────────────────────────────────────
function GraphePortefeuille({ isOpen, onClose, investissements, liveMarkets, liveStocks }) {
  const points = useMemo(
    () => buildPortfolioHistory(investissements, liveMarkets, liveStocks),
    [investissements, liveMarkets, liveStocks],
  )

  useEffect(() => {
    if (!isOpen) return
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  const aHistorique = points.length > 1

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          role="dialog" aria-modal="true" aria-labelledby="graph-portfolio-titre"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(14,31,58,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-2xl surface-velin p-6 md:p-8 flex flex-col"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="t-label">Évolution</p>
                <h3 id="graph-portfolio-titre" className="t-h2 mt-1">Portefeuille complet</h3>
                <p className="text-xs text-encre-tertiaire mt-1">
                  Positions ouvertes au prix {liveMarkets ? 'live' : 'coût'} + positions clôturées
                </p>
              </div>
              <button
                type="button" onClick={onClose} aria-label="Fermer"
                className="p-2 rounded-sm text-encre-tertiaire hover:text-encre hover:bg-velin-fonce transition-colors duration-200"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="relative w-full h-56 md:h-72">
              {!aHistorique && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="t-label-noble">Pas encore d'historique</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--vert)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--vert)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(14,31,58,0.08)" strokeDasharray="2 4" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateCompacte}
                    stroke="var(--nuit)" fontSize={11} tickLine={false}
                    axisLine={{ stroke: 'rgba(14,31,58,0.2)' }}
                  />
                  <YAxis
                    stroke="var(--nuit)" fontSize={11} tickLine={false}
                    axisLine={{ stroke: 'rgba(14,31,58,0.2)' }}
                    tickFormatter={(v) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    width={64}
                  />
                  <Tooltip content={<LiveTooltip />} />
                  <Area
                    type="monotone" dataKey="valeur"
                    stroke="var(--vert)" strokeWidth={2.5}
                    fill="url(#portfolio-fill)" dot={false}
                    activeDot={{ r: 5, fill: 'var(--vert)', stroke: 'var(--velin-clair)', strokeWidth: 2 }}
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Donut répartition par type ───────────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-md text-xs" style={{
      background: 'var(--velin-clair)', boxShadow: 'var(--shadow-md)',
      border: '1px solid rgba(31,24,16,0.08)',
    }}>
      <div className="font-serif italic text-sm text-encre">{d.label}</div>
      <div className="font-sans font-medium text-encre tabular-nums mt-0.5">{formatEur(d.value)}</div>
      <div className="t-meta tabular-nums mt-0.5">{d.pct.toFixed(1)} %</div>
    </div>
  )
}

function DonutRepartition({ investissements }) {
  const ouvertes = investissements.filter(i => !i.date_vente)
  if (ouvertes.length === 0) return null

  const data = Object.entries(TYPES).map(([id, cfg]) => {
    const total = ouvertes
      .filter(i => i.type === id)
      .reduce((s, i) => s + i.prix_achat * i.quantite, 0)
    return { id, label: cfg.label, value: total }
  }).filter(d => d.value > 0)

  // Au moins 2 types différents pour que le donut soit utile
  if (data.length < 2) return null

  const total = data.reduce((s, d) => s + d.value, 0)
  const dataAvecPct = data.map(d => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }))

  return (
    <div className="surface-velin p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <p className="t-label">Répartition</p>
        <span className="text-[0.7rem] text-encre-tertiaire font-sans">Positions ouvertes</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div style={{ width: 160, height: 160, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataAvecPct}
                cx="50%" cy="50%"
                innerRadius={46} outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                animationDuration={600}
              >
                {dataAvecPct.map((d) => (
                  <Cell key={d.id} fill={DONUT_COLORS[d.id] ?? '#888'} stroke="var(--velin-clair)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Légende */}
        <ul className="flex flex-wrap sm:flex-col gap-2 sm:gap-2.5">
          {dataAvecPct.map(d => (
            <li key={d.id} className="flex items-center gap-2 min-w-[120px]">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: DONUT_COLORS[d.id] ?? '#888' }}
                aria-hidden="true"
              />
              <span className="text-xs text-encre-secondaire">{d.label}</span>
              <span className="text-xs text-encre-tertiaire ml-auto tabular-nums">{d.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Carte investissement ──────────────────────────────────────────────────────
function CarteInvestissement({ inv, onCloturer, onSupprimer, cloture, livePrice, liveLoading }) {
  const montantInvesti = inv.prix_achat * inv.quantite
  const estCloture = !!(inv.date_vente && inv.prix_vente)
  const pnl = estCloture ? (inv.prix_vente - inv.prix_achat) * inv.quantite : null
  const pnlPct = estCloture && inv.prix_achat > 0 ? (inv.prix_vente / inv.prix_achat - 1) * 100 : null

  // P&L live (positions ouvertes uniquement)
  const pnlLive = !estCloture && livePrice != null
    ? (livePrice - inv.prix_achat) * inv.quantite
    : null
  const pnlLivePct = !estCloture && livePrice != null && inv.prix_achat > 0
    ? (livePrice / inv.prix_achat - 1) * 100
    : null

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
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={inv.type} />
            {/* Badge de perf sur les positions clôturées */}
            {estCloture && pnlPct !== null && <PerfBadge pct={pnlPct} />}
          </div>
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
              className="h-10 w-10 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-bordeaux hover:bg-bordeaux/10 transition-colors duration-200"
            >
              <Lock size={14} strokeWidth={1.75} />
            </button>
          )}
          <button
            onClick={() => onSupprimer(inv.id)}
            title="Supprimer"
            className="h-10 w-10 flex items-center justify-center rounded-sm text-encre-tertiaire hover:text-rouge hover:bg-rouge/10 transition-colors duration-200"
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

      {/* Montants + P&L réalisé */}
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs text-encre-tertiaire leading-5">
          {formatQte(inv.quantite)} × {inv.prix_achat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* P&L live (positions ouvertes uniquement) */}
      {!estCloture && (
        <div
          className="flex items-center justify-between gap-2 pt-2 border-t"
          style={{ borderColor: 'rgba(31,24,16,0.07)' }}
        >
          {liveLoading ? (
            <div className="flex-1 h-4 bg-encre/6 rounded animate-pulse" />
          ) : livePrice != null ? (
            <>
              <span className="text-xs text-encre-tertiaire">
                Live{' '}
                <span className="font-medium text-encre tabular-nums">
                  {formatUsd(livePrice)}
                </span>
              </span>
              {pnlLive !== null && (
                <span className={`text-sm font-medium tabular-nums ${pnlLive >= 0 ? 'text-vert' : 'text-rouge'}`}>
                  {pnlLive >= 0 ? '+' : ''}{formatUsd(pnlLive)}
                  <span className="text-xs ml-1 font-normal">
                    ({pnlLivePct >= 0 ? '+' : ''}{pnlLivePct.toFixed(2)} %)
                  </span>
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-encre-tertiaire/50 italic">Prix live non disponible</span>
          )}
        </div>
      )}

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
  const [graphPortefeuilleOpen, setGraphPortefeuilleOpen] = useState(false)

  // Prix live
  const [liveMarkets, setLiveMarkets] = useState(null)
  const [liveStocks,  setLiveStocks]  = useState(null)
  const [liveLoading, setLiveLoading] = useState(false)

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

  // Chargement des prix live (sessionStorage cache 15 min, donc rapide si News a déjà chargé)
  useEffect(() => {
    let mounted = true
    async function fetchLive() {
      setLiveLoading(true)
      try {
        const [m, s] = await Promise.all([fetchMarkets(), fetchStocks()])
        if (!mounted) return
        setLiveMarkets(m)
        setLiveStocks(s)
      } catch {
        // silencieux : P&L live simplement absent
      } finally {
        if (mounted) setLiveLoading(false)
      }
    }
    fetchLive()
    // Refresh toutes les 60 s (respecte le cache sessionStorage de 15 min)
    const interval = setInterval(fetchLive, 60_000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

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

  const totalInvesti       = investissements.reduce((s, i) => s + i.prix_achat * i.quantite, 0)
  const pnlRealise         = cloturees.reduce((s, i) => s + (i.prix_vente - i.prix_achat) * i.quantite, 0)
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Portefeuille"
          value={formatEur(valeurPortefeuille)}
          sub={`investi ${formatEur(totalInvesti)}`}
          couleur={valeurPortefeuille > totalInvesti ? 'text-vert' : valeurPortefeuille < totalInvesti ? 'text-rouge' : 'text-encre'}
          onChart={() => setGraphPortefeuilleOpen(true)}
        />
        <StatCard
          label="P&L réalisé"
          value={formatEur(pnlRealise)}
          couleur={pnlRealise > 0 ? 'text-vert' : pnlRealise < 0 ? 'text-rouge' : 'text-encre'}
        />
        <StatCard
          label="Positions ouvertes"
          value={ouvertes.length}
          sub={cloturees.length > 0 ? `${cloturees.length} clôturée${cloturees.length > 1 ? 's' : ''}` : undefined}
        />
      </div>

      {/* Donut répartition par type */}
      {!loading && ouvertes.length > 0 && (
        <div className="mb-6">
          <DonutRepartition investissements={investissements} />
        </div>
      )}

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
                      livePrice={getLivePrice(inv, liveMarkets, liveStocks)}
                      liveLoading={liveLoading}
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
                      livePrice={null}
                      liveLoading={false}
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
      <GraphePortefeuille
        isOpen={graphPortefeuilleOpen}
        onClose={() => setGraphPortefeuilleOpen(false)}
        investissements={investissements}
        liveMarkets={liveMarkets}
        liveStocks={liveStocks}
      />
    </>
  )
}
