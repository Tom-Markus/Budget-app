import { useState, useEffect, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Check, X, ChevronLeft, ChevronRight, Calendar, Camera, RotateCcw, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../contexts/AuthContext'

function getTodayIndex() {
  const map = { 0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }
  return map[new Date().getDay()]
}

const JOURS = [
  { id: 'lundi',    court: 'Lun', label: 'Repos',  session: null,   bg: 'rgba(31,24,16,0.07)',    border: 'rgba(31,24,16,0.20)',   text: 'var(--encre)' },
  { id: 'mardi',    court: 'Mar', label: 'Home',   session: 'home', bg: 'rgba(26,45,82,0.10)',    border: 'rgba(26,45,82,0.35)',   text: 'var(--nuit-clair)' },
  { id: 'mercredi', court: 'Mer', label: 'Push',   session: 'push', bg: 'rgba(184,149,74,0.12)',  border: 'rgba(184,149,74,0.45)', text: 'var(--or)' },
  { id: 'jeudi',    court: 'Jeu', label: 'Home',   session: 'home', bg: 'rgba(26,45,82,0.10)',    border: 'rgba(26,45,82,0.35)',   text: 'var(--nuit-clair)' },
  { id: 'vendredi', court: 'Ven', label: 'Legs',   session: 'legs', bg: 'rgba(14,163,113,0.10)',  border: 'rgba(14,163,113,0.45)', text: 'var(--vert)' },
  { id: 'samedi',   court: 'Sam', label: 'Marche', session: null,   bg: 'rgba(31,24,16,0.05)',    border: 'rgba(31,24,16,0.15)',   text: 'var(--encre-secondaire)' },
  { id: 'dimanche', court: 'Dim', label: 'Pull',   session: 'pull', bg: 'rgba(122,38,50,0.10)',   border: 'rgba(122,38,50,0.40)',  text: 'var(--bordeaux-clair)' },
]

const SESSIONS = {
  push: {
    titre: 'Push',
    emoji: '💪',
    sousTitre: 'Pecs · Épaules · Triceps',
    info: '16 séries · ~55 min',
    couleur: 'var(--or)',
    exercices: [
      {
        nom: 'Échauffement', warmup: true, series: '5 min',
        notes: 'Cercles épaules + poignets + dead hang 30 sec',
      },
      {
        nom: 'Incline Bench Press', series: '4 × 8–10',
        notes: 'Haut des pecs en priorité',
        description: 'Allonge-toi sur un banc incliné à 30–45°. Prends les haltères, coudes à environ 70° du corps. Descends lentement jusqu\'à effleurer les pecs, puis pousse vers le haut en ligne droite. Pince les pecs en fin de mouvement sans bloquer les coudes.',
      },
      {
        nom: 'Chest Press (machine)', series: '3 × 10–12',
        notes: 'Charge progressive chaque semaine',
        description: 'Règle l\'assise pour que les poignées soient au niveau des pecs. Pousse en ligne droite devant toi en expirant. Reviens lentement sans laisser les poids se reposer entre les reps — tension constante.',
      },
      {
        nom: 'Shoulder Press (machine)', series: '3 × 10–12',
        notes: 'Pas de blocage des coudes en haut',
        description: 'Règle le siège pour que les poignées soient à hauteur d\'épaules. Pousse vers le haut sans verrouiller les coudes en fin de mouvement. Garde le dos bien appuyé contre le dossier tout au long de la série.',
      },
      {
        nom: 'Élévations latérales machine', series: '3 × 15',
        notes: 'Descente lente, pas de balancement',
        description: 'Assis face à la machine, coudes en appui sur les coussinets. Monte les bras latéralement jusqu\'à hauteur d\'épaule — pas plus. Redescends lentement en 2–3 secondes pour maximiser le travail du deltoïde médian.',
      },
      {
        nom: 'Triceps Pushdown (corde)', series: '3 × 12–15',
        notes: 'Coudes fixes, extension complète',
        description: 'Prends la corde en prise neutre, coudes collés aux côtes et fixes. Étends les bras vers le bas en écartant légèrement la corde en fin de mouvement. Reviens lentement — coudes qui remontent = triche.',
      },
      {
        nom: 'Pec Deck', series: '3 × 12–15',
        notes: 'Contraction maximale en fin de mouvement',
        description: 'Assis dos au dossier, place les avant-bras sur les coussinets. Ferme les bras devant toi en contractant fort les pecs, maintiens 1 seconde en position fermée. Reviens lentement sans laisser les bras partir derrière la ligne des épaules.',
      },
    ],
  },
  legs: {
    titre: 'Legs',
    emoji: '🦵',
    sousTitre: 'Fessiers · Ischios · Quads · Mollets',
    info: '16 séries · ~55 min',
    couleur: 'var(--vert)',
    exercices: [
      {
        nom: 'Échauffement', warmup: true, series: '5 min',
        notes: 'Cercles hanches + genoux + chevilles + 2 min tapis incliné',
      },
      {
        nom: 'Goblet Squat (haltère)', montagne: true, series: '3 × 10–12',
        notes: 'Descends profond, dos droit',
        description: 'Tiens un haltère vertical contre ta poitrine. Pieds à largeur d\'épaules, légèrement tournés vers l\'extérieur. Descends profond (cuisses parallèles au sol ou plus bas) en gardant le dos droit et les talons au sol. Pousse dans le sol pour remonter.',
      },
      {
        nom: 'Leg Press (pieds hauts)', montagne: true, series: '4 × 8–12',
        notes: 'Pieds hauts = fessiers et ischios',
        description: 'Positionne les pieds en haut de la plateforme pour cibler fessiers et ischios. Débloque les sécurités, descends lentement en pliant les genoux jusqu\'à 90°, remonte en poussant avec les talons. Genoux dans l\'axe des orteils à tout moment.',
      },
      {
        nom: 'Fentes marchées', montagne: true, series: '3 × 10/jambe',
        notes: 'Stabilité cheville sur terrain accidenté',
        description: 'Fais un grand pas en avant, descends le genou arrière près du sol sans le toucher. Remonte en poussant fort avec le pied avant, avance l\'autre jambe. Garde le buste vertical et les abdos engagés pour la stabilité.',
      },
      {
        nom: 'Seated Leg Curl', montagne: true, series: '3 × 12–15',
        notes: 'Freins en descente — protège les genoux',
        description: 'Règle la machine pour que l\'axe de rotation soit aligné avec ton genou. Tire les jambes vers toi en contractant les ischios. Reviens très lentement sur 2–3 secondes — c\'est la phase excentrique qui renforce les ischios et protège les genoux en descente.',
      },
      {
        nom: 'Calf Raise', montagne: true, series: '3 × 15–20',
        notes: 'Single leg si trop facile',
        description: 'Debout, avant des pieds sur le bord d\'une marche. Descends les talons sous le niveau de la marche pour un étirement complet, puis monte le plus haut possible sur la pointe des pieds. Pause d\'une seconde en haut, descente contrôlée.',
      },
      {
        nom: 'Machine abdos', optionnel: true, series: '3 × 15–20',
        notes: 'Core = stabilité avec sac à dos',
        description: 'Assis sur la machine, prends les poignées ou place les mains derrière la tête. Fléchis le buste vers les genoux en contractant les abdos — pas les hanches. Reviens lentement à la position initiale sans laisser le poids te tirer vers l\'arrière.',
      },
    ],
    note: 'Abdos sacrifiables si tu dépasses 55 min.',
  },
  pull: {
    titre: 'Pull',
    emoji: '🏋️',
    sousTitre: 'Dos · Biceps · Arrière épaules',
    info: '16 séries · ~55 min',
    couleur: 'var(--bordeaux-clair)',
    exercices: [
      {
        nom: 'Échauffement', warmup: true, series: '5 min',
        notes: 'Cercles épaules + dead hang 30 sec',
      },
      {
        nom: 'Tractions (barres)', series: '3 séries',
        notes: '2 mi-échec + 1 full échec',
        description: 'Suspends-toi en prise pronation, mains largeur d\'épaules ou plus large. Tire ta poitrine vers la barre en ramenant les coudes vers les hanches — pas en arrière. Descends jusqu\'à extension complète des bras entre chaque rep.',
      },
      {
        nom: 'Lat Pulldown (prise large)', series: '4 × 8–12',
        notes: 'Tire vers le menton, coudes vers les hanches',
        description: 'Prise large au-delà des épaules. Incline légèrement le buste en arrière, tire la barre vers le menton en ramenant les coudes vers les hanches et vers le bas. Ne tire jamais derrière la nuque. Remonte lentement en contrôlant.',
      },
      {
        nom: 'Seated Row', series: '3 × 10–12',
        notes: 'Serre les omoplates en fin de mouvement',
        description: 'Dos droit avec une légère cambrure naturelle. Tire la poignée vers ton nombril en serrant les omoplates l\'une contre l\'autre en fin de mouvement. Étends les bras complètement en revenant pour étirer le dos — pas d\'arrondissement.',
      },
      {
        nom: 'Reverse Pec Deck', series: '3 × 15',
        notes: 'Face au dossier, retour contrôlé',
        description: 'Assis face au dossier de la machine, prise neutre sur les poignées. Écarte les bras latéralement en contractant les arrières d\'épaules et les rhomboïdes. Reviens lentement sans laisser les bras revenir en avant — contrôle toute la trajectoire.',
      },
      {
        nom: 'Incline Biceps Curl', series: '3 × 8–10',
        notes: 'Full amplitude, pas de triche',
        description: 'Allonge-toi sur un banc incliné à 45°, bras pendants naturellement. Curl les haltères jusqu\'à hauteur d\'épaule en gardant les coudes fixes et le dos au dossier. Descends en extension complète — l\'amplitude est le secret de cet exercice.',
      },
      {
        nom: 'Hammer Curl poulie basse', series: '3 × 12–15',
        notes: 'Brachial et épaisseur du bras',
        description: 'Debout face à une poulie basse, prise neutre (pouces vers le haut). Fléchis les coudes en alternance en maintenant les coudes proches du corps. Ce mouvement cible le brachial et le brachioradial — donne de l\'épaisseur au bras.',
      },
    ],
  },
  home: {
    titre: 'Séance Home',
    emoji: '🏠',
    sousTitre: 'Core · Équilibre · Mobilité',
    info: '~30 min',
    couleur: 'var(--nuit-clair)',
    exercices: [
      {
        nom: 'Planche frontale', series: '4 × 40 sec',
        notes: 'Corps droit, hanches pas en l\'air',
        description: 'Appuie-toi sur les avant-bras et la pointe des pieds. Corps en ligne droite de la tête aux talons — hanches ni trop hautes ni trop basses. Contracte abdos, fessiers et jambes simultanément. Respire normalement.',
      },
      {
        nom: 'Planche latérale', series: '3 × 30 sec/côté',
        notes: 'Stabilité latérale',
        description: 'Appuie-toi sur un avant-bras et le côté du pied inférieur. Corps en ligne droite de la tête aux talons. Pousse la hanche vers le plafond. Pour progresser, lève la jambe supérieure ou fais des dips latéraux.',
      },
      {
        nom: 'Handstand au mur', series: '5–8 tentatives',
        notes: 'S1–4 : 20 sec · S9+ : réduire contact mur',
        description: 'Place les mains à 20 cm du mur, doigts écartés. Monte en kick-up en poussant les talons contre le mur. Aligne le corps : engage fessiers, abdos, pousse dans le sol avec les paumes. Réduis progressivement le contact avec le mur au fil des semaines.',
      },
      {
        nom: 'Mobilité hanches + épaules', series: '~10 min',
        notes: 'Hip flexor 60 sec/côté + rotation épaule au sol',
        description: 'Hip flexor : genou à terre, pousse les hanches en avant 60 sec par côté. Épaules : allonge-toi sur le dos, bras à 90°, laisse le bras tourner doucement vers le sol en gardant l\'épaule au sol. Tiens les positions, ne force pas.',
      },
      {
        nom: 'Mollets (sur une marche)', montagne: true, series: '3 × 20',
        notes: 'Single leg si trop facile',
        description: 'Debout sur une marche, avant des pieds en appui sur le bord. Descends les talons sous le niveau de la marche pour l\'étirement complet, remonte sur la pointe des pieds, pause 1 sec en haut. Passe en single leg pour progresser.',
      },
    ],
  },
}

const CONSEILS = [
  { emoji: '📈', titre: 'Surcharge progressive', corps: '12 reps propres → +2,5 kg la semaine suivante. Note tes charges — sans ça, zéro progression.' },
  { emoji: '⏱️', titre: 'Temps de repos', corps: 'Polyarticulaires : 2 min. Isolation : 90 sec. Dépasse 1h → saute les abdos.' },
  { emoji: '🎯', titre: 'Alignement des machines', corps: 'Aligne l\'axe de rotation de la machine avec ton articulation à chaque exercice.' },
]

const BUCKET = 'exercise-images'

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const MOIS_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const JOURS_ABREV = ['L','M','M','J','V','S','D']

function DatePickerSport({ value, onChange, placeholder = 'JJ / MM / AAAA' }) {
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
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-2 cursor-pointer font-sans text-sm rounded-xl px-3 h-9 focus:outline-none transition-colors duration-200"
        style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: display ? 'var(--encre)' : 'var(--encre-tertiaire)' }}
      >
        <span>{display || placeholder}</span>
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
              onTouchStart={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <button type="button"
                  onClick={() => yearMode ? setYearStart(s => s - 16) : setView(new Date(year, month - 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm transition-colors duration-150"
                  style={{ color: 'var(--encre-tertiaire)' }}>
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
                <button type="button"
                  onClick={() => setYearMode(m => !m)}
                  className="font-serif italic text-sm px-2 py-1 rounded-sm transition-colors duration-150"
                  style={{ color: 'var(--encre)' }}>
                  {yearMode ? `${yearStart} – ${yearStart + 15}` : `${MOIS_LABELS[month]} ${year}`}
                </button>
                <button type="button"
                  onClick={() => yearMode ? setYearStart(s => s + 16) : setView(new Date(year, month + 1, 1))}
                  className="h-9 w-9 flex items-center justify-center rounded-sm transition-colors duration-150"
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
                        <button key={i} type="button" onClick={() => { d.toLocaleDateString && onChange(d.toLocaleDateString('fr-CA')); setOpen(false) }}
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

function CartePerfHisto({ perf, couleur, onDelete, isDeleting }) {
  const date = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    .format(new Date(perf.date + 'T00:00:00'))
  return (
    <div className="relative group px-3 py-2.5 rounded-xl" style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `2px solid ${couleur}` }}>
      <div className="flex items-baseline justify-between gap-1 pr-4">
        <span className="font-sans font-bold text-sm tabular-nums" style={{ color: couleur }}>
          {perf.poids} kg
        </span>
        <span className="font-sans tabular-nums" style={{ fontSize: '0.65rem', color: 'var(--encre-tertiaire)' }}>
          {date}
        </span>
      </div>
      <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--encre-secondaire)' }}>
        {perf.type === 'serie' ? `${perf.series} × ${perf.reps} reps` : `${perf.reps} rep${Number(perf.reps) > 1 ? 's' : ''}`}
      </p>
      <button
        onClick={() => onDelete(perf.id)}
        disabled={isDeleting}
        className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-[rgba(31,24,16,0.12)] hover:!translate-y-0"
        style={{ color: 'var(--encre-tertiaire)' }}
        aria-label="Supprimer"
      >
        {isDeleting
          ? <span className="inline-block w-2.5 h-2.5 border rounded-full animate-spin" style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
          : <X size={9} strokeWidth={2.5} />
        }
      </button>
    </div>
  )
}

function PoidsChart({ data, couleur, type, onClose }) {
  const svgRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const n = sorted.length

  const W = 480, H = 200
  const PAD = { t: 24, r: 20, b: 36, l: 46 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const gradId = `poids-grad-${type}`

  const fmt = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
  }

  const evolution = n >= 2 ? sorted[n - 1].poids - sorted[0].poids : 0
  const evolutionLabel = evolution > 0 ? `+${evolution} kg` : evolution < 0 ? `${evolution} kg` : '='

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
    fillPath = linePath + ` L ${pts[n - 1].x} ${PAD.t + innerH} L ${pts[0].x} ${PAD.t + innerH} Z`
    yLabels = range === 0
      ? [{ val: maxW, y: PAD.t + innerH / 2 }]
      : [
          { val: maxW, y: getY(maxW) },
          { val: Math.round((minW + maxW) / 2 * 2) / 2, y: getY((minW + maxW) / 2) },
          { val: minW, y: getY(minW) },
        ]
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(10,8,6,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--velin)',
          borderRadius: '20px',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)',
          overflow: 'hidden',
        }}
      >
        {/* Barre couleur */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, transparent 0%, ${couleur} 50%, transparent 100%)` }} />

        <div style={{ padding: '20px 24px 20px' }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-sans font-semibold" style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--encre-tertiaire)' }}>
                Évolution du poids · {type === 'pr' ? 'PR' : 'Séries'}
              </p>
              {n >= 2 && (
                <div className="flex items-center gap-3 mt-2" style={{ height: '2rem' }}>
                  <span className="font-serif italic text-2xl tabular-nums" style={{ color: hp ? couleur : 'rgba(31,24,16,0.18)' }}>
                    {hp ? `${hp.poids} kg` : '— kg'}
                  </span>
                  {hp && (
                    <>
                      <span className="font-sans text-sm" style={{ color: 'var(--encre-secondaire)' }}>
                        {hp.type === 'serie' ? `${hp.series}×${hp.reps} reps` : `${hp.reps} rep${Number(hp.reps) > 1 ? 's' : ''}`}
                      </span>
                      <span className="font-sans tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--encre-tertiaire)' }}>{fmt(hp.date)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {n >= 2 && (
                <span className="font-sans font-bold tabular-nums px-2.5 py-1 rounded-full text-xs"
                  style={{ background: `${evolution >= 0 ? couleur : 'var(--bordeaux-clair)'}18`, color: evolution >= 0 ? couleur : 'var(--bordeaux-clair)' }}>
                  {evolutionLabel}
                </span>
              )}
              <button onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Contenu */}
          {n === 0 && <p className="font-sans text-sm text-center py-8" style={{ color: 'rgba(31,24,16,0.25)' }}>Aucune donnée enregistrée</p>}
          {n === 1 && (
            <div className="text-center py-8">
              <p className="font-serif italic text-3xl" style={{ color: couleur }}>{sorted[0].poids} kg</p>
              <p className="font-sans text-sm mt-2" style={{ color: 'var(--encre-tertiaire)' }}>Un seul enregistrement · {fmt(sorted[0].date)}</p>
            </div>
          )}
          {n >= 2 && (
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
              style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
              onMouseMove={handleMouseMove} onMouseLeave={() => setHovered(null)}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={couleur} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={couleur} stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Lignes de grille horizontales */}
              {[0, 0.5, 1].map((t, i) => (
                <line key={i} x1={PAD.l} y1={PAD.t + t * innerH} x2={PAD.l + innerW} y2={PAD.t + t * innerH}
                  stroke="rgba(31,24,16,0.07)" strokeWidth="1" />
              ))}

              {/* Axe Y — poids permanents à gauche */}
              {yLabels.map((l, i) => (
                <text key={i} x={PAD.l - 7} y={l.y + 3.5} textAnchor="end"
                  style={{ fontSize: '9px', fontFamily: 'sans-serif', fill: 'rgba(31,24,16,0.38)', fontWeight: '500' }}>
                  {l.val} kg
                </text>
              ))}

              {/* Courbe */}
              <path d={fillPath} fill={`url(#${gradId})`} />
              <path d={linePath} fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Points */}
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y}
                  r={hovered === i ? 6 : 4}
                  fill={couleur}
                  opacity={hovered !== null && hovered !== i ? 0.25 : 1}
                  style={{ transition: 'r 0.08s ease, opacity 0.1s ease' }}
                />
              ))}

              {/* Hover : crosshair + ring */}
              {hp && (
                <>
                  <line x1={hp.x} y1={PAD.t} x2={hp.x} y2={PAD.t + innerH}
                    stroke={couleur} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.35" />
                  <circle cx={hp.x} cy={hp.y} r={12} fill="none" stroke={couleur} strokeWidth="1.5" strokeOpacity="0.20" />
                </>
              )}

              {/* Dates X — toujours affichées */}
              <text x={pts[0].x} y={H - 10} textAnchor="start"
                style={{ fontSize: '9px', fontFamily: 'sans-serif', fill: hp && hovered === 0 ? couleur : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === 0 ? '600' : 'normal' }}>
                {fmt(pts[0].date)}
              </text>
              <text x={pts[n - 1].x} y={H - 10} textAnchor="end"
                style={{ fontSize: '9px', fontFamily: 'sans-serif', fill: hp && hovered === n - 1 ? couleur : 'rgba(31,24,16,0.32)', fontWeight: hp && hovered === n - 1 ? '600' : 'normal' }}>
                {fmt(pts[n - 1].date)}
              </text>

              {/* Date du point survolé (si ce n'est pas le premier ou le dernier) */}
              {hp && hovered !== 0 && hovered !== n - 1 && (
                <text x={hp.x} y={H - 10} textAnchor="middle"
                  style={{ fontSize: '9px', fontFamily: 'sans-serif', fill: couleur, fontWeight: '600' }}>
                  {fmt(hp.date)}
                </text>
              )}
            </svg>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ModalExercice({ ex, nomCle, couleur, onClose, customImage, isUploading, onUpload, onSave, isPPL, user }) {
  const fileInputRef = useRef(null)
  const titleInputRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ nom: ex.nom, notes: ex.notes || '', description: ex.description || '' })
  const [perfType, setPerfType] = useState(null)
  const [perfForm, setPerfForm] = useState({ poids: '', reps: '', series: '', date: '' })
  const [savingPerf, setSavingPerf] = useState(false)
  const [perfHistory, setPerfHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [chartOpen, setChartOpen] = useState(null)

  useEffect(() => {
    setDraft({ nom: ex.nom, notes: ex.notes || '', description: ex.description || '' })
    setEditing(false)
    setPerfType(null)
    setPerfForm({ poids: '', reps: '', series: '', date: '' })
    setChartOpen(null)
  }, [nomCle]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPPL || !user) return
    let cancelled = false
    setLoadingHistory(true)
    supabase
      .from('sport_performances')
      .select('id, type, poids, reps, series, date')
      .eq('user_id', user.id)
      .eq('exercise_name', nomCle)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) { setPerfHistory(data || []); setLoadingHistory(false) }
      })
    return () => { cancelled = true }
  }, [nomCle, isPPL, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const perfValide = !!perfType &&
    Number(perfForm.poids) > 0 &&
    Number(perfForm.reps) > 0 &&
    !!perfForm.date &&
    (perfType === 'pr' || Number(perfForm.series) > 0)

  async function handleDeletePerf(id) {
    setDeletingId(id)
    const { error } = await supabase.from('sport_performances').delete().eq('id', id)
    if (!error) setPerfHistory(prev => prev.filter(h => h.id !== id))
    setDeletingId(null)
  }

  async function handleSavePerf() {
    if (!perfValide || !user) return
    setSavingPerf(true)
    const { data, error } = await supabase
      .from('sport_performances')
      .insert({
        user_id: user.id,
        exercise_name: nomCle,
        type: perfType,
        poids: Number(perfForm.poids),
        reps: Number(perfForm.reps),
        series: perfType === 'serie' ? Number(perfForm.series) : null,
        date: perfForm.date,
      })
      .select('id, type, poids, reps, series, date')
      .single()
    if (!error && data) {
      setPerfHistory(prev => [data, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      setPerfType(null)
      setPerfForm({ poids: '', reps: '', series: '', date: '' })
    }
    setSavingPerf(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) onUpload(nomCle, file)
    e.target.value = ''
  }

  function handleSave() {
    onSave(draft)
    setEditing(false)
  }

  useEffect(() => {
    if (editing) {
      // Délai court pour laisser le layout se stabiliser avant d'ouvrir le clavier mobile
      const t = setTimeout(() => titleInputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [editing])

  function handleCancel() {
    setDraft({ nom: ex.nom, notes: ex.notes || '', description: ex.description || '' })
    setEditing(false)
  }

  const inputBase = {
    background: 'transparent',
    color: 'var(--encre)',
    outline: 'none',
    resize: 'none',
    width: '100%',
    fontFamily: 'inherit',
  }

  const photoBouton = (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <button
        onClick={() => !isUploading && fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all hover:opacity-70 active:scale-[0.98]"
        style={{
          background: 'transparent',
          border: '1.5px dashed rgba(31,24,16,0.18)',
          color: 'var(--encre-tertiaire)',
          cursor: isUploading ? 'default' : 'pointer',
        }}
      >
        {isUploading ? (
          <>
            <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin flex-shrink-0"
              style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
            Importation…
          </>
        ) : (
          <>
            <Camera size={13} strokeWidth={1.75} />
            {customImage ? 'Changer la photo' : 'Importer une photo'}
          </>
        )}
      </button>
    </>
  )

  const perfSection = (
    <>
      <p className="font-sans font-bold mb-3"
        style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--encre-secondaire)' }}>
        Performances
      </p>

      {perfType === null ? (
        <div className="rounded-2xl p-3.5" style={{ background: 'rgba(31,24,16,0.04)' }}>
          <p className="font-sans font-medium mb-2.5"
            style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-tertiaire)' }}>
            Type
          </p>
          <div className="flex p-1 rounded-2xl" style={{ background: 'rgba(31,24,16,0.07)', gap: '3px' }}>
            {[['pr', 'PR'], ['serie', 'Série']].map(([id, label]) => (
              <button key={id}
                onClick={() => setPerfType(id)}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.50)'
                  e.currentTarget.style.color = 'var(--encre-secondaire)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--encre-tertiaire)'
                }}
                className="flex-1 h-10 rounded-xl font-semibold font-sans active:scale-[0.98] flex items-center justify-center"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--encre-tertiaire)',
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, color 0.18s ease',
                  fontSize: '0.875rem',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-3.5 space-y-3" style={{ background: 'rgba(31,24,16,0.04)' }}>
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-bold" style={{ color: couleur }}>
              {perfType === 'pr' ? 'PR' : 'Série'}
            </span>
            <button
              onClick={() => { setPerfType(null); setPerfForm({ poids: '', reps: '', series: '', date: '' }) }}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ background: 'rgba(31,24,16,0.08)', color: 'var(--encre-tertiaire)' }}>
              <X size={11} strokeWidth={2} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-sans font-medium mb-1"
                style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-tertiaire)' }}>
                Poids (kg)
              </p>
              <input type="number" step="0.5" min="0" value={perfForm.poids}
                onChange={e => setPerfForm(f => ({ ...f, poids: e.target.value }))} placeholder="ex: 80"
                className="w-full font-sans text-sm rounded-xl px-3 h-9 focus:outline-none transition-colors duration-200"
                style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: 'var(--encre)' }} />
            </div>
            <div>
              <p className="font-sans font-medium mb-1"
                style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-tertiaire)' }}>
                Reps
              </p>
              <input type="number" min="1" value={perfForm.reps}
                onChange={e => setPerfForm(f => ({ ...f, reps: e.target.value }))} placeholder="ex: 8"
                className="w-full font-sans text-sm rounded-xl px-3 h-9 focus:outline-none transition-colors duration-200"
                style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: 'var(--encre)' }} />
            </div>
          </div>
          {perfType === 'serie' && (
            <div>
              <p className="font-sans font-medium mb-1"
                style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-tertiaire)' }}>
                Séries
              </p>
              <input type="number" min="1" value={perfForm.series}
                onChange={e => setPerfForm(f => ({ ...f, series: e.target.value }))} placeholder="ex: 4"
                className="w-full font-sans text-sm rounded-xl px-3 h-9 focus:outline-none transition-colors duration-200"
                style={{ background: 'rgba(31,24,16,0.06)', border: '1px solid rgba(31,24,16,0.10)', color: 'var(--encre)' }} />
            </div>
          )}
          <div>
            <p className="font-sans font-medium mb-1"
              style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-tertiaire)' }}>
              Date
            </p>
            <DatePickerSport value={perfForm.date} onChange={v => setPerfForm(f => ({ ...f, date: v }))} />
          </div>
          <button onClick={handleSavePerf} disabled={!perfValide || savingPerf}
            className="w-full h-9 rounded-xl text-xs font-semibold font-sans transition-all duration-150 active:scale-[0.98]"
            style={{
              background: perfValide ? couleur : 'rgba(31,24,16,0.06)',
              color: perfValide ? '#fff' : 'var(--encre-tertiaire)',
              cursor: perfValide && !savingPerf ? 'pointer' : 'default',
            }}>
            {savingPerf ? 'Enregistrement…' : 'Valider'}
          </button>
        </div>
      )}

      {(perfHistory.length > 0 || loadingHistory) && (
        <div className="mt-4">
          <p className="font-sans font-bold mb-2.5"
            style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--encre-secondaire)' }}>
            Historique
          </p>
          {loadingHistory ? (
            <div className="flex justify-center py-4">
              <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <p className="font-sans font-bold"
                    style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-secondaire)' }}>
                    PR
                  </p>
                  <button
                    onClick={() => setChartOpen(prev => prev === 'pr' ? null : 'pr')}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                    style={{
                      background: chartOpen === 'pr' ? `${couleur}22` : 'rgba(31,24,16,0.07)',
                      color: chartOpen === 'pr' ? couleur : 'var(--encre-tertiaire)',
                    }}
                    title="Voir l'évolution"
                  >
                    <TrendingUp size={12} strokeWidth={2} />
                  </button>
                </div>
                {perfHistory.filter(h => h.type === 'pr').length === 0
                  ? <p className="font-sans text-xs text-center py-2" style={{ color: 'rgba(31,24,16,0.20)' }}>—</p>
                  : perfHistory.filter(h => h.type === 'pr').map(h => <CartePerfHisto key={h.id} perf={h} couleur={couleur} onDelete={handleDeletePerf} isDeleting={deletingId === h.id} />)
                }
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <p className="font-sans font-bold"
                    style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--encre-secondaire)' }}>
                    Séries
                  </p>
                  <button
                    onClick={() => setChartOpen(prev => prev === 'serie' ? null : 'serie')}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110 active:scale-95"
                    style={{
                      background: chartOpen === 'serie' ? `${couleur}22` : 'rgba(31,24,16,0.07)',
                      color: chartOpen === 'serie' ? couleur : 'var(--encre-tertiaire)',
                    }}
                    title="Voir l'évolution"
                  >
                    <TrendingUp size={12} strokeWidth={2} />
                  </button>
                </div>
                {perfHistory.filter(h => h.type === 'serie').length === 0
                  ? <p className="font-sans text-xs text-center py-2" style={{ color: 'rgba(31,24,16,0.20)' }}>—</p>
                  : perfHistory.filter(h => h.type === 'serie').map(h => <CartePerfHisto key={h.id} perf={h} couleur={couleur} onDelete={handleDeletePerf} isDeleting={deletingId === h.id} />)
                }
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )

  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(10,8,6,0.60)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={editing ? undefined : onClose}
    >
      <motion.div
        className={`relative w-full rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col ${isPPL && !editing ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}
        style={{ background: 'var(--velin)', maxHeight: '90dvh', boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 32px 80px rgba(10,8,6,0.36)' }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barre couleur */}
        <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, transparent 0%, ${couleur} 50%, transparent 100%)` }} />

        {/* Boutons header */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={handleCancel}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: 'rgba(10,8,6,0.50)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff' }}
                aria-label="Annuler">
                <X size={14} strokeWidth={2} />
              </button>
              <button onClick={handleSave}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-90"
                style={{ background: couleur, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.20)' }}
                aria-label="Enregistrer">
                <Check size={14} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: 'rgba(10,8,6,0.50)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff' }}
                aria-label="Modifier">
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: 'rgba(10,8,6,0.50)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff' }}
                aria-label="Fermer">
                <X size={14} strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        {isPPL && !editing ? (
          /* ── LAYOUT 2 COLONNES (PPL, mode lecture) ── */
          <div className="flex flex-col sm:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>

            {/* Colonne gauche — image + infos */}
            <div className="sm:w-[52%] flex flex-col overflow-y-auto flex-shrink-0" style={{ minHeight: 0 }}>
              {customImage && (
                <div className="w-full h-52 flex-shrink-0 overflow-hidden relative">
                  <img src={customImage} aria-hidden alt=""
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50 pointer-events-none" />
                  <img src={customImage} alt={ex.nom}
                    className="relative z-10 w-full h-full object-contain" />
                  <div className="absolute inset-x-0 bottom-0 h-14 z-20"
                    style={{ background: 'linear-gradient(to bottom, transparent, var(--velin))' }} />
                </div>
              )}
              <div className="px-5 pt-5 pb-6">
                <div className="flex items-start justify-between gap-3 mb-1 pr-20">
                  <h3 className="font-serif italic text-2xl leading-tight" style={{ color: 'var(--encre)' }}>{ex.nom}</h3>
                  <span className="font-sans font-semibold text-xs tabular-nums whitespace-nowrap flex-shrink-0 mt-1 px-2.5 py-1 rounded-full"
                    style={{ background: `${couleur}1a`, color: couleur }}>{ex.series}</span>
                </div>
                {(ex.montagne || ex.optionnel) && (
                  <div className="flex gap-1.5 mt-2 mb-1 flex-wrap">
                    {ex.montagne && <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>🏔️ montagne</span>}
                    {ex.optionnel && <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>optionnel</span>}
                  </div>
                )}
                <div className="h-px w-full mt-3 mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(31,24,16,0.10) 30%, rgba(31,24,16,0.10) 70%, transparent)' }} />
                {ex.notes && (
                  <div className="mb-4">
                    <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Muscles</p>
                    <div className="px-4 py-3.5 rounded-2xl" style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `3px solid ${couleur}` }}>
                      <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--encre-secondaire)' }}>{ex.notes}</p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2.5" style={{ color: 'var(--encre-secondaire)' }}>Exécution</p>
                  {ex.description
                    ? <p className="font-sans text-[0.875rem] leading-[1.65]" style={{ color: 'var(--encre-secondaire)' }}>{ex.description}</p>
                    : <p className="font-sans text-sm italic" style={{ color: 'var(--encre-tertiaire)' }}>Aucune description — clique sur ✏️ pour en ajouter une.</p>
                  }
                </div>
              </div>
            </div>

            {/* Séparateur vertical */}
            <div className="hidden sm:block w-px flex-shrink-0 self-stretch" style={{ background: 'linear-gradient(180deg, transparent, rgba(31,24,16,0.10) 15%, rgba(31,24,16,0.10) 85%, transparent)' }} />

            {/* Colonne droite — performances + photo */}
            <div className="flex-1 overflow-y-auto px-4 pt-5" style={{ minHeight: 0, paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
              {perfSection}
              <div className="mt-4">{photoBouton}</div>
            </div>
          </div>

        ) : (
          /* ── LAYOUT COLONNE UNIQUE (Home, édition) ── */
          <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
            {customImage && !editing && (
              <div className="w-full h-56 flex-shrink-0 overflow-hidden relative">
                <img src={customImage} aria-hidden alt=""
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50 pointer-events-none" />
                <img src={customImage} alt={ex.nom}
                  className="relative z-10 w-full h-full object-contain" />
                <div className="absolute inset-x-0 bottom-0 h-14 z-20"
                  style={{ background: 'linear-gradient(to bottom, transparent, var(--velin))' }} />
              </div>
            )}
            <div className="px-6 pt-5" style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex items-start justify-between gap-3 mb-1 pr-20">
                {editing ? (
                  <input ref={titleInputRef} value={draft.nom}
                    onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))}
                    className="font-serif italic text-2xl leading-tight flex-1 border-b pb-0.5"
                    style={{ ...inputBase, borderColor: couleur }} />
                ) : (
                  <h3 className="font-serif italic text-2xl leading-tight" style={{ color: 'var(--encre)' }}>{ex.nom}</h3>
                )}
                <span className="font-sans font-semibold text-xs tabular-nums whitespace-nowrap flex-shrink-0 mt-1 px-2.5 py-1 rounded-full"
                  style={{ background: `${couleur}1a`, color: couleur }}>{ex.series}</span>
              </div>
              {(ex.montagne || ex.optionnel) && (
                <div className="flex gap-1.5 mt-2 mb-1 flex-wrap">
                  {ex.montagne && <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>🏔️ montagne</span>}
                  {ex.optionnel && <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>optionnel</span>}
                </div>
              )}
              <div className="h-px w-full mt-3 mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(31,24,16,0.10) 30%, rgba(31,24,16,0.10) 70%, transparent)' }} />
              <div className="mb-4">
                {editing ? (
                  <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `3px solid ${couleur}` }}>
                    <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Muscles</p>
                    <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                      rows={2} placeholder="Ajouter un conseil…" className="font-sans text-sm leading-relaxed"
                      style={{ ...inputBase, color: 'var(--encre-secondaire)' }} />
                  </div>
                ) : ex.notes ? (
                  <div className="mb-4">
                    <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2" style={{ color: 'var(--encre-secondaire)' }}>Muscles</p>
                    <div className="px-4 py-3.5 rounded-2xl" style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `3px solid ${couleur}` }}>
                      <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--encre-secondaire)' }}>{ex.notes}</p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mb-6">
                <p className="font-sans text-xs uppercase tracking-wide font-bold mb-2.5" style={{ color: 'var(--encre-secondaire)' }}>Exécution</p>
                {editing ? (
                  <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    rows={6} placeholder="Décris l'exécution…" className="font-sans text-sm leading-relaxed w-full px-3 py-2.5 rounded-xl"
                    style={{ ...inputBase, color: 'var(--encre-secondaire)', background: 'rgba(31,24,16,0.04)', border: '1px solid rgba(31,24,16,0.10)' }} />
                ) : ex.description ? (
                  <p className="font-sans text-[0.875rem] leading-[1.65]" style={{ color: 'var(--encre-secondaire)' }}>{ex.description}</p>
                ) : (
                  <p className="font-sans text-sm italic" style={{ color: 'var(--encre-tertiaire)' }}>Aucune description — clique sur ✏️ pour en ajouter une.</p>
                )}
              </div>
              {!editing && photoBouton}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )

  return (
    <>
      {createPortal(jsx, document.body)}
      {createPortal(
        <AnimatePresence>
          {chartOpen && (
            <PoidsChart
              key={chartOpen}
              data={perfHistory.filter(h => h.type === chartOpen)}
              couleur={couleur}
              type={chartOpen}
              onClose={() => setChartOpen(null)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

function BoutonCoche({ isChecked, couleur, onCheck, label }) {
  return (
    <button
      onClick={onCheck}
      className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90"
      style={{
        borderColor: couleur,
        background: isChecked ? couleur : 'rgba(31,24,16,0.07)',
      }}
      aria-label={label}
    >
      <Check
        size={13}
        strokeWidth={3}
        color={isChecked ? '#fff' : 'rgba(31,24,16,0.25)'}
      />
    </button>
  )
}

function CarteExercice({ ex, couleur, onInfo, isChecked, onCheck }) {
  if (ex.warmup) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 bg-[rgba(31,24,16,0.03)] hover:bg-[rgba(31,24,16,0.06)]"
        style={{ opacity: isChecked ? 0.5 : 1 }}>
        <BoutonCoche isChecked={isChecked} couleur={couleur} onCheck={onCheck} label="Cocher échauffement" />
        <span className="text-base leading-none">🔥</span>
        <p className="flex-1 font-sans text-sm" style={{ color: 'var(--encre-secondaire)' }}>
          {ex.nom} <span style={{ color: 'var(--encre-tertiaire)' }}>· {ex.notes}</span>
        </p>
        <span className="font-sans text-xs tabular-nums" style={{ color: 'var(--encre-tertiaire)' }}>
          {ex.series}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isChecked ? 'bg-[rgba(31,24,16,0.02)]' : 'bg-[rgba(31,24,16,0.035)] hover:bg-[rgba(31,24,16,0.07)]'}`}>
      <BoutonCoche isChecked={isChecked} couleur={couleur} onCheck={onCheck} label={`Cocher ${ex.nom}`} />

      <div className="flex-1 min-w-0 transition-opacity duration-300" style={{ opacity: isChecked ? 0.45 : 1 }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-sans font-semibold text-sm leading-snug"
            style={{ color: 'var(--encre)', textDecoration: isChecked ? 'line-through' : 'none' }}>
            {ex.nom}
          </p>
          {ex.montagne && <span className="text-xs leading-none">🏔️</span>}
          {ex.optionnel && (
            <span className="font-sans text-[10px] px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
              optionnel
            </span>
          )}
        </div>
        {ex.notes && (
          <p className="font-sans text-xs mt-0.5 leading-snug" style={{ color: 'var(--encre-tertiaire)' }}>
            {ex.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="font-sans font-bold text-sm tabular-nums whitespace-nowrap"
          style={{ color: couleur }}>
          {ex.series}
        </span>
        <button
          onClick={() => onInfo(ex)}
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 active:opacity-60 bg-[rgba(31,24,16,0.09)] hover:bg-[rgba(31,24,16,0.18)] hover:scale-110"
          style={{ color: 'var(--encre-tertiaire)' }}
          aria-label={`Infos ${ex.nom}`}
        >
          <span className="font-sans text-[11px] font-bold leading-none select-none">i</span>
        </button>
      </div>
    </div>
  )
}

export default function Sport() {
  const { user } = useContext(AuthContext)
  const [jourActifId, setJourActifId] = useState(JOURS[getTodayIndex()].id)
  const [modal, setModal] = useState(null)
  const [customImages, setCustomImages] = useState({})
  const [uploading, setUploading] = useState(null)
  const [customExos, setCustomExos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sport_custom_exos') || '{}') }
    catch { return {} }
  })
  const [checkedExos, setCheckedExos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sport_checked_exos') || '{}') }
    catch { return {} }
  })

  function toggleExo(jourId, nomCle) {
    setCheckedExos(prev => {
      const day = prev[jourId] || {}
      const next = { ...prev, [jourId]: { ...day, [nomCle]: !day[nomCle] } }
      localStorage.setItem('sport_checked_exos', JSON.stringify(next))
      return next
    })
  }

  function resetDay(jourId) {
    setCheckedExos(prev => {
      const next = { ...prev, [jourId]: {} }
      localStorage.setItem('sport_checked_exos', JSON.stringify(next))
      return next
    })
  }

  function saveCustomExo(nomCle, changes) {
    setCustomExos(prev => {
      const next = { ...prev, [nomCle]: { ...(prev[nomCle] || {}), ...changes } }
      localStorage.setItem('sport_custom_exos', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (!user) return
    loadImages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadImages() {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(user.id, { limit: 100 })
    if (error || !data || data.length === 0) return

    // Build slug → exercise name reverse map
    const slugToName = {}
    Object.values(SESSIONS).forEach(s => {
      s.exercices.forEach(ex => {
        if (!ex.warmup) slugToName[slugify(ex.nom)] = ex.nom
      })
    })

    const map = {}
    data.forEach(file => {
      const slug = file.name.replace(/\.[^.]+$/, '')
      const exerciseName = slugToName[slug]
      if (exerciseName) {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${user.id}/${file.name}`)
        // Cache-bust with updated_at so images reload after re-upload
        const ts = file.updated_at ? new Date(file.updated_at).getTime() : Date.now()
        map[exerciseName] = `${publicUrl}?t=${ts}`
      }
    })

    setCustomImages(map)
  }

  async function handleUpload(exerciseName, file) {
    if (!user) return
    setUploading(exerciseName)

    const ext = file.name.split('.').pop().toLowerCase()
    const slug = slugify(exerciseName)
    const path = `${user.id}/${slug}.${ext}`

    // Supprimer les anciennes versions du même exercice (extensions différentes)
    const { data: existing } = await supabase.storage.from(BUCKET).list(user.id)
    if (existing) {
      const toDelete = existing
        .filter(f => f.name.replace(/\.[^.]+$/, '') === slug && f.name !== `${slug}.${ext}`)
        .map(f => `${user.id}/${f.name}`)
      if (toDelete.length > 0) await supabase.storage.from(BUCKET).remove(toDelete)
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path)
      setCustomImages(prev => ({
        ...prev,
        [exerciseName]: `${publicUrl}?t=${Date.now()}`,
      }))
    }

    setUploading(null)
  }

  const jourActif = JOURS.find(j => j.id === jourActifId)
  const session = jourActif?.session ? SESSIONS[jourActif.session] : null

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Modal exercice */}
      <AnimatePresence>
        {modal && (
          <ModalExercice
            key={modal.ex.nom}
            ex={{ ...modal.ex, ...(customExos[modal.ex.nom] || {}) }}
            nomCle={modal.ex.nom}
            couleur={modal.couleur}
            onClose={() => setModal(null)}
            customImage={customImages[modal.ex.nom] ?? null}
            isUploading={uploading === modal.ex.nom}
            onUpload={handleUpload}
            onSave={(changes) => saveCustomExo(modal.ex.nom, changes)}
            isPPL={['push', 'pull', 'legs'].includes(modal.session)}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* Sélecteur semaine */}
      <section className="surface-velin liserer-signature px-4 pt-4 pb-4 md:px-5 md:pt-5 md:pb-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar size={11} style={{ color: 'var(--encre-tertiaire)' }} strokeWidth={2.5} />
          <p className="t-label">Cette semaine</p>
        </div>
        <div className="flex rounded-2xl p-1" style={{ background: 'rgba(31,24,16,0.07)', gap: '2px' }}>
          {JOURS.map((jour) => {
            const isActive = jour.id === jourActifId
            const isToday = jour.id === JOURS[getTodayIndex()].id
            return (
              <button
                key={jour.id}
                onClick={() => setJourActifId(jour.id)}
                className="relative flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl group"
                style={{ isolation: 'isolate', gap: '2px' }}
              >
                {/* Carte active glissante */}
                {isActive && (
                  <motion.div
                    layoutId="week-active-card"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'var(--velin)', boxShadow: '0 1px 6px rgba(31,24,16,0.12)' }}
                    transition={{ type: 'spring', bounce: 0.18, duration: 0.36 }}
                  />
                )}
                {/* Hover tint pour les jours inactifs */}
                {!isActive && (
                  <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                    style={{ background: jour.bg }} />
                )}
                {/* Abréviation */}
                <span className="relative z-10 font-sans text-[9px] uppercase tracking-widest font-medium"
                  style={{ color: isActive ? jour.text : 'var(--encre-tertiaire)' }}>
                  {jour.court}
                </span>
                {/* Label session */}
                <span className="relative z-10 font-sans text-[11px] font-bold leading-tight text-center"
                  style={{ color: isActive ? jour.text : 'var(--encre-secondaire)' }}>
                  {jour.label}
                </span>
                {/* Point aujourd'hui */}
                <div className="relative z-10 h-1.5 flex items-center">
                  {isToday && (
                    <div className="w-1 h-1 rounded-full"
                      style={{ background: isActive ? jour.border : 'rgba(31,24,16,0.22)' }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Contenu du jour */}
      {session ? (
        <section className="surface-velin liserer-signature overflow-hidden">
          <div className="px-5 pt-5 pb-4 md:px-6 md:pt-6"
            style={{ borderBottom: '1px solid rgba(31,24,16,0.07)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none">{session.emoji}</span>
                <div>
                  <h2 className="t-h2" style={{ color: session.couleur }}>{session.titre}</h2>
                  <p className="t-body-secondaire mt-0.5">{session.sousTitre}</p>
                </div>
              </div>
              <span className="t-label whitespace-nowrap flex-shrink-0 mt-1">{session.info}</span>
            </div>
          </div>

          <div className="px-5 py-4 md:px-6 space-y-2">
            {session.exercices.map((originalEx, i) => {
              const ex = { ...originalEx, ...(customExos[originalEx.nom] || {}) }
              const isChecked = !!(checkedExos[jourActifId] || {})[originalEx.nom]
              return (
                <CarteExercice
                  key={i}
                  ex={ex}
                  couleur={session.couleur}
                  isChecked={isChecked}
                  onCheck={() => toggleExo(jourActifId, originalEx.nom)}
                  onInfo={() => setModal({ ex: originalEx, couleur: session.couleur, session: jourActif.session })}
                />
              )
            })}
          </div>

          {session.note && (
            <div className="px-5 md:px-6">
              <p className="font-sans text-xs px-4 py-3 rounded-xl"
                style={{
                  background: 'rgba(31,24,16,0.03)',
                  borderLeft: `2px solid ${session.couleur}`,
                  color: 'var(--encre-tertiaire)',
                }}>
                {session.note}
              </p>
            </div>
          )}

          {/* Barre de progression */}
          {(() => {
            const dayChecks = checkedExos[jourActifId] || {}
            const total = session.exercices.length
            const done = session.exercices.filter(e => dayChecks[e.nom]).length
            const pct = total > 0 ? done / total : 0
            const fini = done === total
            return (
              <div className="px-5 md:px-6 pt-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-xs" style={{ color: 'var(--encre-tertiaire)' }}>
                    {fini ? '🎉 Séance terminée !' : `${done} / ${total} exercices`}
                  </span>
                  <span className="font-sans text-xs font-semibold tabular-nums"
                    style={{ color: pct > 0 ? session.couleur : 'var(--encre-tertiaire)' }}>
                    {Math.round(pct * 100)} %
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(31,24,16,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: session.couleur }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })()}

          {/* Bouton réinitialiser */}
          {(() => {
            const dayChecks = checkedExos[jourActifId] || {}
            const done = session.exercices.filter(e => dayChecks[e.nom]).length
            return (
              <div className="px-5 md:px-6 pb-5 pt-2">
                <button
                  onClick={() => resetDay(jourActifId)}
                  disabled={done === 0}
                  className={`w-full py-2 rounded-xl font-sans text-xs transition-all duration-200 active:scale-[0.98] bg-[rgba(31,24,16,0.04)] ${done > 0 ? 'hover:bg-[rgba(31,24,16,0.09)]' : ''}`}
                  style={{
                    color: done > 0 ? 'var(--encre-tertiaire)' : 'rgba(31,24,16,0.18)',
                    cursor: done > 0 ? 'pointer' : 'default',
                  }}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <RotateCcw size={11} strokeWidth={2} />
                    Réinitialiser la séance
                  </span>
                </button>
              </div>
            )
          })()}
        </section>
      ) : jourActif?.id === 'lundi' ? (
        <section className="surface-velin liserer-signature p-6 text-center">
          <p className="text-4xl mb-3">😴</p>
          <p className="t-h3">Repos</p>
          <p className="t-body-secondaire mt-2">Récupération, étirements libres.</p>
        </section>
      ) : (
        <section className="surface-velin liserer-signature p-6 text-center">
          <p className="text-4xl mb-3">🚶</p>
          <p className="t-h3">Marche</p>
          <p className="t-body-secondaire mt-2">30–60 min à ton rythme.</p>
          <p className="t-meta mt-2">
            À partir du mois 4 : sac à dos <strong>5–8 kg</strong> sur des terrains variés.
          </p>
        </section>
      )}

      {/* Règles d'or — salle uniquement */}
      {['push', 'legs', 'pull'].includes(jourActif?.session) && (
        <section className="surface-velin liserer-signature p-4 md:p-6">
          <p className="t-label mb-3">Règles d'or</p>
          <div className="space-y-2.5">
            {CONSEILS.map((c, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
                style={{ background: 'rgba(31,24,16,0.03)' }}>
                <span className="text-xl leading-none flex-shrink-0 mt-0.5">{c.emoji}</span>
                <div>
                  <p className="font-sans font-semibold text-sm" style={{ color: 'var(--encre)' }}>
                    {c.titre}
                  </p>
                  <p className="font-sans text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--encre-tertiaire)' }}>
                    {c.corps}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
