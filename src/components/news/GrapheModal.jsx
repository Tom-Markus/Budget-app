import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  const toY   = v  => chartY + chartH * (1 - (v - dMin) / range)
  const yH    = toY(high)
  const yL    = toY(low)
  const yO    = toY(open)
  const yC    = toY(close)
  const bullish  = close >= open
  const color    = bullish ? 'var(--vert)' : 'var(--rouge)'
  const bodyTop  = Math.min(yO, yC)
  const bodyH    = Math.max(Math.abs(yC - yO), 1.5)
  const candleW  = Math.max(width * 0.55, 4)
  const cx       = x + width / 2

  return (
    <g>
      <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={color} strokeWidth={1} opacity={0.7} />
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

export function GrapheModal({ item, onClose }) {
  const [chartData,   setChartData]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [chartMode,   setChartMode]   = useState('line')
  const [ohlcData,    setOhlcData]    = useState(null)
  const [ohlcLoading, setOhlcLoading] = useState(false)
  const [ohlcError,   setOhlcError]   = useState(false)
  const ohlcRequestedRef = useRef(false)

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  useEffect(() => {
    setChartMode('line')
    setOhlcData(null)
    setOhlcError(false)
    ohlcRequestedRef.current = false
  }, [item.coinId, item.indexSymbol])

  useEffect(() => {
    setChartData(null)
    setError(false)
    setLoading(true)
    if (!item.coinId && !item.indexSymbol) { setLoading(false); return }
    let cancelled = false
    const controller = new AbortController()
    const url = item.coinId
      ? `https://api.coingecko.com/api/v3/coins/${item.coinId}/market_chart?vs_currency=usd&days=7`
      : `/api/history?symbol=${encodeURIComponent(item.indexSymbol)}`
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (item.coinId) {
          const seen = new Set()
          const pts = []
          ;(data.prices || []).forEach(([ts, price]) => {
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
              price,
            })
          })
          setChartData(pts)
        } else {
          setChartData((data.points || []).map((p, i) => ({
            ...p,
            idx: i,
            fullDate: p.ts
              ? new Date(p.ts).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) +
                (p.isOpen ? ' · ouverture' : ' · clôture')
              : p.date,
          })))
        }
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; controller.abort() }
  }, [item.coinId, item.indexSymbol])

  async function handleModeSwitch(mode) {
    setChartMode(mode)
    if (mode !== 'candle' || ohlcRequestedRef.current) return
    if (!item.coinId && !item.indexSymbol) return
    ohlcRequestedRef.current = true
    setOhlcLoading(true)
    setOhlcError(false)
    try {
      let data
      if (item.coinId) {
        const r = await fetch(
          `https://api.coingecko.com/api/v3/coins/${item.coinId}/ohlc?vs_currency=usd&days=7`
        )
        if (!r.ok) throw new Error()
        const raw = await r.json()
        const halfMap = new Map()
        ;(Array.isArray(raw) ? raw : []).forEach(([ts, open, high, low, close]) => {
          const d   = new Date(ts)
          const day = d.toISOString().slice(0, 10)
          const half = d.getUTCHours() < 12 ? '00h' : '12h'
          const key = `${day}-${half}`
          if (!halfMap.has(key)) {
            halfMap.set(key, { ts, open, high, low, close, half })
          } else {
            const e = halfMap.get(key)
            e.high  = Math.max(e.high, high)
            e.low   = Math.min(e.low, low)
            e.close = close
          }
        })
        data = Array.from(halfMap.values())
          .sort((a, b) => a.ts - b.ts)
          .slice(-14)
          .map(({ ts, open, high, low, close, half }) => {
            const dayLabel = new Date(ts).toLocaleDateString('fr-BE', {
              weekday: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })
            return { date: `${dayLabel} · ${half}`, ts, open, high, low, close }
          })
      } else {
        const r = await fetch(`/api/history?symbol=${encodeURIComponent(item.indexSymbol)}`)
        if (!r.ok) throw new Error()
        const json = await r.json()
        data = json.ohlcDays || []
      }
      setOhlcData(data)
    } catch {
      setOhlcError(true)
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

  const change7d = chartData?.length >= 2
    ? ((chartData.at(-1).price - chartData[0].price) / chartData[0].price) * 100
    : null
  const pos = change7d != null && change7d > 0
  const neg = change7d != null && change7d < 0
  const lineColor = pos ? 'var(--vert)' : neg ? 'var(--rouge)' : 'var(--or)'
  const canHaveChart = !!(item.coinId || item.indexSymbol)

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
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-encre-tertiaire mb-1">
              Historique 7 jours
            </p>
            <h3 className="font-serif font-medium text-[22px] text-encre leading-none">
              {item.label}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-sans text-[15px] text-encre-secondaire tabular-nums">
                {item.prix} {item.unite}
              </span>
              {change7d != null && (
                <span className={`text-[11px] font-sans font-semibold px-1.5 py-0.5 rounded-full ${
                  pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-encre/5 text-encre-tertiaire'
                }`}>
                  {pos ? '+' : ''}{change7d.toFixed(2)} % (7j)
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

        {chartMode === 'line' && (
          loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-or/30 border-t-or rounded-full animate-spin" />
            </div>
          ) : !canHaveChart || error ? (
            <div className="h-64 flex items-center justify-center">
              <p className="font-sans text-[15px] text-encre-tertiaire text-center px-4">
                {!canHaveChart ? 'Historique indisponible pour cet actif.' : 'Impossible de charger le graphique.'}
              </p>
            </div>
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
                  dataKey="fullDate"
                  tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--encre-tertiaire)' }}
                  axisLine={false} tickLine={false}
                  interval={0}
                  tickFormatter={val =>
                    val?.includes('00h') || val?.includes('ouverture')
                      ? (val?.split(' · ')[0] ?? '')
                      : ''
                  }
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

        {chartMode === 'candle' && (
          ohlcLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-or/30 border-t-or rounded-full animate-spin" />
            </div>
          ) : ohlcError || !ohlcData?.length ? (
            <div className="h-64 flex items-center justify-center">
              <p className="font-sans text-[15px] text-encre-tertiaire text-center px-4">
                Impossible de charger les données OHLC.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={ohlcData} margin={{ top: 4, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
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
