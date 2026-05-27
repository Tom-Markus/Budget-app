import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, LineChart as LineChartIcon, CandlestickChart } from 'lucide-react'
import {
  AreaChart, Area, ComposedChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

function CandlestickShape(props) {
  const { x, width, payload, background, yDomain } = props
  if (!payload || !background || !yDomain || yDomain[0] === 'auto') return null
  const { open, high, low, close } = payload
  if (open == null || high == null || low == null || close == null) return null

  const [dMin, dMax] = yDomain
  const range = dMax - dMin
  if (!range) return null

  const { y: chartY, height: chartH } = background
  const toY     = v => chartY + chartH * (1 - (v - dMin) / range)
  const bullish  = close >= open
  const color    = bullish ? 'var(--vert)' : 'var(--rouge)'
  const bodyTop  = Math.min(toY(open), toY(close))
  const bodyH    = Math.max(Math.abs(toY(close) - toY(open)), 1.5)
  const candleW  = Math.max(width * 0.55, 4)
  const cx       = x + width / 2

  return (
    <g>
      <line x1={cx} y1={toY(high)} x2={cx} y2={toY(low)} stroke={color} strokeWidth={1} opacity={0.7} />
      <rect
        x={cx - candleW / 2} y={bodyTop}
        width={candleW} height={bodyH}
        fill={bullish ? 'rgba(14,163,113,0.85)' : 'rgba(229,57,53,0.85)'}
        stroke={color} strokeWidth={1.5} rx={1}
      />
    </g>
  )
}

function CandleTooltip({ active, payload, unite }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const bullish = (d.close ?? 0) >= (d.open ?? 0)
  const fmt = v => v?.toLocaleString('fr-BE', { maximumFractionDigits: 2 }) ?? '--'
  return (
    <div style={{
      background: 'var(--velin-clair)',
      border: '1px solid rgba(184,149,74,0.2)',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'var(--font-sans)',
      color: 'var(--encre)',
      padding: '8px 12px',
      minWidth: 128,
    }}>
      <div style={{ color: 'var(--encre-tertiaire)', marginBottom: 6, fontSize: 11 }}>{d.date}</div>
      {[['O', d.open], ['H', d.high], ['L', d.low], ['C', d.close]].map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span style={{ color: 'var(--encre-tertiaire)' }}>{label}</span>
          <span style={{
            color: label === 'C' ? (bullish ? 'var(--vert)' : 'var(--rouge)') : 'var(--encre)',
            fontVariantNumeric: 'tabular-nums lining-nums',
          }}>
            {fmt(val)} {unite}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Timeframe options ────────────────────────────────────────────────────────

const TF_OPTIONS = [
  { key: '24h', label: '24h', cgDays: 1    },
  { key: '7j',  label: '7j',  cgDays: 7    },
  { key: '3M',  label: '3M',  cgDays: 90   },
  { key: '1A',  label: '1A',  cgDays: 365  },
  { key: '10A', label: '10A', cgDays: 'max' },
]

const TF_DISPLAY = {
  '24h': '24 heures',
  '7j':  '7 jours',
  '3M':  '3 mois',
  '1A':  '1 an',
  '10A': '10 ans',
}

// ─── CoinGecko line data filtering ───────────────────────────────────────────

function filterCGLinePrices(prices, tf) {
  const seen = new Set()
  const pts  = []

  if (tf === '24h') {
    ;(prices || []).forEach(([ts, price]) => {
      const d   = new Date(ts)
      const key = d.toISOString().slice(0, 13)
      if (seen.has(key)) return
      seen.add(key)
      const timeLabel = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
      const dayLabel  = d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
      pts.push({ idx: pts.length, date: timeLabel, ts, price, fullDate: `${dayLabel} · ${timeLabel}` })
    })
    return pts
  }

  if (tf === '7j') {
    ;(prices || []).forEach(([ts, price]) => {
      const d = new Date(ts)
      const h = d.getUTCHours()
      if (h !== 0 && h !== 12) return
      const key = `${d.toISOString().slice(0, 10)}-${h}`
      if (seen.has(key)) return
      seen.add(key)
      const dayLabel = d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric' })
      pts.push({
        idx: pts.length,
        date: h === 0 ? dayLabel : '',
        fullDate: `${dayLabel} · ${h === 0 ? '00h' : '12h'}`,
        ts, price,
      })
    })
    return pts
  }

  if (tf === '3M') {
    ;(prices || []).forEach(([ts, price]) => {
      const d = new Date(ts)
      if (d.getUTCHours() !== 0) return
      const day = d.toISOString().slice(0, 10)
      if (seen.has(day)) return
      seen.add(day)
      pts.push({
        idx: pts.length,
        date: d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }),
        fullDate: d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        ts, price,
      })
    })
    return pts
  }

  if (tf === '1A') {
    // Données journalières pour >90j → garder 1 point/semaine
    ;(prices || []).forEach(([ts, price], i) => {
      if (i % 7 !== 0) return
      const d = new Date(ts)
      pts.push({
        idx: pts.length,
        date: d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }),
        fullDate: d.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        ts, price,
      })
    })
    return pts
  }

  // 10A — 1 point/mois
  ;(prices || []).forEach(([ts, price], i) => {
    if (i % 30 !== 0) return
    const d = new Date(ts)
    pts.push({
      idx: pts.length,
      date: d.toLocaleDateString('fr-BE', { month: 'short', year: '2-digit' }),
      fullDate: d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' }),
      ts, price,
    })
  })
  return pts
}

