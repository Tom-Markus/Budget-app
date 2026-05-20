import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function SepGroupe({ label }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-3 shrink-0 select-none">
      <div className="h-8 w-px bg-velin-clair/10" />
      {label && (
        <span className="text-[9px] uppercase tracking-[0.2em] font-sans text-velin-clair/20 mt-1.5 whitespace-nowrap">
          {label}
        </span>
      )}
    </div>
  )
}

export function WidgetMarche({ label, prix, unite, change, loading, coinId, indexSymbol, onChartClick }) {
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
        rounded-lg transition-all duration-200
        hover:bg-velin-clair/10 hover:shadow-[0_0_0_1px_rgba(184,149,74,0.14)]"
      onClick={() => onChartClick({ label, prix, unite, coinId: coinId ?? null, indexSymbol: indexSymbol ?? null })}
    >
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans font-medium text-velin-clair/40 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="font-serif text-[20px] font-medium leading-none
            text-velin-clair group-hover/w:text-or transition-colors duration-200"
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          {prix != null ? prix.replace(',', ' , ') : '--'}
        </span>
        {prix != null && (
          <span className="text-[11px] text-velin-clair/40 font-sans leading-none">{unite}</span>
        )}
      </div>
      {change != null ? (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-sans font-semibold
            px-1.5 py-0.5 rounded-full w-fit leading-none ${
            pos ? 'bg-vert/15 text-vert' : neg ? 'bg-rouge/15 text-rouge' : 'bg-velin-clair/8 text-velin-clair/35'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
        >
          <Icon size={8} strokeWidth={2.5} aria-hidden="true" />
          {change >= 0 ? '+' : ''}{change.toFixed(2)} %
        </span>
      ) : (
        <span className="text-[11px] text-velin-clair/20 font-sans">--</span>
      )}
    </button>
  )
}
