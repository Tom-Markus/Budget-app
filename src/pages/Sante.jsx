import { useState, useEffect, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, Plus, X, Trash2, Scale, TrendingUp, TrendingDown, Minus, Clock, Moon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../contexts/AuthContext'

const COULEUR = 'var(--vert)'
const COULEUR_SOMMEIL = '#5B7FD6'
const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_ABREV = ['L','M','M','J','V','S','D']

function fmtDuree(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`
}

function fmtTime(t) {
  if (!t) return ''
  return t.slice(0, 5)
}

function computeDuree(couche, lever) {
  const [ch, cm] = couche.split(':').map(Number)
  const [lh, lm] = lever.split(':').map(Number)
  let cMin = ch * 60 + cm
  let lMin = lh * 60 + lm
  if (lMin <= cMin) lMin += 24 * 60
  return lMin - cMin
}

function fmt(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`
}

function DatePicker({ value, onChange }) {
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
    const CAL_H = 320, CAL_W = Math.max(r.width, 260)
    const top = r.bottom + 6 + CAL_H > window.innerHeight ? r.top - CAL_H - 6 : r.bottom + 6
    const left = Math.min(r.left, window.innerWidth - CAL_W - 8)
    setPos({ top, left, width: CAL_W })
    setYearMode(false)
    setYearStart(view.getFullYear() - 7)
    setOpen(true)
  }

  const selected = value ? new Date(value + 'T00:00:00') : null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const year = view.getFullYear(), month = view.getMonth()

  const days = []
  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  for (let i = startDow - 1; i >= 0; i--) days.push({ d: new Date(year, month, -i), other: true })
  for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) days.push({ d: new Date(year, month, i), other: false })
  let nextDay = 1
  while (days.length < 42) days.push({ d: new Date(year, month + 1, nextDay++), other: true })

  const display = selected
    ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selected)
    : ''
  const years = Array.from({ length: 16 }, (_, i) => yearStart + i)

  return (
    <div ref={triggerRef}>
      <button type="button" onClick={handleOpen}
        className="w-full flex items-center justify-between gap-2 cursor-pointer font-sans text-sm rounded-xl px-3 h-9 focus:outline-none transition-colors duration-200"
        style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: display ? 'var(--encre)' : 'var(--encre-tertiaire)' }}>
        <span>{display || 'JJ / MM / AAAA'}</span>
        <Calendar size={13} strokeWidth={1.75} style={{ color: 'var(--encre-tertiaire)', flexShrink: 0 }} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
              className="surface-velin p-3"
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3 px-1">
                <button type="button"
                  onClick={() => yearMode ? setYearStart(s => s - 16) : setView(new Date(year, month - 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm"
                  style={{ color: 'var(--encre-tertiaire)' }}>
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
                <button type="button" onClick={() => setYearMode(m => !m)}
                  className="font-serif italic text-sm px-2 py-1 rounded-sm"
                  style={{ color: 'var(--encre)' }}>
                  {yearMode ? `${yearStart} – ${yearStart + 15}` : `${MOIS_LABELS[month]} ${year}`}
                </button>
                <button type="button"
                  onClick={() => yearMode ? setYearStart(s => s + 16) : setView(new Date(year, month + 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm"
                  style={{ color: 'var(--encre-tertiaire)' }}>
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>
              {yearMode ? (
                <div className="grid grid-cols-4 gap-1">
                  {years.map(y => (
                    <button key={y} type="button"
                      onClick={() => { setView(new Date(y, month, 1)); setYearMode(false) }}
                      className="h-9 rounded-sm text-xs font-sans transition-colors duration-100"
                      style={{
                        background: y === year ? 'var(--bordeaux)' : 'transparent',
                        color: y === year ? 'var(--velin-clair)' : 'var(--encre-secondaire)',
                        fontWeight: y === year ? '600' : 'normal',
                      }}>
                      {y}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 mb-1">
                    {JOURS_ABREV.map((j, i) => (
                      <div key={i} className="text-center font-sans py-1 font-medium"
                        style={{ fontSize: '0.6rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--encre-tertiaire)' }}>
                        {j}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {days.map(({ d, other }, i) => {
                      const isSel = selected && d.toDateString() === selected.toDateString()
                      const isToday = d.toDateString() === today.toDateString()
                      return (
                        <button key={i} type="button"
                          onClick={() => { onChange(d.toLocaleDateString('fr-CA')); setOpen(false) }}
                          className="h-10 w-full rounded-sm text-xs font-sans transition-colors duration-100 flex items-center justify-center"
                          style={{
                            color: other ? 'rgba(31,24,16,0.25)' : isSel ? 'var(--velin-clair)' : 'var(--encre-secondaire)',
                            background: isSel ? 'var(--bordeaux)' : isToday ? 'rgba(184,149,74,0.20)' : 'transparent',
                            fontWeight: isSel || isToday ? '600' : 'normal',
                          }}>
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

function PoidsLineChart({ data }) {
  const svgRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const n = sorted.length

  const W = 480, H = 200
  const PAD = { t: 24, r: 20, b: 44, l: 54 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const gradId = 'sante-poids-grad'

  let pts = [], linePath = '', fillPath = '', yLabels = [], minW = 0, maxW = 0
  if (n >= 2) {
    const weights = sorted.map(d => d.poids)
    minW = Math.min(...weights); maxW = Math.max(...weights)
    const range = maxW - minW
    const getY = (w) => range === 0 ? PAD.t + innerH / 2 : PAD.t + (1 - (w - minW) / range) * innerH
    pts = sorted.map((d, i) => ({ x: PAD.l + (i / (n - 1)) * innerW, y: getY(d.poids), ...d }))
    linePath = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < n - 1; i++) {
      const dx = (pts[i + 1].x - pts[i].x) * 0.4
      linePath += ` C ${pts[i].x + dx} ${pts[i].y} ${pts[i + 1].x - dx} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`
    }
    fillPath = linePath + ` L ${pts[n-1].x} ${PAD.t + innerH} L ${pts[0].x} ${PAD.t + innerH} Z`
    yLabels = range === 0
      ? [{ val: maxW, y: getY(maxW) }]
      : [
          { val: maxW, y: getY(maxW) },
          { val: Math.round((minW + maxW) / 2 * 2) / 2, y: getY((minW + maxW) / 2) },
          { val: minW, y: getY(minW) },
        ]
  }

  function handleTouchMove(e) {
    if (!svgRef.current || n < 2) return
    e.preventDefault()
    const touch = e.touches[0]
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((touch.clientX - rect.left) / rect.width) * W
    let minDist = Infinity, minIdx = 0
    pts.forEach((p, i) => { const d = Math.abs(p.x - svgX); if (d < minDist) { minDist = d; minIdx = i } })
    setHovered(minIdx)
  }

  function handleMouseMove(e) {
    if (!svgRef.current || n < 2) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    let minDist = Infinity, minIdx = 0
    pts.forEach((p, i) => { const d = Math.abs(p.x - svgX); if (d < minDist) { minDist = d; minIdx = i } })
    setHovered(minIdx)
  }

  const hp = hovered !== null ? pts[hovered] : null

  if (n < 2) return (
    <div className="py-8 text-center">
      <p className="font-sans text-sm italic" style={{ color: 'var(--encre-tertiaire)' }}>
        {n === 0 ? 'Aucune pesée enregistrée.' : 'Ajoute une 2ème pesée pour voir le graphique.'}
      </p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-3" style={{ height: '2rem' }}>
        <span className="font-serif italic text-2xl tabular-nums" style={{ color: hp ? COULEUR : 'rgba(31,24,16,0.18)' }}>
          {hp ? `${hp.poids} kg` : '— kg'}
        </span>
        {hp && (
          <span className="font-sans tabular-nums text-sm" style={{ color: 'var(--encre-tertiaire)' }}>
            {fmt(hp.date)}
          </span>
        )}
      </div>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}
        onTouchMove={handleTouchMove} onTouchEnd={() => setHovered(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COULEUR} stopOpacity="0.18" />
            <stop offset="100%" stopColor={COULEUR} stopOpacity="0.00" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t, i) => (
          <line key={i} x1={PAD.l} y1={PAD.t + t * innerH} x2={PAD.l + innerW} y2={PAD.t + t * innerH}
            stroke="rgba(31,24,16,0.07)" strokeWidth="1" />
        ))}
        {yLabels.map((l, i) => (
          <text key={i} x={PAD.l - 7} y={l.y + 4.5} textAnchor="end"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: 'rgba(31,24,16,0.38)', fontWeight: '500' }}>
            {l.val} kg
          </text>
        ))}
        <path d={fillPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={COULEUR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y}
            r={hovered === i ? 6 : 4}
            fill={COULEUR}
            opacity={hovered !== null && hovered !== i ? 0.25 : 1}
            style={{ transition: 'r 0.08s ease, opacity 0.1s ease' }}
          />
        ))}
        {hp && (
          <>
            <line x1={hp.x} y1={PAD.t} x2={hp.x} y2={PAD.t + innerH}
              stroke={COULEUR} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.35" />
            <circle cx={hp.x} cy={hp.y} r={12} fill="none" stroke={COULEUR} strokeWidth="1.5" strokeOpacity="0.20" />
          </>
        )}
        <text x={pts[0].x} y={H - 10} textAnchor="start"
          style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: hp && hovered === 0 ? COULEUR : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === 0 ? '600' : 'normal' }}>
          {fmt(pts[0].date)}
        </text>
        <text x={pts[n-1].x} y={H - 10} textAnchor="end"
          style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: hp && hovered === n-1 ? COULEUR : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === n-1 ? '600' : 'normal' }}>
          {fmt(pts[n-1].date)}
        </text>
        {hp && hovered !== 0 && hovered !== n-1 && (
          <text x={hp.x} y={H - 10} textAnchor="middle"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: COULEUR, fontWeight: '600' }}>
            {fmt(hp.date)}
          </text>
        )}
      </svg>
    </div>
  )
}

function CartePoidsHisto({ entry, onDelete, isDeleting }) {
  const dateLabel = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(entry.date + 'T00:00:00'))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(31,24,16,0.03)', border: '1px solid rgba(31,24,16,0.07)' }}>
      <div className="flex items-baseline gap-2.5">
        <span className="font-serif italic text-xl" style={{ color: 'var(--encre)' }}>{entry.poids} kg</span>
        <span className="font-sans text-sm" style={{ color: 'var(--encre-tertiaire)' }}>{dateLabel}</span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        disabled={isDeleting}
        className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:scale-95"
        style={{ color: 'var(--encre-tertiaire)' }}>
        {isDeleting
          ? <span className="w-3 h-3 border-2 rounded-full animate-spin block" style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
          : <Trash2 size={13} strokeWidth={1.75} />}
      </button>
    </motion.div>
  )
}

function ModalHistorique({ entries, onDelete, deletingId, onClose }) {
  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,8,6,0.60)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}>
      <motion.div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 480, maxHeight: '80dvh', background: 'var(--velin)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)' }}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${COULEUR} 50%, transparent 100%)` }} />
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h3 className="font-serif italic text-xl" style={{ color: 'var(--encre)' }}>Historique</h3>
            <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--encre-tertiaire)' }}>
              {entries.length} pesée{entries.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-2" style={{ minHeight: 0 }}>
          {entries.length === 0 && (
            <p className="font-sans text-sm italic text-center py-8" style={{ color: 'var(--encre-tertiaire)' }}>
              Aucune pesée enregistrée.
            </p>
          )}
          <AnimatePresence initial={false}>
            {entries.map(entry => (
              <CartePoidsHisto
                key={entry.id}
                entry={entry}
                onDelete={onDelete}
                isDeleting={deletingId === entry.id}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
  return createPortal(jsx, document.body)
}

function ModalAjoutPoids({ onClose, onSave }) {
  const [poids, setPoids] = useState('')
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-CA'))
  const [saving, setSaving] = useState(false)
  const poidsRef = useRef(null)
  const valide = Number(poids) > 0 && !!date

  useEffect(() => {
    const t = setTimeout(() => poidsRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  async function handleSave() {
    if (!valide || saving) return
    setSaving(true)
    await onSave(Number(poids), date)
    setSaving(false)
  }

  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(10,8,6,0.60)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}>
      <motion.div
        className="relative w-full rounded-t-3xl sm:rounded-2xl sm:max-w-md overflow-hidden"
        style={{ background: 'var(--velin)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent 0%, ${COULEUR} 50%, transparent 100%)` }} />
        <div className="absolute top-3 right-3">
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="px-6 pt-5 pb-2">
          <h3 className="font-serif italic text-xl mb-5" style={{ color: 'var(--encre)' }}>Ajouter une pesée</h3>
          <div className="space-y-3">
            <div>
              <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Poids (kg)</p>
              <input
                ref={poidsRef}
                type="number"
                step="0.1"
                min="1"
                max="499"
                value={poids}
                onChange={e => setPoids(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="ex : 78.5"
                className="w-full px-3 h-10 rounded-xl font-sans text-sm focus:outline-none"
                style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: 'var(--encre)' }}
              />
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Date</p>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
          <motion.button
            onClick={handleSave}
            disabled={!valide || saving}
            whileTap={valide && !saving ? { scale: 0.97 } : {}}
            className="w-full mt-5 h-11 rounded-2xl font-sans font-semibold text-sm transition-all duration-200"
            style={{
              background: valide ? COULEUR : 'rgba(31,24,16,0.08)',
              color: valide ? '#fff' : 'rgba(31,24,16,0.30)',
              cursor: valide ? 'pointer' : 'default',
            }}>
            {saving
              ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Enregistrer'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(jsx, document.body)
}

function SommeilBarChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const svgRef = useRef(null)

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
  const n = sorted.length

  if (n === 0) return (
    <div className="py-8 text-center">
      <p className="font-sans text-sm italic" style={{ color: 'var(--encre-tertiaire)' }}>
        Aucune nuit enregistrée.
      </p>
    </div>
  )

  const W = 480, H = 180
  const PAD = { t: 16, r: 16, b: 44, l: 44 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const MAX_M = 720

  const getY = (min) => PAD.t + (1 - Math.min(min, MAX_M) / MAX_M) * innerH

  const barW = Math.min(40, n === 1 ? 40 : Math.floor((innerW - (n - 1) * 6) / n))
  const gap = n <= 1 ? 0 : (innerW - n * barW) / (n - 1)

  const bars = sorted.map((d, i) => ({
    ...d,
    x: PAD.l + i * (barW + gap),
    y: getY(d.duree_minutes),
    h: innerH - (getY(d.duree_minutes) - PAD.t),
  }))

  const hp = hovered !== null ? bars[hovered] : null

  function handleMouseMove(e) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    let minDist = Infinity, minIdx = 0
    bars.forEach((b, i) => { const d = Math.abs(b.x + barW / 2 - svgX); if (d < minDist) { minDist = d; minIdx = i } })
    setHovered(minIdx)
  }

  function handleTouchMove(e) {
    if (!svgRef.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((touch.clientX - rect.left) / rect.width) * W
    let minDist = Infinity, minIdx = 0
    bars.forEach((b, i) => { const d = Math.abs(b.x + barW / 2 - svgX); if (d < minDist) { minDist = d; minIdx = i } })
    setHovered(minIdx)
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3" style={{ height: '2rem' }}>
        <span className="font-serif italic text-2xl tabular-nums" style={{ color: hp ? COULEUR_SOMMEIL : 'rgba(31,24,16,0.18)' }}>
          {hp ? fmtDuree(hp.duree_minutes) : '—'}
        </span>
        {hp && (
          <span className="font-sans tabular-nums text-sm" style={{ color: 'var(--encre-tertiaire)' }}>
            {fmtTime(hp.heure_couche)} → {fmtTime(hp.heure_lever)} · {fmt(hp.date)}
          </span>
        )}
      </div>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}
        onTouchMove={handleTouchMove} onTouchEnd={() => setHovered(null)}>
        {/* Grid lines at 4h, 8h, 12h */}
        {[240, 480, 720].map((m, i) => (
          <line key={i} x1={PAD.l} y1={getY(m)} x2={PAD.l + innerW} y2={getY(m)}
            stroke={m === 480 ? `${COULEUR_SOMMEIL}55` : 'rgba(31,24,16,0.07)'}
            strokeWidth={m === 480 ? 1.5 : 1}
            strokeDasharray={m === 480 ? '4 3' : undefined}
          />
        ))}
        {[240, 480, 720].map((m, i) => (
          <text key={i} x={PAD.l - 7} y={getY(m) + 4.5} textAnchor="end"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: m === 480 ? `${COULEUR_SOMMEIL}CC` : 'rgba(31,24,16,0.38)', fontWeight: m === 480 ? '600' : '500' }}>
            {m / 60}h
          </text>
        ))}
        {/* Bars */}
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={barW} height={b.h}
            rx={Math.min(5, barW / 3)}
            fill={COULEUR_SOMMEIL}
            opacity={hovered !== null && hovered !== i ? 0.22 : 1}
            style={{ transition: 'opacity 0.1s ease' }}
          />
        ))}
        {/* Date labels */}
        {n >= 1 && (
          <text x={bars[0].x + barW / 2} y={H - 10} textAnchor="middle"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: hp && hovered === 0 ? COULEUR_SOMMEIL : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === 0 ? '600' : 'normal' }}>
            {fmt(bars[0].date)}
          </text>
        )}
        {n >= 2 && (
          <text x={bars[n - 1].x + barW / 2} y={H - 10} textAnchor="middle"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: hp && hovered === n - 1 ? COULEUR_SOMMEIL : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === n - 1 ? '600' : 'normal' }}>
            {fmt(bars[n - 1].date)}
          </text>
        )}
        {hp && hovered !== 0 && hovered !== n - 1 && (
          <text x={hp.x + barW / 2} y={H - 10} textAnchor="middle"
            style={{ fontSize: '13px', fontFamily: 'sans-serif', fill: COULEUR_SOMMEIL, fontWeight: '600' }}>
            {fmt(hp.date)}
          </text>
        )}
      </svg>
    </div>
  )
}

