import { Activity } from 'lucide-react'

const FG_FR = {
  'Extreme Fear': 'Peur extrême',
  'Fear':         'Peur',
  'Neutral':      'Neutre',
  'Greed':        'Avidité',
  'Extreme Greed':'Avidité extrême',
}

function getFgStyle(value) {
  if (value <= 25) return { color: 'var(--rouge)',          bg: 'rgba(229,57,53,0.10)'    }
  if (value <= 45) return { color: 'var(--or)',             bg: 'rgba(184,149,74,0.12)'   }
  if (value <= 55) return { color: 'var(--encre-tertiaire)',bg: 'rgba(138,128,115,0.10)'  }
  if (value <= 75) return { color: 'var(--vert)',           bg: 'rgba(14,163,113,0.10)'   }
  return               { color: 'var(--vert)',           bg: 'rgba(14,163,113,0.14)'   }
}

function getFgLabelColor(value) {
  if (value < 30) return 'var(--rouge)'
  if (value > 70) return 'var(--vert)'
  return 'var(--encre-secondaire)'
}

export function WidgetFearGreed({ fg }) {

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
        <p className="font-sans text-[13px] text-encre-tertiaire">Sentiment indisponible</p>
      </div>
    )
  }

  const { color, bg } = getFgStyle(fg.value)
  const labelFr = FG_FR[fg.classification] ?? fg.classification
  const labelColor = getFgLabelColor(fg.value)

  return (
    <div className="surface-velin liserer-signature p-5 h-full flex items-center justify-center gap-5">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center shrink-0"
        style={{ background: bg }}
        aria-hidden="true"
      >
        <span className="font-sans font-bold text-[25px] tabular-nums leading-none" style={{ color }}>
          {fg.value}
        </span>
      </div>
      <div>
        <p className="text-[13px] font-sans font-semibold uppercase tracking-[0.15em] text-encre/70">
          Fear &amp; Greed
        </p>
        <p className="font-serif italic font-medium text-[25px] leading-snug mt-0.5" style={{ color: labelColor }}>
          {labelFr}
        </p>
      </div>
    </div>
  )
}
