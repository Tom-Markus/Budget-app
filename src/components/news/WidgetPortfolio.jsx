import { useState, useMemo } from 'react'
import { Wallet } from 'lucide-react'

const CONV_FIELDS = [
  { key: 'btc', symbol: 'BTC', label: 'Bitcoin', dec: 8 },
  { key: 'sol', symbol: 'SOL', label: 'Solana',  dec: 4 },
  { key: 'xrp', symbol: 'XRP', label: 'XRP',     dec: 2 },
  { key: 'bnb', symbol: 'BNB', label: 'BNB',     dec: 4 },
  { key: 'usd', symbol: 'USD', label: 'Dollar',  dec: 2 },
]

export function WidgetPortfolio({ markets, loading: marketsLoading }) {
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
    if (!p || isNaN(p)) return ''
    const dec = CONV_FIELDS.find(f => f.key === field)?.dec ?? 4
    const result = usdEq / p
    if (!isFinite(result)) return ''
    return result.toFixed(dec)
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

  const ready = !!(prices.btc && prices.sol && prices.xrp && prices.bnb)
  const failed = !marketsLoading && !markets

  return (
    <div className="surface-velin liserer-signature p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wallet size={13} strokeWidth={1.75} className="text-or/70 shrink-0" aria-hidden="true" />
          <span className="text-[12px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/80">
            Convertisseur
          </span>
        </div>
        <span className="text-[10px] font-sans text-encre-tertiaire/40">
          {failed ? (
            <span className="text-rouge/70">Prix indisponibles</span>
          ) : ready ? 'Prix CoinGecko · USD' : 'Chargement des prix…'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-1 sm:gap-2">
        {CONV_FIELDS.map(({ key, symbol, label }) => {
          const isActive = key === activeField
          const val = getValue(key)
          return (
            <div
              key={key}
              onClick={() => !isActive && handleFocus(key)}
              className={`relative overflow-hidden flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2
                rounded-xl px-3 sm:px-2 py-2.5 sm:py-4 transition-colors duration-150 cursor-pointer
                ${isActive ? 'bg-velin-fonce/60 ring-1 ring-or/25' : 'hover:bg-velin-fonce/40 hover:ring-1 hover:ring-or/15'}`}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl hidden sm:block pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, var(--bordeaux) 50%, transparent 100%)' }}
                  aria-hidden="true"
                />
              )}
              <span className={`font-sans text-[13px] font-bold uppercase tracking-wider
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
                className="flex-1 sm:w-full font-serif font-medium text-[19px] sm:text-[21px] text-encre
                  bg-transparent outline-none text-right sm:text-center tabular-nums
                  disabled:opacity-30 placeholder:text-encre-tertiaire/30
                  focus:shadow-[0_0_0_2px_rgba(184,149,74,0.4)] rounded-md transition-shadow
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="hidden sm:block font-sans text-[13px] text-encre-tertiaire text-center leading-tight">
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