function CarteNuitHisto({ entry, onDelete, isDeleting }) {
  const dateLabel = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(entry.date + 'T00:00:00'))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{ background: 'rgba(31,24,16,0.03)', border: '1px solid rgba(31,24,16,0.07)' }}>
      <div className="flex items-baseline flex-wrap gap-x-2.5 gap-y-0.5 min-w-0 flex-1 pr-2">
        <span className="font-serif italic text-xl flex-shrink-0" style={{ color: 'var(--encre)' }}>{fmtDuree(entry.duree_minutes)}</span>
        <span className="font-sans text-sm flex-shrink-0" style={{ color: 'var(--encre-secondaire)' }}>
          {fmtTime(entry.heure_couche)} → {fmtTime(entry.heure_lever)}
        </span>
        <span className="font-sans text-sm truncate" style={{ color: 'var(--encre-tertiaire)' }}>{dateLabel}</span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        disabled={isDeleting}
        className="w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:scale-95"
        style={{ color: 'var(--encre-tertiaire)' }}>
        {isDeleting
          ? <span className="w-3 h-3 border-2 rounded-full animate-spin block" style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
          : <Trash2 size={13} strokeWidth={1.75} />}
      </button>
    </motion.div>
  )
}

function ModalHistoriqueSommeil({ entries, onDelete, deletingId, onClose }) {
  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,8,6,0.60)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}>
      <motion.div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 480, maxHeight: '80dvh', background: 'var(--velin)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)' }}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${COULEUR_SOMMEIL} 50%, transparent 100%)` }} />
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h3 className="font-serif italic text-xl" style={{ color: 'var(--encre)' }}>Historique</h3>
            <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--encre-tertiaire)' }}>
              {entries.length} nuit{entries.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-2" style={{ minHeight: 0 }}>
          {entries.length === 0 && (
            <p className="font-sans text-sm italic text-center py-8" style={{ color: 'var(--encre-tertiaire)' }}>
              Aucune nuit enregistrée.
            </p>
          )}
          <AnimatePresence initial={false}>
            {entries.map(entry => (
              <CarteNuitHisto
                key={entry.id}
                entry={entry}
                onDelete={onDelete}
                isDeleting={deletingId === entry.id}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
  return createPortal(jsx, document.body)
}

function ModalAjoutSommeil({ onClose, onSave }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('fr-CA'))
  const [couche, setCouche] = useState('23:00')
  const [lever, setLever] = useState('07:00')
  const [saving, setSaving] = useState(false)

  const duree = couche && lever ? computeDuree(couche, lever) : 0
  const valide = !!date && duree > 0 && duree <= 1440

  async function handleSave() {
    if (!valide || saving) return
    setSaving(true)
    await onSave({ date, heure_couche: couche, heure_lever: lever, duree_minutes: duree })
    setSaving(false)
  }

  const timeInputStyle = {
    background: 'rgba(31,24,16,0.06)',
    border: '1px solid rgba(31,24,16,0.10)',
    color: 'var(--encre)',
  }

  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(10,8,6,0.60)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}>
      <motion.div
        className="relative w-full rounded-t-3xl sm:rounded-2xl sm:max-w-md overflow-hidden"
        style={{ background: 'var(--velin)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}>
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent 0%, ${COULEUR_SOMMEIL} 50%, transparent 100%)` }} />
        <div className="absolute top-3 right-3">
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="px-6 pt-5 pb-2">
          <h3 className="font-serif italic text-xl mb-5" style={{ color: 'var(--encre)' }}>Ajouter une nuit</h3>
          <div className="space-y-3">
            <div>
              <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Date (réveil)</p>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Heure coucher</p>
                <input
                  type="time"
                  value={couche}
                  onChange={e => setCouche(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl font-sans text-sm focus:outline-none"
                  style={timeInputStyle}
                />
              </div>
              <div>
                <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Heure lever</p>
                <input
                  type="time"
                  value={lever}
                  onChange={e => setLever(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl font-sans text-sm focus:outline-none"
                  style={timeInputStyle}
                />
              </div>
            </div>
            {duree > 0 && (
              <div className="flex items-center justify-center gap-2 py-2 rounded-xl"
                style={{ background: `${COULEUR_SOMMEIL}12` }}>
                <Moon size={13} style={{ color: COULEUR_SOMMEIL }} strokeWidth={2} />
                <span className="font-serif italic text-lg tabular-nums" style={{ color: COULEUR_SOMMEIL }}>
                  {fmtDuree(duree)}
                </span>
                <span className="font-sans text-xs" style={{ color: `${COULEUR_SOMMEIL}AA` }}>de sommeil</span>
              </div>
            )}
          </div>
          <motion.button
            onClick={handleSave}
            disabled={!valide || saving}
            whileTap={valide && !saving ? { scale: 0.97 } : {}}
            className="w-full mt-5 h-11 rounded-2xl font-sans font-semibold text-sm transition-all duration-200"
            style={{
              background: valide ? COULEUR_SOMMEIL : 'rgba(31,24,16,0.08)',
              color: valide ? '#fff' : 'rgba(31,24,16,0.30)',
              cursor: valide ? 'pointer' : 'default',
            }}>
            {saving
              ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Enregistrer'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(jsx, document.body)
}

export default function Sante() {
  const { user } = useContext(AuthContext)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistorique, setShowHistorique] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [entriesSommeil, setEntriesSommeil] = useState([])
  const [loadingSommeil, setLoadingSommeil] = useState(true)
  const [showModalSommeil, setShowModalSommeil] = useState(false)
  const [showHistoriqueSommeil, setShowHistoriqueSommeil] = useState(false)
  const [deletingIdSommeil, setDeletingIdSommeil] = useState(null)

  useEffect(() => {
    if (!user) return
    loadEntries()
    loadSommeil()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('sante_poids')
      .select('id, poids, date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function handleSave(poids, date) {
    const { data, error } = await supabase
      .from('sante_poids')
      .insert({ user_id: user.id, poids, date })
      .select('id, poids, date')
      .single()
    if (!error && data) {
      setEntries(prev => [data, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
    }
    setShowModal(false)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    const { error } = await supabase.from('sante_poids').delete().eq('id', id)
    if (!error) setEntries(prev => prev.filter(e => e.id !== id))
    setDeletingId(null)
  }

  async function loadSommeil() {
    setLoadingSommeil(true)
    const { data } = await supabase
      .from('sante_sommeil')
      .select('id, date, heure_couche, heure_lever, duree_minutes')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    setEntriesSommeil(data || [])
    setLoadingSommeil(false)
  }

  async function handleSaveSommeil({ date, heure_couche, heure_lever, duree_minutes }) {
    const { data, error } = await supabase
      .from('sante_sommeil')
      .insert({ user_id: user.id, date, heure_couche, heure_lever, duree_minutes })
      .select('id, date, heure_couche, heure_lever, duree_minutes')
      .single()
    if (!error && data) {
      setEntriesSommeil(prev => [data, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
    }
    setShowModalSommeil(false)
  }

  async function handleDeleteSommeil(id) {
    setDeletingIdSommeil(id)
    const { error } = await supabase.from('sante_sommeil').delete().eq('id', id)
    if (!error) setEntriesSommeil(prev => prev.filter(e => e.id !== id))
    setDeletingIdSommeil(null)
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const first = sorted[0]
  const evolution = latest && first && sorted.length >= 2
    ? +(latest.poids - first.poids).toFixed(1)
    : null

  const EvolutionIcon = evolution === null ? null : evolution > 0 ? TrendingUp : evolution < 0 ? TrendingDown : Minus
  const evolutionLabel = evolution === null ? null : evolution > 0 ? `+${evolution} kg` : evolution < 0 ? `${evolution} kg` : '='
  const evolutionColor = evolution === null ? null : evolution > 0 ? 'var(--bordeaux-clair)' : evolution < 0 ? COULEUR : 'var(--encre-tertiaire)'
  const evolutionBg   = evolution === null ? null : evolution > 0 ? 'rgba(122,38,50,0.09)' : evolution < 0 ? 'rgba(14,163,113,0.09)' : 'rgba(138,128,115,0.09)'

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Poids corporel */}
      <section className="surface-velin liserer-signature px-5 pt-5 pb-5 md:px-7 md:pt-7 md:pb-7 flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Scale size={13} style={{ color: 'var(--encre-tertiaire)' }} strokeWidth={2} />
          <p className="t-label">Poids corporel</p>
          {entries.length > 0 && (
            <button
              onClick={() => setShowHistorique(true)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans text-xs transition-opacity hover:opacity-70"
              style={{ background: 'rgba(31,24,16,0.06)', color: 'var(--encre-tertiaire)' }}>
              <Clock size={11} strokeWidth={2} />
              {entries.length} pesée{entries.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Stat principale */}
        {!loading && latest && (
          <div className="flex items-end gap-3 mb-5">
            <span className="font-serif italic leading-none" style={{ fontSize: '2.75rem', color: 'var(--encre)' }}>
              {latest.poids} <span style={{ fontSize: '1.5rem', color: 'var(--encre-secondaire)' }}>kg</span>
            </span>
            {evolution !== null && (
              <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1 rounded-full"
                style={{ background: evolutionBg }}>
                <EvolutionIcon size={12} strokeWidth={2.5} style={{ color: evolutionColor }} />
                <span className="font-sans font-bold text-xs tabular-nums" style={{ color: evolutionColor }}>
                  {evolutionLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="h-10 mb-5 flex items-center">
            <span className="font-serif italic text-2xl" style={{ color: 'rgba(31,24,16,0.18)' }}>Chargement…</span>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="font-sans text-sm italic mb-5" style={{ color: 'var(--encre-tertiaire)' }}>
            Commence à enregistrer ton poids pour voir l'évolution.
          </p>
        )}

        {/* Graphique */}
        {!loading && <PoidsLineChart data={entries} />}

        <div className="mt-auto">
          {/* Séparateur */}
          <div className="h-px w-full my-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(31,24,16,0.10) 30%, rgba(31,24,16,0.10) 70%, transparent)' }} />

          {/* Bouton ajouter */}
          <motion.button
            onClick={() => setShowModal(true)}
            whileTap={{ scale: 0.97 }}
            className="w-full h-10 rounded-2xl flex items-center justify-center gap-2 font-sans font-semibold text-sm"
            style={{ background: COULEUR, color: '#fff', cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} />
            Ajouter une pesée
          </motion.button>
        </div>
      </section>

      {/* Sommeil */}
      <section className="surface-velin liserer-signature px-5 pt-5 pb-5 md:px-7 md:pt-7 md:pb-7 flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Moon size={13} style={{ color: 'var(--encre-tertiaire)' }} strokeWidth={2} />
          <p className="t-label">Sommeil</p>
          {entriesSommeil.length > 0 && (
            <button
              onClick={() => setShowHistoriqueSommeil(true)}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans text-xs transition-opacity hover:opacity-70"
              style={{ background: 'rgba(31,24,16,0.06)', color: 'var(--encre-tertiaire)' }}>
              <Clock size={11} strokeWidth={2} />
              {entriesSommeil.length} nuit{entriesSommeil.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Stat principale */}
        {!loadingSommeil && entriesSommeil.length > 0 && (() => {
          const latest = entriesSommeil[0]
          const slice7 = entriesSommeil.slice(0, 7)
          const avg = Math.round(slice7.reduce((s, e) => s + e.duree_minutes, 0) / slice7.length)
          const avgColor = avg >= 420 ? COULEUR_SOMMEIL : avg >= 360 ? 'var(--or)' : 'var(--bordeaux-clair)'
          const avgBg    = avg >= 420 ? 'rgba(91,127,214,0.09)' : avg >= 360 ? 'rgba(184,149,74,0.09)' : 'rgba(122,38,50,0.09)'
          return (
            <div className="flex items-end gap-3 mb-5">
              <span className="font-serif italic leading-none" style={{ fontSize: '2.75rem', color: 'var(--encre)' }}>
                {fmtDuree(latest.duree_minutes)}
              </span>
              {entriesSommeil.length >= 2 && (
                <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1 rounded-full"
                  style={{ background: avgBg }}>
                  <span className="font-sans font-bold text-xs tabular-nums" style={{ color: avgColor }}>
                    Ø {fmtDuree(avg)} /nuit
                  </span>
                </div>
              )}
            </div>
          )
        })()}

        {loadingSommeil && (
          <div className="h-10 mb-5 flex items-center">
            <span className="font-serif italic text-2xl" style={{ color: 'rgba(31,24,16,0.18)' }}>Chargement…</span>
          </div>
        )}

        {!loadingSommeil && entriesSommeil.length === 0 && (
          <p className="font-sans text-sm italic mb-5" style={{ color: 'var(--encre-tertiaire)' }}>
            Commence à enregistrer tes nuits pour voir l'évolution.
          </p>
        )}

        {/* Graphique */}
        {!loadingSommeil && <SommeilBarChart data={entriesSommeil} />}

        <div className="mt-auto">
          {/* Séparateur */}
          <div className="h-px w-full my-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(31,24,16,0.10) 30%, rgba(31,24,16,0.10) 70%, transparent)' }} />

          {/* Bouton ajouter */}
          <motion.button
            onClick={() => setShowModalSommeil(true)}
            whileTap={{ scale: 0.97 }}
            className="w-full h-10 rounded-2xl flex items-center justify-center gap-2 font-sans font-semibold text-sm"
            style={{ background: COULEUR_SOMMEIL, color: '#fff', cursor: 'pointer' }}>
            <Plus size={15} strokeWidth={2.5} />
            Ajouter une nuit
          </motion.button>
        </div>
      </section>

      {/* Modal historique sommeil */}
      <AnimatePresence>
        {showHistoriqueSommeil && (
          <ModalHistoriqueSommeil
            entries={entriesSommeil}
            onDelete={handleDeleteSommeil}
            deletingId={deletingIdSommeil}
            onClose={() => setShowHistoriqueSommeil(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal ajout sommeil */}
      <AnimatePresence>
        {showModalSommeil && (
          <ModalAjoutSommeil
            onClose={() => setShowModalSommeil(false)}
            onSave={handleSaveSommeil}
          />
        )}
      </AnimatePresence>

      {/* Modal historique */}
      <AnimatePresence>
        {showHistorique && (
          <ModalHistorique
            entries={entries}
            onDelete={handleDelete}
            deletingId={deletingId}
            onClose={() => setShowHistorique(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal ajout */}
      <AnimatePresence>
        {showModal && (
          <ModalAjoutPoids
            onClose={() => setShowModal(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
