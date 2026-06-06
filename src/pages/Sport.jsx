import { useState, useEffect, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Pencil, Check, X } from 'lucide-react'
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

function ModalExercice({ ex, nomCle, couleur, onClose, customImage, isUploading, onUpload, onSave }) {
  const fileInputRef = useRef(null)
  const titleInputRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ nom: ex.nom, notes: ex.notes || '', description: ex.description || '' })

  // Sync draft si l'exercice change (ex: on ouvre un autre exo)
  useEffect(() => {
    setDraft({ nom: ex.nom, notes: ex.notes || '', description: ex.description || '' })
    setEditing(false)
  }, [nomCle]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const jsx = (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(10,8,6,0.65)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={editing ? undefined : onClose}
    >
      <motion.div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--velin)', maxHeight: '90dvh', boxShadow: '0 24px 64px rgba(10,8,6,0.28)' }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image */}
        {customImage && !editing && (
          <div className="w-full h-56 flex-shrink-0 overflow-hidden relative">
            {/* Fond flouté — même image scalée, couvre les barres noires */}
            <img src={customImage} aria-hidden alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50 pointer-events-none" />
            {/* Image principale, pas de recadrage */}
            <img src={customImage} alt={ex.nom}
              className="relative z-10 w-full h-full object-contain" />
            {/* Fondu bas */}
            <div className="absolute inset-x-0 bottom-0 h-14 z-20"
              style={{ background: 'linear-gradient(to bottom, transparent, var(--velin))' }} />
          </div>
        )}
        {!customImage && <div className="h-1 w-full flex-shrink-0" style={{ background: couleur }} />}

        {/* Boutons header droite */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {editing ? (
            <>
              <button onClick={handleCancel}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(31,24,16,0.10)', color: 'var(--encre-tertiaire)' }}
                aria-label="Annuler">
                <X size={14} strokeWidth={2} />
              </button>
              <button onClick={handleSave}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: couleur, color: '#fff' }}
                aria-label="Enregistrer">
                <Check size={14} strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(31,24,16,0.10)', color: 'var(--encre-tertiaire)' }}
                aria-label="Modifier">
                <Pencil size={13} strokeWidth={2} />
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 font-bold text-sm"
                style={{ background: 'rgba(31,24,16,0.10)', color: 'var(--encre-secondaire)' }}
                aria-label="Fermer">
                ✕
              </button>
            </>
          )}
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1" style={{ minHeight: 0 }}>
          <div className="px-6 pt-5" style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}>

            {/* Nom + séries */}
            <div className="flex items-start justify-between gap-4 mb-1 pr-20">
              {editing ? (
                <input
                  ref={titleInputRef}
                  value={draft.nom}
                  onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))}
                  className="font-sans font-bold text-xl leading-tight flex-1 border-b pb-0.5"
                  style={{ ...inputBase, borderColor: couleur }}
                />
              ) : (
                <h3 className="font-sans font-bold text-xl leading-tight" style={{ color: 'var(--encre)' }}>
                  {ex.nom}
                </h3>
              )}
              <span className="font-sans font-bold text-base tabular-nums whitespace-nowrap flex-shrink-0 mt-0.5"
                style={{ color: couleur }}>
                {ex.series}
              </span>
            </div>

            {/* Badges */}
            {(ex.montagne || ex.optionnel) && (
              <div className="flex gap-1.5 mt-2 mb-1 flex-wrap">
                {ex.montagne && (
                  <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
                    🏔️ montagne
                  </span>
                )}
                {ex.optionnel && (
                  <span className="font-sans text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(31,24,16,0.07)', color: 'var(--encre-tertiaire)' }}>
                    optionnel
                  </span>
                )}
              </div>
            )}

            <div className="h-px w-full mt-3 mb-4" style={{ background: 'rgba(31,24,16,0.08)' }} />

            {/* Note conseil */}
            <div className="mb-4">
              {editing ? (
                <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `3px solid ${couleur}` }}>
                  <p className="font-sans text-[10px] uppercase tracking-widest font-semibold mb-2"
                    style={{ color: 'var(--encre-tertiaire)' }}>Conseil</p>
                  <textarea
                    value={draft.notes}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    rows={2}
                    placeholder="Ajouter un conseil…"
                    className="font-sans text-sm leading-relaxed"
                    style={{ ...inputBase, color: 'var(--encre-secondaire)' }}
                  />
                </div>
              ) : ex.notes ? (
                <div className="px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(31,24,16,0.04)', borderLeft: `3px solid ${couleur}` }}>
                  <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--encre-secondaire)' }}>
                    {ex.notes}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Description exécution */}
            <div className="mb-6">
              <p className="font-sans text-[10px] uppercase tracking-widest font-semibold mb-2.5"
                style={{ color: 'var(--encre-tertiaire)' }}>
                Exécution
              </p>
              {editing ? (
                <textarea
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  rows={6}
                  placeholder="Décris l'exécution…"
                  className="font-sans text-sm leading-relaxed w-full px-3 py-2.5 rounded-xl"
                  style={{
                    ...inputBase,
                    color: 'var(--encre-secondaire)',
                    background: 'rgba(31,24,16,0.04)',
                    border: '1px solid rgba(31,24,16,0.10)',
                  }}
                />
              ) : ex.description ? (
                <p className="font-sans text-[0.875rem] leading-[1.65]" style={{ color: 'var(--encre-secondaire)' }}>
                  {ex.description}
                </p>
              ) : (
                <p className="font-sans text-sm italic" style={{ color: 'var(--encre-tertiaire)' }}>
                  Aucune description — clique sur ✏️ pour en ajouter une.
                </p>
              )}
            </div>

            {/* Bouton photo — masqué en mode édition */}
            {!editing && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:opacity-80 active:scale-[0.98]"
                  style={{
                    background: 'rgba(31,24,16,0.06)',
                    color: isUploading ? 'var(--encre-tertiaire)' : 'var(--encre-secondaire)',
                    cursor: isUploading ? 'default' : 'pointer',
                  }}
                >
                  {isUploading ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 rounded-full animate-spin flex-shrink-0"
                        style={{ borderColor: 'var(--encre-tertiaire)', borderTopColor: 'transparent' }} />
                      Importation…
                    </>
                  ) : customImage ? '📷 Changer la photo' : '📷 Importer une photo'}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(jsx, document.body)
}

