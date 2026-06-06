const SEMAINE = [
  { jour: 'Lundi',    label: 'Repos',  style: 'text-encre-tertiaire' },
  { jour: 'Mardi',    label: 'Home',   style: 'text-nuit' },
  { jour: 'Mercredi', label: 'Push',   style: 'font-semibold', color: 'var(--or)' },
  { jour: 'Jeudi',    label: 'Home',   style: 'text-nuit' },
  { jour: 'Vendredi', label: 'Legs',   style: 'font-semibold', color: 'var(--vert)' },
  { jour: 'Samedi',   label: 'Marche', style: 'text-encre-secondaire' },
  { jour: 'Dimanche', label: 'Pull',   style: 'font-semibold', color: 'var(--bordeaux-clair)' },
]

const PUSH = [
  { exercice: 'Échauffement',                series: '5 min',        notes: 'Cercles épaules + poignets + dead hang 30 sec' },
  { exercice: 'Incline Bench Press',          series: '4 × 8–10',    notes: 'Haut des pecs en priorité, quand tu es frais' },
  { exercice: 'Chest Press (machine)',        series: '3 × 10–12',   notes: 'Charge progressive chaque semaine' },
  { exercice: 'Shoulder Press (machine)',     series: '3 × 10–12',   notes: 'Pas de blocage des coudes en haut' },
  { exercice: 'Élévations latérales machine', series: '3 × 15',      notes: 'Descente lente, pas de balancement' },
  { exercice: 'Triceps Pushdown (corde)',     series: '3 × 12–15',   notes: 'Coudes fixes contre le corps, extension complète' },
]

const LEGS = [
  { exercice: 'Échauffement',               series: '5 min',         notes: 'Cercles hanches + genoux + chevilles + 2 min tapis incliné' },
  { exercice: 'Goblet Squat (haltère)',      series: '3 × 10–12',    notes: 'Descends profond, dos droit', montagne: true },
  { exercice: 'Leg Press (pieds hauts)',     series: '4 × 8–12',     notes: 'Pieds hauts = fessiers et ischios — muscles de la montée', montagne: true },
  { exercice: 'Fentes marchées (haltères)',  series: '3 × 10/jambe', notes: 'Stabilité cheville sur terrain accidenté', montagne: true },
  { exercice: 'Seated Leg Curl',             series: '3 × 12–15',    notes: 'Freins en descente — protège les genoux', montagne: true },
  { exercice: 'Calf Raise',                  series: '3 × 15–20',    notes: 'Stabilité cheville sur sentier. Single leg si trop facile', montagne: true },
  { exercice: 'Machine abdos',               series: '3 × 15–20',    notes: 'Core = stabilité avec sac à dos', optionnel: true },
]

const PULL = [
  { exercice: 'Échauffement',                      series: '5 min',       notes: 'Cercles épaules + dead hang 30 sec' },
  { exercice: 'Tractions (barres)',                 series: '3 séries',    notes: '2 séries mi-échec + 1 série full échec' },
  { exercice: 'Lat Pulldown (prise large)',          series: '4 × 8–12',   notes: 'Tire vers le menton, coudes vers les hanches' },
  { exercice: 'Seated Row',                         series: '3 × 10–12',  notes: 'Serre les omoplates en fin de mouvement' },
  { exercice: 'Reverse Pec Deck',                   series: '3 × 15',     notes: 'Face au dossier, retour contrôlé' },
  { exercice: 'Incline Biceps Curl',                series: '3 × 8–10',   notes: 'Full amplitude, pas de triche' },
  { exercice: 'Hammer Curl poulie basse (corde)',   series: '3 × 12–15',  notes: 'Brachial et épaisseur du bras' },
]

const HOME = [
  { exercice: 'Planche frontale',               volume: '4 × 40 sec',      notes: 'Corps droit, hanches pas en l\'air' },
  { exercice: 'Planche latérale',               volume: '3 × 30 sec/côté', notes: 'Stabilité latérale' },
  { exercice: 'Handstand au mur',               volume: '5–8 tentatives',  notes: 'S1–4 : 20 sec · S5–8 : 30 sec · S9+ : réduire contact mur' },
  { exercice: 'Mobilité hanches + épaules',     volume: '~10 min',         notes: 'Hip flexor 60 sec/côté + rotation épaule au sol' },
  { exercice: 'Mollets debout (sur une marche)', volume: '3 × 20',          notes: 'Single leg si trop facile' },
]

