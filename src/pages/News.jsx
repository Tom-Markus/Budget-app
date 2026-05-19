/**
 * src/pages/News.jsx — Observatoire
 * Terminal de veille & marchés : prix temps réel, météo, sentiment, actualités.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  BarChart2, Cpu, FlaskConical, Globe2,
  X, Sun, Cloud, CloudRain, CloudSnow, CloudLightning,
  Wind, MapPin, Activity, Sunrise, Sunset, ArrowRightLeft, Landmark, Wallet,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { fetchNewsCategory, fetchMarkets, clearNewsCache } from '../lib/newsApi'

// ── Constantes ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'business',   label: 'Finance',   labelCourt: 'Finance',  Icon: BarChart2    },
  { id: 'technology', label: 'Tech & IA', labelCourt: 'Tech',     Icon: Cpu          },
  { id: 'science',    label: 'Sciences',  labelCourt: 'Sciences', Icon: FlaskConical },
  { id: 'world',      label: 'Monde',     labelCourt: 'Monde',    Icon: Globe2       },
]

// Codes WMO → icône + label
const WMO = {
  0:  { Icon: Sun,            label: 'Ensoleillé',  color: '#FBBF24' },
  1:  { Icon: Sun,            label: 'Dégagé',      color: '#FBBF24' },
  2:  { Icon: Cloud,          label: 'Nuageux',     color: '#9CA3AF' },
  3:  { Icon: Cloud,          label: 'Couvert',     color: '#6B7280' },
  45: { Icon: Cloud,          label: 'Brumeux',     color: '#9CA3AF' },
  48: { Icon: Cloud,          label: 'Brouillard',  color: '#9CA3AF' },
  51: { Icon: CloudRain,      label: 'Bruine',      color: '#60A5FA' },
  53: { Icon: CloudRain,      label: 'Bruine',      color: '#60A5FA' },
  55: { Icon: CloudRain,      label: 'Bruine',      color: '#60A5FA' },
  61: { Icon: CloudRain,      label: 'Pluie',       color: '#3B82F6' },
  63: { Icon: CloudRain,      label: 'Pluie',       color: '#3B82F6' },
  65: { Icon: CloudRain,      label: 'Pluie forte', color: '#2563EB' },
  71: { Icon: CloudSnow,      label: 'Neige',       color: '#BAE6FD' },
  73: { Icon: CloudSnow,      label: 'Neige',       color: '#BAE6FD' },
  75: { Icon: CloudSnow,      label: 'Neige forte', color: '#BAE6FD' },
  80: { Icon: CloudRain,      label: 'Averses',     color: '#3B82F6' },
  81: { Icon: CloudRain,      label: 'Averses',     color: '#3B82F6' },
  82: { Icon: CloudRain,      label: 'Averses',     color: '#2563EB' },
  95: { Icon: CloudLightning, label: 'Orage',       color: '#8B5CF6' },
  96: { Icon: CloudLightning, label: 'Orage',       color: '#7C3AED' },
  99: { Icon: CloudLightning, label: 'Orage fort',  color: '#7C3AED' },
}
function getWmo(code) {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { Icon: Cloud, label: '?', color: '#9CA3AF' }
}

// Traduction exacte des classifications de l'API alternative.me
const FG_FR = {
  'Extreme Fear': 'Peur extrême',
  'Fear':         'Peur',
  'Neutral':      'Neutre',
  'Greed':        'Avidité',
  'Extreme Greed':'Avidité extrême',
}

// Couleurs calquées sur les seuils officiels d'alternative.me
function getFgStyle(classification) {
  switch (classification) {
    case 'Extreme Fear': return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
    case 'Fear':         return { color: '#F97316', bg: 'rgba(249,115,22,0.12)' }
    case 'Neutral':      return { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' }
    case 'Greed':        return { color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  }
    case 'Extreme Greed':return { color: '#16A34A', bg: 'rgba(22,163,74,0.12)'  }
    default:             return { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tempsRelatif(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}j`
  if (h >= 1)  return `${h}h`
  if (m >= 1)  return `${m}min`
  return "À l'instant"
}

function fmt(val, dec = 0) {
  if (val == null) return null
  return val.toLocaleString('fr-BE', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ── Fetchers externes (météo + sentiment) ─────────────────────────────────────

async function fetchWeather() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          const [wRes, gRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto&wind_speed_unit=kmh`),
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
          ])
          const [w, g] = await Promise.all([wRes.json(), gRes.json()])
          const fmtTime = (iso) => iso?.slice(11, 16) ?? null // "2026-05-19T05:43" → "05:43"
          resolve({
            temp:    Math.round(w.current.temperature_2m),
            code:    w.current.weather_code,
            wind:    Math.round(w.current.wind_speed_10m),
            city:    g.address?.city || g.address?.town || g.address?.village || 'Position',
            sunrise: fmtTime(w.daily?.sunrise?.[0]),
            sunset:  fmtTime(w.daily?.sunset?.[0]),
          })
        } catch { resolve(null) }
      },
      () => resolve(null),
      { timeout: 6000, maximumAge: 600000 }
    )
  })
}

async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const { data } = await res.json()
    if (!data?.[0]) return null
    return {
      value:          parseInt(data[0].value, 10),
      classification: data[0].value_classification, // label officiel de la source
    }
  } catch { return null }
}

async function fetchFx() {
  try {
    const res = await fetch('/api/fx')
    if (!res.ok) return null
    const { rates, date } = await res.json()
    return { rates, date }
  } catch { return null }
}

// ── Modal graphe 7 jours ──────────────────────────────────────────────────────

function GrapheModal({ item, onClose }) {
  const [chartData, setChartData] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    setChartData(null)
    setError(false)
    setLoading(true)
    if (!item.coinId) { setLoading(false); return }
    fetch(
      `https://api.coingecko.com/api/v3/coins/${item.coinId}/market_chart` +
      `?vs_currency=usd&days=7&interval=daily`
    )
      .then(r => r.json())
      .then(({ prices }) => {
        setChartData(
          (prices || []).map(([ts, price]) => ({
            date: new Date(ts).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' }),
            price,
          }))
        )
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [item.coinId])

  const change7d = chartData?.length >= 2
    ? ((chartData.at(-1).price - chartData[0].price) / chartData[0].price) * 100
    : null
  const pos = change7d != null && change7d > 0
  const neg = change7d != null && change7d < 0
  const lineColor = pos ? 'var(--vert)' : neg ? 'var(--rouge)' : 'var(--or)'

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgba(14,31,58,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />

      {/* Panneau */}
      <motion.div
        className="relative surface-velin w-full max-w-md rounded-xl p-6 z-10"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[9px] font-sans uppercase tracking-[0.2em] text-encre-tertiaire mb-1">
              Historique 7 jours
            </p>
            <h3 className="font-serif font-medium text-[1.3rem] text-encre leading-none">
              {item.label}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-sans text-[0.875rem] text-encre-secondaire tabular-nums">
                {item.prix} {item.unite}
              </span>
              {change7d != null && (
                <span className={`text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded-full ${
                  pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-encre/5 text-encre-tertiaire'
                }`}>
                  {pos ? '+' : ''}{change7d.toFixed(2)} % (7j)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-encre-tertiaire hover:text-encre transition-colors p-1 -mr-1 -mt-1 rounded"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        {loading ? (
          <div className="h-44 flex items-center justify-center">
            <div className="h-6 w-6 border-2 border-or/30 border-t-or rounded-full animate-spin" />
          </div>
        ) : !item.coinId || error ? (
          <div className="h-44 flex items-center justify-center">
            <p className="font-sans text-sm text-encre-tertiaire text-center px-4">
              {!item.coinId
                ? 'Historique indisponible pour cet actif.'
                : 'Impossible de charger le graphique.'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(31,24,16,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                axisLine={false} tickLine={false} width={56}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--velin-clair)',
                  border: '1px solid rgba(184,149,74,0.2)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--encre)',
                  padding: '6px 10px',
                }}
                formatter={v => [`${v.toLocaleString('fr-BE', { maximumFractionDigits: 2 })} $`, item.label]}
                labelStyle={{ color: 'var(--encre-tertiaire)', marginBottom: 2 }}
              />
              <Line
                type="monotone" dataKey="price"
                stroke={lineColor} strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        <p className="text-[9px] font-sans text-encre-tertiaire/40 text-right mt-2">
          Source : CoinGecko
        </p>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── Widget Météo ──────────────────────────────────────────────────────────────

function WidgetMeteo({ weather }) {

  if (weather === undefined) {
    return (
      <div className="surface-velin liserer-signature p-5 flex gap-4 items-center animate-pulse h-full">
        <div className="h-9 w-9 bg-encre/6 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 bg-encre/6 rounded" />
          <div className="h-5 w-16 bg-encre/8 rounded" />
          <div className="h-2.5 w-28 bg-encre/5 rounded" />
        </div>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="surface-velin liserer-signature p-5 h-full flex items-center gap-3">
        <MapPin size={18} className="text-encre-tertiaire/40 shrink-0" aria-hidden="true" />
        <p className="font-sans text-xs text-encre-tertiaire">Météo indisponible — localisation désactivée</p>
      </div>
    )
  }

  const { Icon: WeatherIcon, label: weatherLabel, color } = getWmo(weather.code)

  return (
    <div className="surface-velin liserer-signature p-5 h-full flex items-center justify-center gap-4">
      <WeatherIcon size={38} strokeWidth={1.3} style={{ color }} aria-hidden="true" className="shrink-0" />
      <div className="min-w-0 flex-1">
        {/* Température + ville */}
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="font-serif font-medium text-[1.7rem] text-encre leading-none tabular-nums">
            {weather.temp}°C
          </span>
          <span className="font-sans text-[12px] text-encre-secondaire truncate">{weather.city}</span>
        </div>
        {/* Condition + vent */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="font-sans text-[12px] text-encre font-medium">{weatherLabel}</span>
          <span className="text-encre-tertiaire/30 text-[10px]">·</span>
          <Wind size={11} className="text-encre-tertiaire/60 shrink-0" aria-hidden="true" />
          <span className="font-sans text-[12px] text-encre-secondaire">{weather.wind} km/h</span>
        </div>
        {/* Lever / coucher */}
        {(weather.sunrise || weather.sunset) && (
          <div className="flex items-center gap-4 mt-1.5">
            {weather.sunrise && (
              <span className="flex items-center gap-1.5">
                <Sunrise size={11} className="text-or/70 shrink-0" aria-hidden="true" />
                <span className="font-sans text-[12px] text-encre-secondaire tabular-nums">{weather.sunrise}</span>
              </span>
            )}
            {weather.sunset && (
              <span className="flex items-center gap-1.5">
                <Sunset size={11} className="text-encre-tertiaire/60 shrink-0" aria-hidden="true" />
                <span className="font-sans text-[12px] text-encre-secondaire tabular-nums">{weather.sunset}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Widget Fear & Greed ───────────────────────────────────────────────────────

function WidgetFearGreed({ fg }) {

  if (fg === undefined) {
    return (
      <div className="surface-velin liserer-signature p-5 h-full flex gap-4 items-center animate-pulse">
        <div className="h-12 w-12 bg-encre/6 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-28 bg-encre/5 rounded" />
          <div className="h-5 w-20 bg-encre/8 rounded" />
        </div>
      </div>
    )
  }

  if (!fg) {
    return (
      <div className="surface-velin liserer-signature p-5 h-full flex items-center gap-3">
        <Activity size={18} className="text-encre-tertiaire/40 shrink-0" aria-hidden="true" />
        <p className="font-sans text-xs text-encre-tertiaire">Sentiment indisponible</p>
      </div>
    )
  }

  const { color, bg } = getFgStyle(fg.classification)
  const labelFr = FG_FR[fg.classification] ?? fg.classification

  return (
    <div className="surface-velin liserer-signature p-5 h-full flex items-center justify-center gap-4">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
        style={{ background: bg }}
        aria-hidden="true"
      >
        <span className="font-sans font-bold text-[1.15rem] tabular-nums leading-none" style={{ color }}>
          {fg.value}
        </span>
      </div>
      <div>
        <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/70">
          Fear &amp; Greed
        </p>
        <p className="font-serif font-semibold text-[1.2rem] text-encre leading-snug mt-0.5">
          {labelFr}
        </p>
      </div>
    </div>
  )
}

// ── Widget Taux de change ─────────────────────────────────────────────────────

const FX_PAIRS = [
  { key: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { key: 'USD', label: 'USD', flag: '🇺🇸' },
  { key: 'GBP', label: 'GBP', flag: '🇬🇧' },
  { key: 'CHF', label: 'CHF', flag: '🇨🇭' },
]

function WidgetFx({ fx }) {
  const [activeField, setActiveField] = useState('EUR')
  const [activeValue, setActiveValue] = useState('')

  const rates = useMemo(() => ({
    EUR: 1,
    USD: fx?.rates?.USD ?? null,
    GBP: fx?.rates?.GBP ?? null,
    CHF: fx?.rates?.CHF ?? null,
  }), [fx])

  const ready = !!(fx && rates.USD && rates.GBP && rates.CHF)

  // Valeur en EUR de ce que l'utilisateur a tapé
  const eurEq = useMemo(() => {
    const num = parseFloat(activeValue)
    if (!num || isNaN(num) || num <= 0) return 0
    const r = rates[activeField]
    if (!r) return 0
    return num / r
  }, [activeField, activeValue, rates])

  function getDerived(field) {
    if (!eurEq) return ''
    const r = rates[field]
    if (!r) return ''
    return (eurEq * r).toFixed(4)
  }

  function getValue(field) {
    return field === activeField ? activeValue : getDerived(field)
  }

  function handleFocus(field) {
    if (field === activeField) return
    setActiveField(field)
    setActiveValue(getDerived(field))
  }

  if (fx === undefined) {
    return (
      <div className="surface-velin liserer-signature p-5 animate-pulse">
        <div className="h-3 w-28 bg-encre/6 rounded mb-5" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-xl p-4">
              <div className="h-3 w-8 bg-encre/6 rounded" />
              <div className="h-6 w-16 bg-encre/8 rounded" />
              <div className="h-2.5 w-12 bg-encre/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!fx) {
    return (
      <div className="surface-velin liserer-signature p-5 flex items-center gap-3 min-h-[120px]">
        <ArrowRightLeft size={18} className="text-encre-tertiaire/40 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-sans text-sm text-encre-tertiaire">Taux de change indisponibles</p>
          <p className="font-sans text-[11px] text-encre-tertiaire/50 mt-0.5">Vérifiez la connexion ou actualisez</p>
        </div>
      </div>
    )
  }

  return (
    <div className="surface-velin liserer-signature p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={13} strokeWidth={1.75} className="text-or/70 shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/80">
            Taux de change
          </span>
        </div>
        <span className="text-[10px] font-sans font-medium text-encre-tertiaire/60 tabular-nums">{fx.date} · ECB</span>
      </div>

      {/* Mobile : 2 colonnes — Desktop : 4 colonnes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FX_PAIRS.map(({ key, flag, label }) => {
          const isActive = key === activeField
          const val = getValue(key)
          const rate = key === 'EUR' ? 'base' : rates[key]?.toFixed(4) ?? '—'
          return (
            <div
              key={key}
              onClick={() => !isActive && handleFocus(key)}
              className={`flex flex-col items-center gap-2 rounded-xl px-2 py-4 transition-colors duration-150 cursor-pointer
                ${isActive ? 'bg-velin-fonce/60 ring-1 ring-or/25' : 'hover:bg-velin-fonce/30'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] leading-none" aria-hidden="true">{flag}</span>
                <span className={`font-sans text-[12px] font-bold uppercase tracking-wider
                  ${isActive ? 'text-or' : 'text-encre-secondaire/70'}`}>
                  {label}
                </span>
              </div>
              <input
                type="number"
                min="0"
                value={val}
                placeholder={ready ? '0' : '…'}
                disabled={!ready}
                onChange={e => { setActiveField(key); setActiveValue(e.target.value) }}
                onFocus={() => handleFocus(key)}
                className="w-full font-serif font-medium text-[1.15rem] sm:text-[1.25rem] text-encre
                  bg-transparent outline-none text-center tabular-nums
                  disabled:opacity-30 placeholder:text-encre-tertiaire/30"
              />
              <span className={`font-sans text-[11px] font-medium tabular-nums text-center
                ${key === 'EUR' ? 'text-encre-tertiaire/35 italic' : 'text-encre-secondaire/60'}`}>
                {rate}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Widget BCE / Fed ──────────────────────────────────────────────────────────

// Dates des réunions de politique monétaire 2026 (décision = dernier jour)
const REUNIONS = {
  bce: [
    '2026-06-04', '2026-07-23', '2026-09-10', '2026-10-29', '2026-12-17',
  ],
  fed: [
    '2026-06-17', '2026-07-29', '2026-09-16', '2026-11-04', '2026-12-16',
  ],
}

function prochaine(dates) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return dates.find(d => new Date(d) >= today) ?? null
}

function joursAvant(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
}

const BCE_INFO = { nom: 'Banque Centrale Européenne', ville: 'Francfort', color: '#3B82F6' }
const FED_INFO = { nom: 'Réserve Fédérale', ville: 'Washington D.C.', color: '#22C55E' }

function WidgetBceFed() {
  const nextBce = prochaine(REUNIONS.bce)
  const nextFed = prochaine(REUNIONS.fed)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const restantBce = REUNIONS.bce.filter(d => new Date(d) >= today).length
  const restantFed = REUNIONS.fed.filter(d => new Date(d) >= today).length

  const Row = ({ sigle, info, dateStr }) => {
    if (!dateStr) return null
    const jours = joursAvant(dateStr)
    const date = new Date(dateStr).toLocaleDateString('fr-BE', {
      weekday: 'short', day: 'numeric', month: 'long',
    })
    const restant = sigle === 'BCE' ? restantBce : restantFed
    return (
      <div className="py-2.5 border-b border-encre/6 last:border-b-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: info.color + '18', color: info.color }}
            >
              {sigle}
            </span>
            <span className="font-sans text-[11px] text-encre-tertiaire/60 hidden sm:inline">
              {info.nom}
            </span>
          </div>
          <span className="font-serif font-semibold text-[1.15rem] text-encre tabular-nums leading-none">
            J-{jours}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-sans text-[11px] text-encre-secondaire tabular-nums capitalize">{date}</span>
          <span className="font-sans text-[9px] text-encre-tertiaire/40">
            {restant} réunion{restant > 1 ? 's' : ''} restante{restant > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="surface-velin liserer-signature p-5 h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-3">
        <Landmark size={12} strokeWidth={1.75} className="text-or/60 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.15em] text-encre-tertiaire/80">
          Décisions de politique monétaire
        </span>
      </div>
      <Row sigle="BCE" info={BCE_INFO} dateStr={nextBce} />
      <Row sigle="FED" info={FED_INFO} dateStr={nextFed} />
      <p className="text-[9px] font-sans text-encre-tertiaire/35 mt-2.5">
        Calendrier indicatif 2026 · dates de décision
      </p>
    </div>
  )
}

// ── Widget Portfolio perso ────────────────────────────────────────────────────

const CONV_FIELDS = [
  { key: 'btc', symbol: 'BTC', label: 'Bitcoin', dec: 8 },
  { key: 'sol', symbol: 'SOL', label: 'Solana',  dec: 4 },
  { key: 'xrp', symbol: 'XRP', label: 'XRP',     dec: 2 },
  { key: 'bnb', symbol: 'BNB', label: 'BNB',     dec: 4 },
  { key: 'usd', symbol: 'USD', label: 'Dollar',  dec: 2 },
]

function WidgetPortfolio({ markets, loading: marketsLoading }) {
  const [activeField, setActiveField] = useState('usd')
  const [activeValue, setActiveValue] = useState('')

  const prices = useMemo(() => ({
    btc: markets?.bitcoin?.usd     ?? null,
    sol: markets?.solana?.usd      ?? null,
    xrp: markets?.ripple?.usd      ?? null,
    bnb: markets?.binancecoin?.usd ?? null,
    usd: 1,
  }), [markets])

  const usdEq = useMemo(() => {
    const num = parseFloat(activeValue)
    if (!num || isNaN(num) || num <= 0) return 0
    return num * (prices[activeField] ?? 0)
  }, [activeField, activeValue, prices])

  function getDerived(field) {
    if (!usdEq) return ''
    const p = prices[field]
    if (!p) return ''
    const dec = CONV_FIELDS.find(f => f.key === field)?.dec ?? 4
    return (usdEq / p).toFixed(dec)
  }

  function getValue(field) {
    return field === activeField ? activeValue : getDerived(field)
  }

  function handleFocus(field) {
    if (field === activeField) return
    setActiveField(field)
    setActiveValue(getDerived(field))
  }

  const ready = !!(prices.btc && prices.sol && prices.xrp && prices.bnb)
  const failed = !marketsLoading && !markets

  return (
    <div className="surface-velin liserer-signature p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wallet size={13} strokeWidth={1.75} className="text-or/70 shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/80">
            Convertisseur
          </span>
        </div>
        <span className="text-[9px] font-sans text-encre-tertiaire/40">
          {failed ? (
            <span className="text-rouge/70">Prix indisponibles</span>
          ) : ready ? 'Prix CoinGecko · USD' : 'Chargement des prix…'}
        </span>
      </div>

      {/* Mobile : lignes horizontales — Desktop : 5 colonnes verticales */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-1 sm:gap-2">
        {CONV_FIELDS.map(({ key, symbol, label }) => {
          const isActive = key === activeField
          const val = getValue(key)
          return (
            <div
              key={key}
              onClick={() => !isActive && handleFocus(key)}
              className={`flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2
                rounded-xl px-3 sm:px-2 py-2.5 sm:py-4 transition-colors duration-150 cursor-pointer
                ${isActive ? 'bg-velin-fonce/60 ring-1 ring-or/25' : 'hover:bg-velin-fonce/30'}`}
            >
              <span className={`font-sans text-[12px] font-bold uppercase tracking-wider
                w-10 shrink-0 sm:w-auto sm:shrink sm:text-center
                ${isActive ? 'text-or' : 'text-encre-secondaire/70'}`}>
                {symbol}
              </span>
              <input
                type="number"
                min="0"
                value={val}
                placeholder={ready ? '0' : failed ? '—' : '…'}
                disabled={!ready}
                onChange={e => { setActiveField(key); setActiveValue(e.target.value) }}
                onFocus={() => handleFocus(key)}
                className="flex-1 sm:w-full font-serif font-medium text-[1.15rem] sm:text-[1.25rem] text-encre
                  bg-transparent outline-none text-right sm:text-center tabular-nums
                  disabled:opacity-30 placeholder:text-encre-tertiaire/30"
              />
              <span className="hidden sm:block font-sans text-[10px] font-medium text-encre-tertiaire/55 text-center leading-tight">
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Séparateur de groupe (barre marchés) ──────────────────────────────────────

function SepGroupe({ label }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-4 shrink-0 select-none">
      <div className="h-8 w-px bg-velin-clair/10" />
      {label && (
        <span className="text-[8px] uppercase tracking-[0.2em] font-sans text-velin-clair/20 mt-1.5 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  )
}

// ── Widget marché (cliquable → graphe) ────────────────────────────────────────

function WidgetMarche({ label, prix, unite, change, loading, coinId, onChartClick }) {
  const pos  = change != null && change > 0
  const neg  = change != null && change < 0
  const Icon = pos ? TrendingUp : neg ? TrendingDown : Minus

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-3 min-w-[100px] shrink-0">
        <div className="h-2 w-10 bg-velin-clair/10 rounded animate-pulse" />
        <div className="h-5 w-20 bg-velin-clair/15 rounded animate-pulse" />
        <div className="h-3.5 w-12 bg-velin-clair/10 rounded-full animate-pulse" />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="flex flex-col gap-0.5 px-3 py-3 min-w-[100px] shrink-0 group/w text-left
        hover:bg-velin-clair/6 rounded-lg transition-colors duration-200"
      onClick={() => onChartClick({ label, prix, unite, coinId: coinId ?? null })}
    >
      <span className="text-[9px] uppercase tracking-[0.18em] font-sans font-medium text-velin-clair/40 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-serif text-[1.2rem] font-medium leading-none
            text-velin-clair group-hover/w:text-or transition-colors duration-200"
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          {prix ?? '--'}
        </span>
        {prix != null && (
          <span className="text-[10px] text-velin-clair/40 font-sans leading-none">{unite}</span>
        )}
      </div>
      {change != null ? (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-sans font-semibold
            px-1.5 py-0.5 rounded-full w-fit leading-none ${
            pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-velin-clair/8 text-velin-clair/35'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          <Icon size={8} strokeWidth={2.5} aria-hidden="true" />
          {change >= 0 ? '+' : ''}{change.toFixed(2)} %
        </span>
      ) : (
        <span className="text-[10px] text-velin-clair/20 font-sans">--</span>
      )}
    </button>
  )
}

// ── Squelette article ─────────────────────────────────────────────────────────

function SqueletteArticle() {
  return (
    <div className="py-4 border-b border-encre/6 last:border-b-0 animate-pulse flex gap-3">
      <div className="h-3 w-4 bg-encre/6 rounded mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-encre/8 rounded w-full" />
        <div className="h-3.5 bg-encre/8 rounded w-4/5" />
        <div className="h-2.5 bg-encre/5 rounded w-2/5 mt-3" />
      </div>
    </div>
  )
}

function EtatErreur() {
  return (
    <div className="py-8 flex flex-col items-center gap-2 text-center">
      <span className="text-[1.5rem] leading-none opacity-40" aria-hidden="true">⚠</span>
      <p className="font-sans text-[12px] text-encre-tertiaire">
        Impossible de charger les articles
      </p>
      <p className="font-sans text-[11px] text-encre-tertiaire/45">
        Vérifiez la connexion ou actualisez
      </p>
    </div>
  )
}

// ── Carte article ─────────────────────────────────────────────────────────────

function CarteArticle({ article, index }) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex gap-3.5 py-3.5 border-b border-encre/6 last:border-b-0
        pl-3 -ml-3 pr-1 rounded-sm transition-colors duration-200 hover:bg-velin-fonce/30"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Liseré gauche doré — grandit au hover */}
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full
          h-0 group-hover:h-8 transition-all duration-300 ease-out"
        style={{ background: 'var(--or)' }}
        aria-hidden="true"
      />

      {/* Numéro éditorial */}
      <span className="text-[10px] font-sans font-medium tabular-nums text-encre-tertiaire/40
        group-hover:text-or/70 transition-colors duration-200 mt-0.5 w-4 shrink-0 leading-snug">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="font-serif font-medium text-[1.2rem] leading-[1.35] text-encre
          group-hover:text-or-fonce transition-colors duration-200 line-clamp-3 mb-2">
          {article.title}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-encre-tertiaire font-sans font-medium truncate">
              {article.source}
            </span>
            <span className="text-encre-tertiaire/30 text-[10px]">·</span>
            <span className="text-[11px] text-encre-tertiaire/60 font-sans shrink-0">
              {tempsRelatif(article.publishedAt)}
            </span>
          </div>
          <span
            className="shrink-0 text-[11px] font-sans font-medium opacity-0
              group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
            style={{ color: 'var(--bordeaux)' }}
          >
            Lire →
          </span>
        </div>
      </div>
    </motion.a>
  )
}

// ── Colonne news ──────────────────────────────────────────────────────────────

function ColonneNews({ category, articles, loading, error }) {
  const { Icon } = category

  return (
    <div className="surface-velin liserer-signature p-5 flex flex-col relative">
      <span
        className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none rounded-t-xl"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--bordeaux-clair) 50%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div className="flex items-center mb-4 pb-3 border-b border-or/15">
        <Icon size={15} strokeWidth={1.75} className="text-or/70 shrink-0 mr-2.5" aria-hidden="true" />
        <h2 className="font-serif font-semibold text-[1.15rem] text-encre leading-none">
          {category.label}
        </h2>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <SqueletteArticle key={i} />)
      ) : error ? (
        <EtatErreur />
      ) : articles.length === 0 ? (
        <p className="text-sm font-serif italic text-encre-tertiaire py-5">Aucun article disponible.</p>
      ) : (
        articles.map((a, i) => <CarteArticle key={a.url} article={a} index={i} />)
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function News() {
  const [activeTab,      setActiveTab]      = useState(0)
  const [markets,        setMarkets]        = useState(null)
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [newsData,       setNewsData]       = useState({})
  const [newsLoading,    setNewsLoading]    = useState(Object.fromEntries(CATEGORIES.map(c => [c.id, true])))
  const [newsError,      setNewsError]      = useState({})
  const [lastRefresh,    setLastRefresh]    = useState(null)
  const [refreshing,     setRefreshing]     = useState(false)
  const [chartItem,      setChartItem]      = useState(null)
  const [weather,        setWeather]        = useState(undefined)
  const [fg,             setFg]             = useState(undefined)
  const [fx,             setFx]             = useState(undefined)

  const chargerMarches = useCallback(async () => {
    setMarketsLoading(true)
    try { setMarkets(await fetchMarkets()) }
    catch { setMarkets(null) }
    finally { setMarketsLoading(false) }
  }, [])

  const chargerNews = useCallback(async () => {
    const results = await Promise.allSettled(CATEGORIES.map(c => fetchNewsCategory(c.id)))
    const data = {}, errors = {}
    CATEGORIES.forEach((cat, i) => {
      if (results[i].status === 'fulfilled') data[cat.id] = results[i].value
      else errors[cat.id] = results[i].reason?.message || 'Erreur inconnue'
    })
    setNewsData(data)
    setNewsError(errors)
    setLastRefresh(new Date())
  }, [])

  const chargerWidgets = useCallback(async () => {
    setWeather(undefined)
    setFg(undefined)
    setFx(undefined)
    const [w, f, x] = await Promise.all([fetchWeather(), fetchFearGreed(), fetchFx()])
    setWeather(w)
    setFg(f)
    setFx(x)
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([chargerMarches(), chargerNews(), chargerWidgets()])
      setNewsLoading({})
    }
    init()
  }, [chargerMarches, chargerNews, chargerWidgets])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    clearNewsCache()
    setRefreshing(true)
    setNewsLoading(Object.fromEntries(CATEGORIES.map(c => [c.id, true])))
    await Promise.all([chargerMarches(), chargerNews(), chargerWidgets()])
    setNewsLoading({})
    setRefreshing(false)
  }, [refreshing, chargerMarches, chargerNews, chargerWidgets])

  const widgetGroups = useMemo(() => {
    const btc = markets?.bitcoin
    const eth = markets?.ethereum
    const sol = markets?.solana
    const xrp = markets?.ripple
    const bnb = markets?.binancecoin
    return [
      {
        key: 'crypto',
        label: 'Crypto',
        items: [
          { label: 'Bitcoin',  prix: btc ? fmt(btc.usd) : null,  unite: '$', change: btc?.usd_24h_change ?? null, coinId: 'bitcoin'      },
          { label: 'Ethereum', prix: eth ? fmt(eth.usd) : null,  unite: '$', change: eth?.usd_24h_change ?? null, coinId: 'ethereum'     },
          { label: 'Solana',   prix: sol ? fmt(sol.usd) : null,  unite: '$', change: sol?.usd_24h_change ?? null, coinId: 'solana'       },
          { label: 'XRP',      prix: xrp ? fmt(xrp.usd) : null,  unite: '$', change: xrp?.usd_24h_change ?? null, coinId: 'ripple'      },
          { label: 'BNB',      prix: bnb ? fmt(bnb.usd) : null,  unite: '$', change: bnb?.usd_24h_change ?? null, coinId: 'binancecoin' },
        ],
      },
      {
        key: 'or',
        label: 'Or',
        items: [
          { label: 'Or (XAU)', prix: markets?.gold?.usd != null ? fmt(markets.gold.usd) : null, unite: '$', change: markets?.gold?.usd_24h_change ?? null, coinId: 'pax-gold' },
        ],
      },
      {
        key: 'indices',
        label: 'Indices',
        items: [
          { label: 'CAC 40',  prix: markets?.cac40?.price != null ? fmt(markets.cac40.price) : null, unite: 'pts', change: markets?.cac40?.change ?? null, coinId: null },
          { label: 'S&P 500', prix: markets?.sp500?.price != null ? fmt(markets.sp500.price) : null, unite: 'pts', change: markets?.sp500?.change ?? null, coinId: null },
          { label: 'BEL 20',  prix: markets?.bel20?.price != null ? fmt(markets.bel20.price) : null, unite: 'pts', change: markets?.bel20?.change ?? null, coinId: null },
        ],
      },
    ]
  }, [markets])

  const heureRefresh = useMemo(() =>
    lastRefresh ? lastRefresh.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : null,
    [lastRefresh]
  )

  return (
    <div className="space-y-5">

      {/* ── En-tête ── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif font-medium text-[1.875rem] text-encre leading-none tracking-tight">
            Observatoire
          </h1>
          <p className="font-sans mt-1 text-[0.75rem]" style={{ color: 'var(--encre-tertiaire)' }}>
            {heureRefresh ? `Actualisé à ${heureRefresh} · Cache 15 min` : 'Chargement…'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualiser les données"
          className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-or/25
            text-encre-secondaire text-xs font-sans hover:bg-velin-fonce hover:border-or/45
            transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} strokeWidth={1.75} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          Actualiser
        </button>
      </div>

      {/* ── Barre marchés ── */}
      <div className="rounded-xl overflow-hidden relative" style={{ background: 'var(--nuit)' }}>
        <span
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'var(--gradient-signature)' }}
          aria-hidden="true"
        />

        {/* Header barre */}
        <div className="px-5 pt-3 pb-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(241,236,224,0.08)' }}>
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--vert)' }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--vert)' }} />
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] font-sans font-medium" style={{ color: 'rgba(241,236,224,0.35)' }}>
            Marchés — temps réel
          </span>
        </div>

        {/* Widgets — scrollable avec fades latéraux */}
        <div className="relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, var(--nuit), transparent)' }}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to left, var(--nuit), transparent)' }}
            aria-hidden="true"
          />
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex min-w-max px-4">
              {widgetGroups.map((group, gi) => (
                <div key={group.key} className="flex shrink-0">
                  {gi > 0 && <SepGroupe label={group.label} />}
                  {group.items.map(w => (
                    <WidgetMarche
                      key={w.label}
                      loading={marketsLoading}
                      {...w}
                      onChartClick={setChartItem}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Widgets — ligne 1 : 3 petits (même hauteur) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <WidgetMeteo weather={weather} />
        <WidgetBceFed />
        <WidgetFearGreed fg={fg} />
      </div>

      {/* ── Widgets — ligne 2 : convertisseur pleine largeur ── */}
      <WidgetPortfolio markets={markets} loading={marketsLoading} />

      {/* ── Widgets — ligne 3 : taux de change pleine largeur ── */}
      <WidgetFx fx={fx} />

      {/* ── Tabs mobile ── */}
      <div
        className="md:hidden flex border-b"
        style={{ borderColor: 'rgba(31,24,16,0.08)' }}
        role="tablist"
      >
        {CATEGORIES.map((cat, i) => {
          const { Icon } = cat
          const active = activeTab === i
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(i)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-sans font-medium
                uppercase tracking-wider transition-colors duration-200 relative
                ${active ? 'text-or' : 'text-encre-tertiaire hover:text-encre'}`}
            >
              <Icon size={13} strokeWidth={active ? 2 : 1.5} aria-hidden="true" />
              {cat.labelCourt}
              {active && (
                <motion.span
                  layoutId="news-tab"
                  className="absolute bottom-0 left-2 right-2 h-px"
                  style={{ background: 'var(--or)' }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Grille desktop ── */}
      <div className="hidden md:grid grid-cols-2 gap-4 items-start">
        {CATEGORIES.map(cat => (
          <ColonneNews
            key={cat.id}
            category={cat}
            articles={newsData[cat.id] || []}
            loading={!!newsLoading[cat.id]}
            error={newsError[cat.id] || null}
          />
        ))}
      </div>

      {/* ── Colonne active mobile ── */}
      <div className="md:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <ColonneNews
              category={CATEGORIES[activeTab]}
              articles={newsData[CATEGORIES[activeTab].id] || []}
              loading={!!newsLoading[CATEGORIES[activeTab].id]}
              error={newsError[CATEGORIES[activeTab].id] || null}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modal graphe prix ── */}
      <AnimatePresence>
        {chartItem && (
          <GrapheModal
            key="chart-modal"
            item={chartItem}
            onClose={() => setChartItem(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