function CarteExercice({ ex, couleur, onInfo }) {
  if (ex.warmup) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(31,24,16,0.03)' }}>
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
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'rgba(31,24,16,0.035)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-sans font-semibold text-sm leading-snug" style={{ color: 'var(--encre)' }}>
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
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity duration-150 active:opacity-60"
          style={{ background: 'rgba(31,24,16,0.09)', color: 'var(--encre-tertiaire)' }}
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
    const path = `${user.id}/${slugify(exerciseName)}.${ext}`

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
          />
        )}
      </AnimatePresence>

      {/* Sélecteur semaine */}
      <section className="surface-velin p-4 md:p-6">
        <p className="t-label mb-3">Cette semaine</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {JOURS.map((jour) => {
            const isActive = jour.id === jourActifId
            return (
              <button
                key={jour.id}
                onClick={() => setJourActifId(jour.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all duration-200 min-w-[52px]"
                style={{
                  background: isActive ? jour.bg : 'rgba(31,24,16,0.03)',
                  outline: isActive ? `1.5px solid ${jour.border}` : '1.5px solid transparent',
                }}
              >
                <span className="font-sans text-[10px] uppercase tracking-wider font-medium"
                  style={{ color: 'var(--encre-tertiaire)' }}>
                  {jour.court}
                </span>
                <span className="font-sans text-xs font-semibold"
                  style={{ color: isActive ? jour.text : 'var(--encre-tertiaire)' }}>
                  {jour.label}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Contenu du jour */}
      {session ? (
        <section className="surface-velin overflow-hidden">
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
              return (
                <CarteExercice
                  key={i}
                  ex={ex}
                  couleur={session.couleur}
                  onInfo={() => setModal({ ex: originalEx, couleur: session.couleur })}
                />
              )
            })}
          </div>

          {session.note && (
            <div className="px-5 pb-5 md:px-6 md:pb-6">
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
        </section>
      ) : jourActif?.id === 'lundi' ? (
        <section className="surface-velin p-6 text-center">
          <p className="text-4xl mb-3">😴</p>
          <p className="t-h3">Repos</p>
          <p className="t-body-secondaire mt-2">Récupération, étirements libres.</p>
        </section>
      ) : (
        <section className="surface-velin p-6 text-center">
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
        <section className="surface-velin p-4 md:p-6">
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