const CONSEILS = [
  {
    titre: 'Surcharge progressive',
    corps: '12 reps propres → augmente le poids la semaine suivante (+2,5 kg). Moins de 8 reps propres → réduis. Note tes charges à chaque séance — sans ça, zéro progression mesurable.',
  },
  {
    titre: 'Temps de repos',
    corps: 'Polyarticulaires (squat, bench, row, fentes) : 2 min minimum. Isolation (curls, pushdown, élévations) : 90 sec. Tu dépasses 1h → saute les abdos machine, c\'est le seul sacrifiable.',
  },
  {
    titre: 'Alignement des machines',
    corps: 'Aligne l\'axe de rotation de la machine avec ton articulation : genoux alignés avec le point rouge sur le leg extension, épaule alignée sur le pec deck.',
  },
]

const PROGRESSION = [
  { periode: 'Mois 1–3',   objectif: 'Bases salle : maîtriser goblet squat, fentes, leg press avec charge progressive' },
  { periode: 'Mois 4–6',   objectif: 'Marches du samedi avec sac léger 5–8 kg, terrains variés' },
  { periode: 'Mois 7–9',   objectif: 'Premières randos avec dénivelé modéré : 300–500m D+' },
  { periode: 'Mois 10–12', objectif: 'Randos longues : 700–1000m D+ — le corps est prêt' },
]

