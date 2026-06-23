/**
 * GrandLivre.jsx
 * ----------------------------------------------------------------------------
 * Widget « Le Grand Livre » — journal complet des mouvements du cabinet.
 * Pensé pour la page Graphes & Dettes : liste scrollable compacte (max-h fixe)
 * pour ne pas allonger la page.
 *
 * Filtres :
 *   - recherche libre : note, nom d'enveloppe, ou montant exact (parseMontant)
 *   - enveloppe (Patrimoine, normales avec hiérarchie, créances)
 *   - famille de type (reçus / dépenses / allocations / créances)
 *   - période (7J / 30J / 3M / TOUT)
 *
 * Props :
 *   envelopes   — toutes les enveloppes (useApp)
 *   mouvements  — tous les mouvements (useApp) ; les annulés sont exclus ici
 * ----------------------------------------------------------------------------
 */
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { formatEurosSigne, parseMontant } from '../lib/formatters'

const PERIODES = [
  { id: '7J', jours: 7 },
  { id: '30J', jours: 30 },
  { id: '3M', jours: 90 },
  { id: 'TOUT', jours: null },
]

// Libellé, signe d'affichage (point de vue de l'enveloppe) et chip colorée
const TYPES_MOUVEMENT = {
  income:         { label: 'Reçu',       signe: +1, chip: 'bg-vert/10 text-vert' },
  spend:          { label: 'Dépense',    signe: -1, chip: 'bg-rouge/10 text-rouge' },
  allocate:       { label: 'Allocation', signe: +1, chip: 'bg-or/15 text-or-fonce' },
  unallocate:     { label: 'Retour',     signe: -1, chip: 'bg-velin-fonce text-encre-secondaire' },
  creance_add:    { label: 'Prêt',       signe: +1, chip: 'bg-bordeaux/10 text-bordeaux-clair' },
  creance_repaid: { label: 'Remboursé',  signe: -1, chip: 'bg-nuit/10 text-nuit-clair' },
}

const FAMILLES_TYPE = [
  { id: '',        label: 'Tous les types' },
  { id: 'income',  label: 'Reçus' },
  { id: 'spend',   label: 'Dépenses' },
  { id: 'alloc',   label: 'Allocations' },
  { id: 'creance', label: 'Créances' },
]

const PAGE = 50

