import { useState, useMemo } from 'react'
import { ArrowRightLeft } from 'lucide-react'

const FX_PAIRS = [
  { key: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { key: 'USD', label: 'USD', flag: '🇺🇸' },
  { key: 'GBP', label: 'GBP', flag: '🇬🇧' },
  { key: 'CHF', label: 'CHF', flag: '🇨🇭' },
]

export async function fetchFx() {
  try {
    const res = await fetch('/api/fx')
    if (!res.ok) return null
    const { rates, date } = await res.json()
    return { rates, date }
  } catch { return null }
}

export function WidgetFx({ fx }) {
  const [activeField, setActiveField] = useState('EUR')
  const [activeValue, setActiveValue] = useState('')

  const rates = useMemo(() => ({
    EUR: 1,
    USD: fx?.rates?.USD ?? null,
    GBP: fx?.rates?.GBP ?? null,
    CHF: fx?.rates?.CHF ?? null,
  }), [fx])

  const ready = !!(fx && rates.USD && rates.GBP && rates.CHF)

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
    if (!r || isNaN(r)) return ''
    const result = eurEq * r
    if (!isFinite(result)) return ''
    return result.toFixed(4)
  }

  function getValue(field) {
    const v = field === activeField ? activeValue : getDerived(field)
    return (v === null || v === undefined) ? '' : v
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
          <p className="font-sans text-[15px] text-encre-tertiaire">Taux de change indisponibles</p>
          <p className="font-sans text-[12px] text-encre-tertiaire/50 mt-0.5">Vérifiez la connexion ou actualisez</p>
        </div>
      </div>
    )
  }

  return (
    <div className="surface-velin liserer-signature p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={13} strokeWidth={1.75} className="text-or/70 shrink-0" aria-hidden="true" />
          <span className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/80">
            Taux de change
          </span>
        </div>
        <span className="text-[13px] font-sans font-medium text-encre-tertiaire/80 tabular-nums">{fx.date} · ECB</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FX_PAIRS.map(({ key, flag, label }) => {
          const isActive = key === activeField
          const val = getValue(key)
          const rateNum = key === 'EUR' ? null : rates[key]
          const rateStr = rateNum != null && isFinite(rateNum) ? rateNum.toFixed(4) : (key === 'EUR' ? null : '—')
          return (
            <div
              key={key}
              onClick={() => !isActive && handleFocus(key)}
              className={`relative overflow-hidden flex flex-col items-center gap-2 rounded-xl px-2 py-4 transition-colors duration-150 cursor-pointer
                ${isActive ? 'bg-velin-fonce/60 ring-1 ring-or/25' : 'hover:bg-velin-fonce/40 hover:ring-1 hover:ring-or/15'}`}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, var(--bordeaux) 50%, transparent 100%)' }}
                  aria-hidden="true"
                />
              )}
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '19px', lineHeight: 1 }} aria-hidden="true">{flag}</span>
                <span className={`font-sans text-[13px] font-bold uppercase tracking-wider
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
                className="w-full font-serif font-medium text-[19px] sm:text-[21px] text-encre
                  bg-transparent outline-none text-center tabular-nums
                  disabled:opacity-30 placeholder:text-encre-tertiaire/30
                  focus:shadow-[0_0_0_2px_rgba(184,149,74,0.4)] rounded-sm transition-shadow
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
              />
              {key === 'EUR' ? (
                <span className="font-sans text-[12px] uppercase tracking-wider text-encre-tertiaire
                  px-1.5 py-0.5 rounded bg-velin-fonce">
                  base
                </span>
              ) : (
                <span className="font-sans text-[12px] font-medium text-encre-secondaire/60 text-center tabular-nums"
                  style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
                  {rateStr ?? '—'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
