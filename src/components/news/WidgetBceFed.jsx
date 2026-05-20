import { Landmark } from 'lucide-react'

const REUNIONS = {
  bce: [
    '2026-06-11', '2026-07-23', '2026-09-10', '2026-10-29', '2026-12-17',
  ],
  fed: [
    '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
  ],
}

function prochaine(dates) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return dates.find(d => new Date(d) >= today) ?? null
}

function joursAvant(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
}

const BCE_INFO = { nom: 'Banque Centrale Européenne', type: 'bce' }
const FED_INFO = { nom: 'Réserve Fédérale',           type: 'fed' }

export function WidgetBceFed() {
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
              className="font-sans font-semibold uppercase"
              style={{
                background:   info.type === 'bce' ? 'rgba(14,31,58,0.12)'  : 'rgba(92,26,36,0.10)',
                color:        info.type === 'bce' ? 'var(--nuit)'           : 'var(--bordeaux)',
                border:       info.type === 'bce' ? '1px solid rgba(14,31,58,0.2)' : '1px solid rgba(92,26,36,0.2)',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize:     '12px',
                letterSpacing:'0.06em',
                padding:      '2px 6px',
              }}
            >
              {sigle}
            </span>
            <span className="font-sans text-[12px] text-encre-tertiaire/60 hidden sm:inline">
              {info.nom}
            </span>
          </div>
          <span className="font-serif font-semibold text-[23px] text-encre tabular-nums leading-none">
            J-{jours}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-sans text-[14px] text-encre-secondaire tabular-nums capitalize">{date}</span>
          <span className="font-sans text-[11px] text-encre-tertiaire/40">
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
        <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.15em] text-encre-tertiaire/80">
          Décisions de politique monétaire
        </span>
      </div>
      <Row sigle="BCE" info={BCE_INFO} dateStr={nextBce} />
      <Row sigle="FED" info={FED_INFO} dateStr={nextFed} />
      <p className="text-[10px] font-sans text-encre-tertiaire/35 mt-2.5">
        Calendrier indicatif {new Date().getFullYear()} · dates de décision
      </p>
    </div>
  )
}