function formatDateCompacte(dateStr) {
  const d = new Date(dateStr)
  const opts = { day: '2-digit', month: '2-digit' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit'
  return new Intl.DateTimeFormat('fr-BE', opts).format(d)
}

function matchFamille(type, famille) {
  if (!famille) return true
  if (famille === 'alloc') return type === 'allocate' || type === 'unallocate'
  if (famille === 'creance') return type === 'creance_add' || type === 'creance_repaid'
  return type === famille
}

// Lignes du journal, filtrées et triées (plus récent en premier)
function construireLignes(envelopes, mouvements, { recherche, envFiltre, typeFiltre, periode }) {
  const envParId = new Map(envelopes.map(e => [e.id, e]))
  const jours = PERIODES.find(p => p.id === periode)?.jours ?? null
  const cutoff = jours ? Date.now() - jours * 86400000 : null
  const q = recherche.trim().toLowerCase()
  const montantQ = parseMontant(recherche)
  const rechercheMontant = Number.isFinite(montantQ)

  return mouvements
    .filter(m => !m.is_undone)
    // Les comptes épargne sont indépendants : ils n'apparaissent pas au Grand Livre.
    .filter(m => m.type !== 'savings_add' && m.type !== 'savings_withdraw')
    .filter(m => cutoff === null || new Date(m.created_at).getTime() >= cutoff)
    .filter(m => !envFiltre || m.envelope_id === envFiltre)
    .filter(m => matchFamille(m.type, typeFiltre))
    .filter(m => {
      if (!q) return true
      const env = envParId.get(m.envelope_id)
      const texte = `${m.note || ''} ${env?.title || ''}`.toLowerCase()
      if (texte.includes(q)) return true
      return rechercheMontant && Math.abs(Number(m.amount) - montantQ) < 0.005
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(m => {
      const meta = TYPES_MOUVEMENT[m.type]
      return {
        id: m.id,
        date: m.created_at,
        label: meta?.label ?? m.type,
        chip: meta?.chip ?? 'bg-velin-fonce text-encre-secondaire',
        enveloppe: envParId.get(m.envelope_id)?.title ?? 'Enveloppe supprimée',
        montant: (meta?.signe ?? 1) * Number(m.amount),
        note: m.note,
      }
    })
}

export default function GrandLivre({ envelopes, mouvements }) {
  const [recherche, setRecherche] = useState('')
  const [envFiltre, setEnvFiltre] = useState('')
  const [typeFiltre, setTypeFiltre] = useState('')
  const [periode, setPeriode] = useState('30J')
  const [nbVisibles, setNbVisibles] = useState(PAGE)

  // Tout changement de filtre ramène à la première « page »
  const appliquerFiltre = (setter) => (value) => {
    setter(value)
    setNbVisibles(PAGE)
  }

  // Options du select enveloppe : Patrimoine, normales (hiérarchie), créances
  const optionsEnveloppes = useMemo(() => {
    const parPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)
    const out = []
    const total = envelopes.find(e => e.type === 'total')
    if (total) out.push({ id: total.id, label: total.title })
    const ajouterNormales = (parentId, prefixe) => {
      envelopes
        .filter(e => e.type === 'normal' && (e.parent_id || null) === parentId)
        .sort(parPosition)
        .forEach(e => {
          out.push({ id: e.id, label: prefixe + e.title })
          ajouterNormales(e.id, prefixe + '· ')
        })
    }
    ajouterNormales(null, '')
    envelopes
      .filter(e => e.type === 'creance')
      .sort(parPosition)
      .forEach(e => out.push({ id: e.id, label: `Créance · ${e.title}` }))
    return out
  }, [envelopes])

  const lignes = useMemo(
    () => construireLignes(envelopes, mouvements, { recherche, envFiltre, typeFiltre, periode }),
    [envelopes, mouvements, recherche, envFiltre, typeFiltre, periode],
  )

  const total = useMemo(
    () => lignes.reduce((s, l) => s + l.montant, 0),
    [lignes],
  )

  const aucunMouvement = !mouvements.some(m => !m.is_undone)

  return (
    <section className="surface-velin p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="t-label">Journal</p>
          <h2 className="t-h2 mt-2">Le Grand Livre</h2>
        </div>
        <div className="flex gap-1" role="group" aria-label="Période du journal">
          {PERIODES.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => appliquerFiltre(setPeriode)(p.id)}
              aria-pressed={periode === p.id}
              className={`
                px-3 h-8 rounded-md text-xs font-medium transition-colors duration-200
                ${periode === p.id
                  ? 'bg-nuit text-velin-clair'
                  : 'bg-transparent text-encre-secondaire hover:bg-velin-fonce'}
              `}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={15}
            strokeWidth={1.75}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-encre-tertiaire pointer-events-none"
          />
          <input
            type="text"
            value={recherche}
            onChange={e => appliquerFiltre(setRecherche)(e.target.value)}
            placeholder="Note, enveloppe ou montant…"
            aria-label="Rechercher dans le journal"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-velin-clair border border-[rgba(31,24,16,0.12)] text-sm text-encre placeholder:text-encre-tertiaire focus:outline-none focus:border-or/40 font-serif italic"
          />
        </div>
        <select
          value={envFiltre}
          onChange={e => appliquerFiltre(setEnvFiltre)(e.target.value)}
          aria-label="Filtrer par enveloppe"
          className="h-9 max-w-[45%] px-2 rounded-md bg-velin-clair border border-[rgba(31,24,16,0.12)] text-sm text-encre focus:outline-none focus:border-or/40"
        >
          <option value="">Toutes les enveloppes</option>
          {optionsEnveloppes.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <select
          value={typeFiltre}
          onChange={e => appliquerFiltre(setTypeFiltre)(e.target.value)}
          aria-label="Filtrer par type de mouvement"
          className="h-9 px-2 rounded-md bg-velin-clair border border-[rgba(31,24,16,0.12)] text-sm text-encre focus:outline-none focus:border-or/40"
        >
          {FAMILLES_TYPE.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Liste scrollable */}
      <div
        className="mt-4 max-h-72 overflow-y-auto pr-2"
        style={{ overscrollBehavior: 'contain' }}
      >
        {lignes.length === 0 ? (
          <p className="t-meta italic text-center py-8">
            {aucunMouvement
              ? 'Le grand livre est vierge — reçois ou dépense un montant pour l’ouvrir.'
              : 'Aucun mouvement ne correspond à ces filtres.'}
          </p>
        ) : (
          <>
            {lignes.slice(0, nbVisibles).map(l => (
              <div
                key={l.id}
                className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor: 'var(--border-doux)' }}
              >
                <span className="t-meta tabular-nums w-14 shrink-0">
                  {formatDateCompacte(l.date)}
                </span>
                <span
                  className={`hidden sm:inline-flex justify-center w-24 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${l.chip}`}
                >
                  {l.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-encre truncate" title={l.enveloppe}>
                    {l.enveloppe}
                  </p>
                  {l.note && (
                    <p className="t-meta italic truncate" title={l.note}>{l.note}</p>
                  )}
                </div>
                <span
                  className={`font-sans font-medium text-sm tabular-nums shrink-0 ${
                    l.montant >= 0 ? 'signal-positif' : 'signal-negatif'
                  }`}
                >
                  {formatEurosSigne(l.montant)}
                </span>
              </div>
            ))}
            {lignes.length > nbVisibles && (
              <button
                type="button"
                onClick={() => setNbVisibles(n => n + PAGE)}
                className="w-full py-2 mt-1 rounded-md text-xs font-medium text-encre-secondaire hover:text-encre hover:bg-velin-fonce transition-colors duration-200"
              >
                Afficher plus ({lignes.length - nbVisibles} restants)
              </button>
            )}
          </>
        )}
      </div>

      {/* Pied : compte + total des lignes filtrées */}
      <div
        className="mt-4 pt-3 flex items-center justify-between border-t"
        style={{ borderColor: 'var(--border-doux)' }}
      >
        <span className="t-meta">
          {lignes.length} mouvement{lignes.length > 1 ? 's' : ''}
        </span>
        <span className="t-meta">
          Total filtré{' '}:{' '}
          <span
            className={`font-sans font-medium tabular-nums ${
              total >= 0 ? 'signal-positif' : 'signal-negatif'
            }`}
          >
            {formatEurosSigne(total)}
          </span>
        </span>
      </div>
    </section>
  )
}
