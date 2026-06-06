import { useState } from 'react'

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
      { nom: 'Échauffement',                  warmup: true,  series: '5 min',       notes: 'Cercles épaules + poignets + dead hang 30 sec' },
      { nom: 'Incline Bench Press',                          series: '4 × 8–10',    notes: 'Haut des pecs en priorité' },
      { nom: 'Chest Press (machine)',                        series: '3 × 10–12',   notes: 'Charge progressive chaque semaine' },
      { nom: 'Shoulder Press (machine)',                     series: '3 × 10–12',   notes: 'Pas de blocage des coudes en haut' },
      { nom: 'Élévations latérales machine',                 series: '3 × 15',      notes: 'Descente lente, pas de balancement' },
      { nom: 'Triceps Pushdown (corde)',                     series: '3 × 12–15',   notes: 'Coudes fixes, extension complète' },
      { nom: 'Pec Deck',                                     series: '3 × 12–15',   notes: 'Contraction maximale en fin de mouvement' },
    ],
  },
  legs: {
    titre: 'Legs',
    emoji: '🦵',
    sousTitre: 'Fessiers · Ischios · Quads · Mollets',
    info: '16 séries · ~55 min',
    couleur: 'var(--vert)',
    exercices: [
      { nom: 'Échauffement',              warmup: true,    series: '5 min',         notes: 'Cercles hanches + genoux + chevilles + 2 min tapis incliné' },
      { nom: 'Goblet Squat (haltère)',    montagne: true,  series: '3 × 10–12',     notes: 'Descends profond, dos droit' },
      { nom: 'Leg Press (pieds hauts)',   montagne: true,  series: '4 × 8–12',      notes: 'Pieds hauts = fessiers et ischios' },
      { nom: 'Fentes marchées',           montagne: true,  series: '3 × 10/jambe',  notes: 'Stabilité cheville sur terrain accidenté' },
      { nom: 'Seated Leg Curl',           montagne: true,  series: '3 × 12–15',     notes: 'Freins en descente — protège les genoux' },
      { nom: 'Calf Raise',                montagne: true,  series: '3 × 15–20',     notes: 'Single leg si trop facile' },
      { nom: 'Machine abdos',             optionnel: true, series: '3 × 15–20',     notes: 'Core = stabilité avec sac à dos' },
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
      { nom: 'Échauffement',                    warmup: true,  series: '5 min',      notes: 'Cercles épaules + dead hang 30 sec' },
      { nom: 'Tractions (barres)',                             series: '3 séries',   notes: '2 mi-échec + 1 full échec' },
      { nom: 'Lat Pulldown (prise large)',                     series: '4 × 8–12',   notes: 'Tire vers le menton, coudes vers les hanches' },
      { nom: 'Seated Row',                                     series: '3 × 10–12',  notes: 'Serre les omoplates en fin de mouvement' },
      { nom: 'Reverse Pec Deck',                               series: '3 × 15',     notes: 'Face au dossier, retour contrôlé' },
      { nom: 'Incline Biceps Curl',                            series: '3 × 8–10',   notes: 'Full amplitude, pas de triche' },
      { nom: 'Hammer Curl poulie basse',                       series: '3 × 12–15',  notes: 'Brachial et épaisseur du bras' },
    ],
  },
  home: {
    titre: 'Séance Home',
    emoji: '🏠',
    sousTitre: 'Core · Équilibre · Mobilité',
    info: '~30 min',
    couleur: 'var(--nuit-clair)',
    exercices: [
      { nom: 'Planche frontale',                series: '4 × 40 sec',      notes: 'Corps droit, hanches pas en l\'air' },
      { nom: 'Planche latérale',                series: '3 × 30 sec/côté', notes: 'Stabilité latérale' },
      { nom: 'Handstand au mur',                series: '5–8 tentatives',  notes: 'S1–4 : 20 sec · S9+ : réduire contact mur' },
      { nom: 'Mobilité hanches + épaules',      series: '~10 min',         notes: 'Hip flexor 60 sec/côté + rotation épaule au sol' },
      { nom: 'Mollets (sur une marche)', montagne: true, series: '3 × 20', notes: 'Single leg si trop facile' },
    ],
  },
}

const CONSEILS = [
  { emoji: '📈', titre: 'Surcharge progressive', corps: '12 reps propres → +2,5 kg la semaine suivante. Note tes charges — sans ça, zéro progression.' },
  { emoji: '⏱️', titre: 'Temps de repos', corps: 'Polyarticulaires : 2 min. Isolation : 90 sec. Dépasse 1h → saute les abdos.' },
  { emoji: '🎯', titre: 'Alignement des machines', corps: 'Aligne l\'axe de rotation de la machine avec ton articulation à chaque exercice.' },
]

const PROGRESSION = [
  { icone: '🏋️', periode: 'Mois 1–3',   objectif: 'Bases salle\nGoblet squat, fentes, leg press' },
  { icone: '🎒', periode: 'Mois 4–6',   objectif: 'Marches\nSac 5–8 kg, terrains variés' },
  { icone: '⛰️', periode: 'Mois 7–9',   objectif: 'Randos modérées\n300–500m D+' },
  { icone: '🏔️', periode: 'Mois 10–12', objectif: 'Randos longues\n700–1000m D+' },
]

function CarteExercice({ ex, couleur }) {
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
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
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
      <span className="font-sans font-bold text-sm tabular-nums whitespace-nowrap pt-0.5"
        style={{ color: couleur }}>
        {ex.series}
      </span>
    </div>
  )
}

export default function Sport() {
  const [jourActifId, setJourActifId] = useState(JOURS[getTodayIndex()].id)

  const jourActif = JOURS.find(j => j.id === jourActifId)
  const session = jourActif?.session ? SESSIONS[jourActif.session] : null

  return (
    <div className="max-w-2xl mx-auto space-y-4">

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

      {/* Contenu du jour sélectionné */}
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
            {session.exercices.map((ex, i) => (
              <CarteExercice key={i} ex={ex} couleur={session.couleur} />
            ))}
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
          <p className="t-body-secondaire mt-2">
            30–60 min à ton rythme.
          </p>
          <p className="t-meta mt-2">
            À partir du mois 4 : sac à dos <strong>5–8 kg</strong> sur des terrains variés.
          </p>
        </section>
      )}

      {/* Règles d'or */}
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

    </div>
  )
}