function TableExercices({ rows }) {
  return (
    <div className="mt-5 overflow-x-auto -mx-6 md:-mx-8 px-6 md:px-8">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="border-b border-[rgba(31,24,16,0.10)]">
            <th className="t-label text-left pb-2 pr-6">Exercice</th>
            <th className="t-label text-left pb-2 pr-6 whitespace-nowrap">Séries</th>
            <th className="t-label text-left pb-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[rgba(31,24,16,0.05)] last:border-0">
              <td className="py-3 pr-6 font-sans font-medium leading-snug" style={{ color: 'var(--encre)' }}>
                {row.exercice}
              </td>
              <td className="py-3 pr-6 font-sans tabular-nums whitespace-nowrap" style={{ color: 'var(--encre-secondaire)' }}>
                {row.series || row.volume}
              </td>
              <td className="py-3 font-sans" style={{ color: 'var(--encre-tertiaire)' }}>
                {row.notes}
                {row.montagne && <span className="ml-1">🏔️</span>}
                {row.optionnel && (
                  <span
                    className="ml-2 text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(31,24,16,0.05)', color: 'var(--encre-tertiaire)' }}
                  >
                    si temps restant
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Sport() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* En-tête + semaine */}
      <section className="surface-velin p-6 md:p-8">
        <p className="t-label">Programme sport</p>
        <h1 className="t-h1 mt-2">Tomi v3</h1>
        <p className="t-body-secondaire mt-2">
          Split PPL · calibré 1h de salle · 16 séries max par séance · orienté montagne
        </p>

        <div className="mt-6">
          <div className="h-px w-full" style={{ background: 'var(--gradient-signature-fin)' }} />
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-3 text-center">
          {SEMAINE.map(({ jour, label, style, color }) => (
            <div key={jour} className="flex flex-col items-center gap-1.5">
              <span className="t-label hidden sm:block">{jour}</span>
              <span className="t-label sm:hidden">{jour.slice(0, 3)}</span>
              <span
                className={`font-sans text-xs sm:text-sm leading-snug ${style}`}
                style={color ? { color } : undefined}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Push */}
      <section className="surface-velin p-6 md:p-8">
        <div className="flex items-center gap-3">
          <p className="t-label">Mercredi</p>
          <span className="h-px flex-1" style={{ background: 'var(--border-doux)' }} />
          <p className="t-label">16 séries · ~55 min</p>
        </div>
        <h2 className="t-h2 mt-2" style={{ color: 'var(--or)' }}>Push</h2>
        <p className="t-body-secondaire mt-1">Pecs · Épaules · Triceps</p>
        <p className="t-meta mt-3">
          Descente 2 sec, poussée explosive. Repos 90 sec isolation — 2 min polyarticulaires.
        </p>
        <TableExercices rows={PUSH} />
        <p className="t-meta mt-5 pt-4 border-t border-[rgba(31,24,16,0.08)]">
          <strong>Optionnel :</strong> si tu es rapide, le pec deck est le seul exercice que tu peux rajouter.
        </p>
      </section>

      {/* Legs */}
      <section className="surface-velin p-6 md:p-8">
        <div className="flex items-center gap-3">
          <p className="t-label">Vendredi</p>
          <span className="h-px flex-1" style={{ background: 'var(--border-doux)' }} />
          <p className="t-label">16 séries · ~55 min</p>
        </div>
        <h2 className="t-h2 mt-2" style={{ color: 'var(--vert)' }}>Legs & Abs</h2>
        <p className="t-body-secondaire mt-1">Orienté montagne — abdos si temps restant 🏔️</p>
        <p className="t-meta mt-3">
          Les fentes marchées comptent double en temps. Abdos uniquement si tu termines avant 55 min.
        </p>
        <TableExercices rows={LEGS} />
        <p className="t-meta mt-5 pt-4 border-t border-[rgba(31,24,16,0.08)]">
          <strong>Logique montagne :</strong> goblet squat + leg press pieds hauts + fentes = triple attaque fessiers/ischios/quads. Le leg curl protège les genoux en descente. Les calf raise stabilisent les chevilles.
        </p>
      </section>

      {/* Pull */}
      <section className="surface-velin p-6 md:p-8">
        <div className="flex items-center gap-3">
          <p className="t-label">Dimanche</p>
          <span className="h-px flex-1" style={{ background: 'var(--border-doux)' }} />
          <p className="t-label">16 séries · ~55 min</p>
        </div>
        <h2 className="t-h2 mt-2" style={{ color: 'var(--bordeaux-clair)' }}>Pull</h2>
        <p className="t-body-secondaire mt-1">Dos · Biceps · Arrière épaules</p>
        <p className="t-meta mt-3">
          Tractions en ouverture pour la force brute. Biceps isolés en fin de séance.
        </p>
        <TableExercices rows={PULL} />
      </section>

      {/* Home + Marche */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="surface-velin p-6 md:p-8">
          <p className="t-label">Mardi & Jeudi</p>
          <h2 className="t-h2 mt-2" style={{ color: 'var(--nuit-clair)' }}>Séances Home</h2>
          <p className="t-body-secondaire mt-1">~30 min</p>
          <TableExercices rows={HOME} />
        </section>

        <section className="surface-velin p-6 md:p-8">
          <p className="t-label">Samedi</p>
          <h2 className="t-h2 mt-2">Marche</h2>
          <p className="t-body mt-4">
            30–60 min à ton rythme. Récupération active.
          </p>
          <p className="t-body-secondaire mt-3">
            À partir du mois 4, fais-la avec un sac à dos de{' '}
            <strong style={{ color: 'var(--encre)' }}>5–8 kg</strong> sur des terrains variés.
          </p>
        </section>
      </div>

      {/* Conseils */}
      <section className="surface-velin p-6 md:p-8">
        <p className="t-label">Conseils clés</p>
        <h2 className="t-h2 mt-2">Exécution</h2>
        <div className="mt-5 space-y-5">
          {CONSEILS.map((c, i) => (
            <div key={i} className="flex gap-4">
              <span
                className="font-serif italic font-medium text-xl leading-none flex-shrink-0 mt-0.5"
                style={{ color: 'var(--or)' }}
              >
                —
              </span>
              <div>
                <p className="font-sans font-semibold text-sm" style={{ color: 'var(--encre)' }}>
                  {c.titre}
                </p>
                <p className="t-body-secondaire mt-1">{c.corps}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Progression 12 mois */}
      <section className="surface-velin p-6 md:p-8">
        <p className="t-label">Progression vers la rando</p>
        <h2 className="t-h2 mt-2">12 mois 🏔️</h2>
        <div className="mt-6 space-y-0">
          {PROGRESSION.map((p, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                  style={{ background: 'var(--or)' }}
                />
                {i < PROGRESSION.length - 1 && (
                  <span
                    className="w-px flex-1 my-1"
                    style={{ background: 'var(--border-doux)', minHeight: '28px' }}
                  />
                )}
              </div>
              <div className="pb-5 last:pb-0">
                <p className="t-label-noble" style={{ color: 'var(--or)' }}>{p.periode}</p>
                <p className="t-body-secondaire mt-1">{p.objectif}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="h-px w-full" style={{ background: 'var(--gradient-signature-fin)' }} />
          <p className="t-label-noble mt-3 text-center" style={{ color: 'var(--encre-tertiaire)' }}>
            Programme v3 · calibré 1h · juin 2026
          </p>
        </div>
      </section>

    </div>
  )
}