// ─── CoinGecko OHLC data per timeframe ───────────────────────────────────────

async function fetchCGOhlc(coinId, tf) {
  const cgDays = { '24h': 1, '7j': 7, '3M': 90, '1A': 365, '10A': 'max' }[tf] || 7
  const r = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${cgDays}`
  )
  if (!r.ok) throw new Error()
  const arr = (await r.json()) || []
  if (!Array.isArray(arr)) throw new Error()

  if (tf === '24h') {
    // Bougies 30min → agréger en bougies 1h
    const hourMap = new Map()
    arr.forEach(([ts, open, high, low, close]) => {
      const key = new Date(ts).toISOString().slice(0, 13)
      if (!hourMap.has(key)) hourMap.set(key, { ts, open, high, low, close })
      else {
        const e = hourMap.get(key)
        e.high = Math.max(e.high, high); e.low = Math.min(e.low, low); e.close = close
      }
    })
    return [...hourMap.values()].sort((a, b) => a.ts - b.ts).map(({ ts, open, high, low, close }) => ({
      date: new Date(ts).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }),
      ts, open, high, low, close,
    }))
  }

  if (tf === '7j') {
    // Bougies 4h → agréger en demi-journées (logique actuelle)
    const halfMap = new Map()
    arr.forEach(([ts, open, high, low, close]) => {
      const d    = new Date(ts)
      const half = d.getUTCHours() < 12 ? '00h' : '12h'
      const key  = `${d.toISOString().slice(0, 10)}-${half}`
      if (!halfMap.has(key)) halfMap.set(key, { ts, open, high, low, close, half })
      else {
        const e = halfMap.get(key)
        e.high = Math.max(e.high, high); e.low = Math.min(e.low, low); e.close = close
      }
    })
    return [...halfMap.values()].sort((a, b) => a.ts - b.ts).slice(-14).map(({ ts, open, high, low, close, half }) => {
      const dayLabel = new Date(ts).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
      return { date: `${dayLabel} · ${half}`, ts, open, high, low, close }
    })
  }

  if (tf === '3M') {
    // Agréger en journalier
    const dayMap = new Map()
    arr.forEach(([ts, open, high, low, close]) => {
      const key = new Date(ts).toISOString().slice(0, 10)
      if (!dayMap.has(key)) dayMap.set(key, { ts, open, high, low, close })
      else {
        const e = dayMap.get(key)
        e.high = Math.max(e.high, high); e.low = Math.min(e.low, low); e.close = close
      }
    })
    return [...dayMap.values()].sort((a, b) => a.ts - b.ts).map(({ ts, open, high, low, close }) => ({
      date: new Date(ts).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }),
      ts, open, high, low, close,
    }))
  }

  if (tf === '1A') {
    // Agréger en hebdomadaire
    const weekMap = new Map()
    arr.sort((a, b) => a[0] - b[0]).forEach(([ts, open, high, low, close]) => {
      const d = new Date(ts)
      const weekStart = new Date(d)
      weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay())
      const key = weekStart.toISOString().slice(0, 10)
      if (!weekMap.has(key)) weekMap.set(key, { ts, open, high, low, close })
      else {
        const e = weekMap.get(key)
        e.high = Math.max(e.high, high); e.low = Math.min(e.low, low); e.close = close
      }
    })
    return [...weekMap.values()].sort((a, b) => a.ts - b.ts).map(({ ts, open, high, low, close }) => ({
      date: new Date(ts).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }),
      ts, open, high, low, close,
    }))
  }

  // 10A — agréger en mensuel
  const monthMap = new Map()
  arr.forEach(([ts, open, high, low, close]) => {
    const d   = new Date(ts)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(key)) monthMap.set(key, { ts, open, high, low, close })
    else {
      const e = monthMap.get(key)
      e.high = Math.max(e.high, high); e.low = Math.min(e.low, low); e.close = close
    }
  })
  return [...monthMap.values()].sort((a, b) => a.ts - b.ts).map(({ ts, open, high, low, close }) => ({
    date: new Date(ts).toLocaleDateString('fr-BE', { month: 'short', year: '2-digit' }),
    ts, open, high, low, close,
  }))
}

// ─── Spinner & error helpers ──────────────────────────────────────────────────

function ChartSpinner() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-or/30 border-t-or rounded-full animate-spin" />
    </div>
  )
}

function ChartError({ msg }) {
  return (
    <div className="h-64 flex items-center justify-center">
      <p className="font-sans text-[15px] text-encre-tertiaire text-center px-4">{msg}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GrapheModal({ item, onClose }) {
  const [tf,          setTf]          = useState('7j')
  const [chartData,   setChartData]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [chartMode,   setChartMode]   = useState('line')
  const [ohlcData,    setOhlcData]    = useState(null)
  const [ohlcLoading, setOhlcLoading] = useState(false)
  const [ohlcError,   setOhlcError]   = useState(false)
  const ohlcKeyRef = useRef(null)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  // Réinitialiser le mode et les données OHLC quand l'actif ou le TF change
  useEffect(() => {
    setChartMode('line')
    setOhlcData(null)
    setOhlcError(false)
    ohlcKeyRef.current = null
  }, [item.coinId, item.indexSymbol, tf])

  // Charger les données de la courbe
  useEffect(() => {
    setChartData(null)
    setError(false)
    setLoading(true)
    if (!item.coinId && !item.indexSymbol) { setLoading(false); return }
    let cancelled = false
    const controller = new AbortController()
    const cgDays = TF_OPTIONS.find(o => o.key === tf)?.cgDays ?? 7
    const url = item.coinId
      ? `https://api.coingecko.com/api/v3/coins/${item.coinId}/market_chart?vs_currency=usd&days=${cgDays}`
      : `/api/history?symbol=${encodeURIComponent(item.indexSymbol)}&tf=${tf}`
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (item.coinId) {
          setChartData(filterCGLinePrices(data.prices, tf))
        } else {
          setChartData((data.points || []).map((p, i) => ({ ...p, idx: i })))
        }
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [item.coinId, item.indexSymbol, tf])

  async function handleModeSwitch(mode) {
    setChartMode(mode)
    if (mode !== 'candle') return
    const key = `${item.coinId || item.indexSymbol}-${tf}`
    if (ohlcKeyRef.current === key) return
    if (!item.coinId && !item.indexSymbol) return
    ohlcKeyRef.current = key
    setOhlcLoading(true)
    setOhlcError(false)
    try {
      let data
      if (item.coinId) {
        data = await fetchCGOhlc(item.coinId, tf)
      } else {
        const r = await fetch(`/api/history?symbol=${encodeURIComponent(item.indexSymbol)}&tf=${tf}`)
        if (!r.ok) throw new Error()
        const json = await r.json()
        data = json.ohlcDays || []
      }
      setOhlcData(data)
    } catch {
      setOhlcError(true)
      ohlcKeyRef.current = null
    } finally {
      setOhlcLoading(false)
    }
  }

  const yDomain = useMemo(() => {
    if (!ohlcData?.length) return ['auto', 'auto']
    const lows  = ohlcData.map(d => d.low).filter(v => v != null && isFinite(v))
    const highs = ohlcData.map(d => d.high).filter(v => v != null && isFinite(v))
    if (!lows.length || !highs.length) return ['auto', 'auto']
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    const pad = (max - min) * 0.08
    return [min - pad, max + pad]
  }, [ohlcData])

  const changePct = chartData?.length >= 2
    ? ((chartData.at(-1).price - chartData[0].price) / chartData[0].price) * 100
    : null
  const pos = changePct != null && changePct > 0
  const neg = changePct != null && changePct < 0
  const lineColor   = pos ? 'var(--vert)' : neg ? 'var(--rouge)' : 'var(--or)'
  const canHaveChart = !!(item.coinId || item.indexSymbol)

  // Intervalle pour l'axe X (évite les labels trop denses)
  const lineXInterval = useMemo(() => {
    const len = chartData?.length || 0
    if (tf === '7j') return 0
    return Math.max(1, Math.floor(len / 7))
  }, [tf, chartData?.length])

  const ohlcXInterval = useMemo(() => {
    const len = ohlcData?.length || 0
    if (tf === '7j') return 0
    return Math.max(1, Math.floor(len / 7))
  }, [tf, ohlcData?.length])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: 'var(--overlay-bg)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />

      <motion.div
        className="relative surface-velin w-full max-w-2xl rounded-xl p-6 z-10"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* En-tête */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-encre-tertiaire mb-1">
              Historique · {TF_DISPLAY[tf]}
            </p>
            <h3 className="font-serif font-medium text-[22px] text-encre leading-none">
              {item.label}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-sans text-[15px] text-encre-secondaire tabular-nums">
                {item.prix} {item.unite}
              </span>
              {changePct != null && (
                <span className={`text-[11px] font-sans font-semibold px-1.5 py-0.5 rounded-full ${
                  pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-encre/5 text-encre-tertiaire'
                }`}>
                  {pos ? '+' : ''}{changePct.toFixed(2)} % ({tf})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canHaveChart && (
              <div className="flex items-center gap-0.5 bg-velin-fonce rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('line')}
                  title="Graphique en ligne"
                  className={`p-1.5 rounded-sm transition-all duration-150 ${
                    chartMode === 'line'
                      ? 'bg-velin-clair text-encre shadow-xs'
                      : 'text-encre-tertiaire hover:text-encre'
                  }`}
                >
                  <LineChartIcon size={13} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('candle')}
                  title="Graphique en bougies"
                  className={`p-1.5 rounded-sm transition-all duration-150 ${
                    chartMode === 'candle'
                      ? 'bg-velin-clair text-encre shadow-xs'
                      : 'text-encre-tertiaire hover:text-encre'
                  }`}
                >
                  <CandlestickChart size={13} strokeWidth={1.75} />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-encre-tertiaire hover:text-encre hover:bg-encre/8 transition-all duration-200 p-1 -mr-1 -mt-1 rounded-md"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sélecteur de période */}
        {canHaveChart && (
          <div className="flex items-center gap-0.5 mb-4">
            {TF_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTf(opt.key)}
                className={`px-3 py-1 rounded text-[11px] font-sans font-medium transition-all duration-150 ${
                  tf === opt.key
                    ? 'bg-or/15 text-or'
                    : 'text-encre-tertiaire hover:text-encre hover:bg-encre/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Graphique courbe */}
        {chartMode === 'line' && (
          loading ? (
            <ChartSpinner />
          ) : !canHaveChart || error ? (
            <ChartError msg={!canHaveChart ? 'Historique indisponible pour cet actif.' : 'Impossible de charger le graphique.'} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="news-graphe-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval={lineXInterval}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                  axisLine={false} tickLine={false} width={56}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--velin-clair)',
                    border: '1px solid rgba(184,149,74,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--encre)',
                    padding: '6px 10px',
                  }}
                  formatter={v => [`${v.toLocaleString('fr-BE', { maximumFractionDigits: 2 })} ${item.unite}`, item.label]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                  labelStyle={{ color: 'var(--encre-tertiaire)', marginBottom: 2 }}
                />
                <Area
                  type="monotone" dataKey="price"
                  stroke={lineColor} strokeWidth={2}
                  fill="url(#news-graphe-fill)"
                  dot={false}
                  activeDot={{ r: 4, fill: lineColor, stroke: 'var(--velin-clair)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        )}

        {/* Graphique bougies */}
        {chartMode === 'candle' && (
          ohlcLoading ? (
            <ChartSpinner />
          ) : ohlcError || !ohlcData?.length ? (
            <ChartError msg="Impossible de charger les données OHLC." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={ohlcData} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  interval={ohlcXInterval}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                  axisLine={false} tickLine={false} width={56}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)}
                />
                <Tooltip content={<CandleTooltip unite={item.unite} />} />
                <Bar
                  dataKey="close"
                  shape={(props) => <CandlestickShape {...props} yDomain={yDomain} />}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )
        )}

        <p className="text-[10px] font-sans text-encre-tertiaire/40 text-right mt-2">
          Source : {item.coinId ? 'CoinGecko' : 'Yahoo Finance'}
        </p>
      </motion.div>
    </motion.div>,
    document.body
  )
}
