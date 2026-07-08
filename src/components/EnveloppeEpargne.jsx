/**
 * EnveloppeEpargne.jsx
 * ----------------------------------------------------------------------------
 * Enveloppe « compte épargne » — totalement indépendante du reste de l'app
 * (n'entre ni dans le Patrimoine, ni dans « à répartir », ni dans la courbe
 * du Patrimoine). Design distinct : liseré vert (croissance) au lieu de l'or
 * (enveloppes normales) ou du bordeaux (créances).
 *
 * Particularité : un versement RÉCURRENT automatique configurable
 * (montant + cadence : chaque jour / semaine / mois / année). Le rattrapage
 * des versements échus est fait au chargement (cf. AppContext).
 *
 * Props :
 *   nom, montant, dernierMouvement, direction,
 *   historique (array de {date, montant, note}),
 *   modeEdition, canAnnuler,
 *   onPlus (versement), onMinus (retrait), onUndo, onEdit, onGraphique,
 *   actionInputActive, onValidateInput, onCancelInput,
 *   recurrence ({ amount, interval } | null),
 *   onSaveRecurrence(amount, interval), onDisableRecurrence()
 * ----------------------------------------------------------------------------
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  Plus,
  Minus,
  Undo2,
  Pencil,
  LineChart,
  Scroll,
  X,
  Repeat,
  ArrowUp,
  ArrowDown,
  Minus as MinusIcon,
} from 'lucide-react';
import OdometerCounter from './OdometerCounter.jsx';
import BoutonAction from './BoutonAction.jsx';
import ChampSaisie from './ChampSaisie.jsx';

const CADENCES = [
  { id: 'daily',   label: 'jour' },
  { id: 'weekly',  label: 'semaine' },
  { id: 'monthly', label: 'mois' },
  { id: 'yearly',  label: 'an' },
];

function labelCadence(id) {
  return CADENCES.find((c) => c.id === id)?.label ?? id;
}

function FlecheDirection({ direction, size = 24 }) {
  if (direction === 'transfert') {
    return <MinusIcon size={size} strokeWidth={3} className="text-graphite" />;
  }
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  const color = direction === 'up' ? 'text-vert' : 'text-rouge';
  return <Icon size={size} strokeWidth={2.5} className={color} />;
}

function formatDateCourte(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' }).format(d);
  }
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export default function EnveloppeEpargne({
  nom = 'Compte épargne',
  montant = 0,
  dernierMouvement = 0,
  direction = 'up',
  historique = [],
  modeEdition = false,
  canAnnuler = true,
  onPlus,
  onMinus,
  onUndo,
  onEdit,
  onGraphique,
  onTitreChange,
  actionInputActive = null,
  onValidateInput,
  onCancelInput,
  recurrence = null,
  onSaveRecurrence,
  onDisableRecurrence,
}) {
  const [parcheminOuvert, setParcheminOuvert] = useState(false);
  const [recurrenceOuverte, setRecurrenceOuverte] = useState(false);
  const [recAmount, setRecAmount] = useState(
    recurrence?.amount != null ? String(recurrence.amount).replace('.', ',') : ''
  );
  const [recInterval, setRecInterval] = useState(recurrence?.interval ?? 'monthly');

  const couleurCompteur = montant > 0 ? 'positif' : 'zero';
  const couleurMvt =
    direction === 'transfert' ? 'neutre' : direction === 'up' ? 'positif' : 'negatif';

  const solde = historique.reduce((acc, m) => acc + (m.montant || 0), 0);

  const recurrenceActive = recurrence?.amount != null && Number(recurrence.amount) > 0;

  function handleSaveRecurrence() {
    const n = parseFloat(String(recAmount).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    onSaveRecurrence?.(n, recInterval);
    setRecurrenceOuverte(false);
  }

  function handleDisableRecurrence() {
    onDisableRecurrence?.();
    setRecAmount('');
    setRecurrenceOuverte(false);
  }

  return (
    <article
      className="relative overflow-hidden bg-velin-clair rounded-lg shadow-sm"
      style={{
        boxShadow: '0 0 0 1px rgba(14, 163, 113, 0.3), 0 2px 6px color-mix(in srgb, var(--encre) 6%, transparent)',
      }}
      aria-label={`Compte épargne — ${nom}`}
    >
      {/* Liseré vert fin */}
      <span
        className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--vert) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {/* Grain papier */}
      <span
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage: 'var(--grain-overlay)',
          mixBlendMode: 'multiply',
        }}
        aria-hidden="true"
      />

      <div className="relative p-5 md:p-6 flex flex-col">
        {/* ============ BLOC TITRE ============ */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {modeEdition ? (
              <input
                type="text"
                defaultValue={nom}
                onChange={(e) => onTitreChange?.(e.target.value)}
                className="
                  font-serif font-medium text-xl
                  flex-1 bg-transparent
                  border-b border-vert/40
                  focus:border-vert focus:outline-none
                  pb-0.5
                "
                aria-label="Nom du compte épargne"
              />
            ) : (
              <h3 className="font-serif font-medium text-xl text-encre">{nom}</h3>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setRecurrenceOuverte((v) => !v)}
              aria-label="Versement automatique"
              aria-expanded={recurrenceOuverte}
              className={`
                relative p-2 rounded-md transition-colors duration-200
                focus-visible:outline-2 focus-visible:outline-vert focus-visible:outline-offset-1
                ${recurrenceActive
                  ? 'text-vert hover:bg-vert/10'
                  : 'text-encre-tertiaire hover:text-vert hover:bg-vert/5'}
              `}
            >
              <Repeat size={16} strokeWidth={1.5} aria-hidden="true" />
              {recurrenceActive && (
                <span
                  className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-vert"
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              type="button"
              onClick={onGraphique}
              aria-label="Voir la courbe d'évolution"
              className="
                p-2 rounded-md
                text-encre-tertiaire hover:text-vert hover:bg-vert/5
                transition-colors duration-200
                focus-visible:outline-2 focus-visible:outline-vert focus-visible:outline-offset-1
              "
            >
              <LineChart size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setParcheminOuvert((v) => !v)}
              aria-label={parcheminOuvert ? 'Refermer le détail' : 'Voir le détail'}
              aria-expanded={parcheminOuvert}
              className="
                p-2 rounded-md
                text-encre-tertiaire hover:text-vert hover:bg-vert/5
                transition-colors duration-200
                focus-visible:outline-2 focus-visible:outline-vert focus-visible:outline-offset-1
              "
            >
              {parcheminOuvert ? (
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Scroll size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* ============ PANNEAU RÉCURRENCE ============ */}
        <AnimatePresence>
          {recurrenceOuverte && (
            <motion.div
              key="recurrence"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
                opacity: { duration: 0.25, ease: 'easeInOut' },
              }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-md p-4 border border-vert/25 bg-vert/5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Repeat size={15} strokeWidth={1.75} className="text-vert" aria-hidden="true" />
                  <span className="t-label-noble">Versement automatique</span>
                </div>

                {recurrenceActive && (
                  <p className="t-meta italic">
                    Actuellement :{' '}
                    <span className="not-italic font-medium text-encre">
                      {Number(recurrence.amount).toLocaleString('fr-BE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}€ / {labelCadence(recurrence.interval)}
                    </span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-velin-clair border border-encre/[0.12] rounded-md px-3 h-11 min-h-[44px] flex-1 min-w-[120px]">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={recAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^[0-9]*[,.]?[0-9]*$/.test(v)) setRecAmount(v);
                      }}
                      placeholder="0,00"
                      className="t-chiffre-md flex-1 bg-transparent text-encre placeholder:text-encre-tertiaire focus:outline-none min-w-0"
                      aria-label="Montant du versement automatique"
                    />
                    <span className="t-chiffre-md text-encre-secondaire pointer-events-none">€</span>
                  </div>

                  <div className="flex items-center gap-1 h-11 min-h-[44px]">
                    <span className="t-meta">par</span>
                    <select
                      value={recInterval}
                      onChange={(e) => setRecInterval(e.target.value)}
                      className="
                        h-11 min-h-[44px] bg-velin-clair border border-encre/[0.12]
                        rounded-md px-2 text-sm text-encre
                        focus:outline-none focus:border-vert/50
                      "
                      aria-label="Cadence du versement automatique"
                    >
                      {CADENCES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {recurrenceActive && (
                    <button
                      type="button"
                      onClick={handleDisableRecurrence}
                      className="
                        h-10 min-h-[40px] px-4 rounded-md text-sm font-medium
                        text-rouge hover:bg-rouge/10 transition-colors duration-200
                        focus-visible:outline-2 focus-visible:outline-rouge focus-visible:outline-offset-2
                      "
                    >
                      Désactiver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveRecurrence}
                    className="
                      h-10 min-h-[40px] px-5 rounded-md text-sm font-medium
                      inline-flex items-center gap-2
                      bg-vert text-velin-clair hover:bg-vert-clair
                      transition-colors duration-200
                      focus-visible:outline-2 focus-visible:outline-vert focus-visible:outline-offset-2
                    "
                  >
                    {recurrenceActive ? 'Mettre à jour' : 'Activer'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ PARCHEMIN (historique) ============ */}
        <AnimatePresence>
          {parcheminOuvert && (
            <motion.div
              key="parchemin"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
                opacity: { duration: 0.3, ease: 'easeInOut' },
              }}
              className="overflow-hidden mb-4"
            >
              <div
                className="relative rounded-md p-4 border border-vert/20"
                style={{
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--vert) 8%, transparent) 0%, color-mix(in srgb, var(--velin-clair) 80%, transparent) 50%, color-mix(in srgb, var(--vert) 8%, transparent) 100%)',
                }}
              >
                <span
                  className="absolute top-0 left-0 right-0 h-2 pointer-events-none"
                  style={{ background: 'linear-gradient(180deg, rgba(14,163,113,0.12) 0%, transparent 100%)' }}
                  aria-hidden="true"
                />
                <span
                  className="absolute bottom-0 left-0 right-0 h-2 pointer-events-none"
                  style={{ background: 'linear-gradient(0deg, rgba(14,163,113,0.12) 0%, transparent 100%)' }}
                  aria-hidden="true"
                />

                <div
                  className="max-h-[180px] overflow-y-auto py-2 px-1 flex flex-col gap-2"
                  style={{ overscrollBehavior: 'contain' }}
                  role="list"
                  aria-label="Historique des mouvements"
                >
                  {historique.length === 0 ? (
                    <p className="t-meta text-center py-4">Pas encore de mouvement</p>
                  ) : (
                    historique.map((m, i) => (
                      <div
                        key={i}
                        role="listitem"
                        className="flex items-center gap-3 py-1.5 border-b border-vert/10 last:border-b-0"
                      >
                        <span className="t-meta tabular-nums w-20 shrink-0">
                          {formatDateCourte(m.date)}
                        </span>
                        <span
                          className={`
                            font-sans font-medium text-sm tabular-nums w-20 shrink-0 text-right
                            ${m.montant >= 0 ? 'signal-positif' : 'signal-negatif'}
                          `}
                        >
                          {m.montant >= 0 ? '+' : ''}
                          {m.montant.toLocaleString('fr-BE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}€
                        </span>
                        <span className="t-body-secondaire flex-1 italic">
                          {m.note || '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {historique.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-vert/30 flex items-center justify-between">
                    <span className="t-label-noble">Solde</span>
                    <span
                      className={`font-sans font-semibold text-lg tabular-nums ${
                        solde > 0 ? 'signal-positif' : solde === 0 ? 'signal-zero' : 'signal-negatif'
                      }`}
                    >
                      {solde >= 0 ? '+' : ''}
                      {solde.toLocaleString('fr-BE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}€
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ BLOC COMPTEUR ============ */}
        <div className="flex items-end justify-between gap-3 mb-4">
          <OdometerCounter value={montant} color={couleurCompteur} size="lg" />

          <div className="flex flex-col items-center gap-0.5">
            <FlecheDirection direction={direction} size={22} />
            <span
              className={`text-xs tabular-nums font-sans font-medium ${
                couleurMvt === 'positif'
                  ? 'signal-positif'
                  : couleurMvt === 'negatif'
                  ? 'signal-negatif'
                  : 'signal-neutre'
              }`}
            >
              {dernierMouvement >= 0 ? '+' : ''}
              {dernierMouvement.toLocaleString('fr-BE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}€
            </span>
          </div>
        </div>

        {/* ============ Boutons d'action ============ */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-vert/15">
          <AnimatePresence mode="wait">
            {actionInputActive ? (
              <motion.div
                key="input"
                className="flex-1 min-w-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChampSaisie
                  noteMode="optional"
                  maxAmount={actionInputActive === '-' ? Math.abs(montant) : null}
                  onValidate={(payload) => onValidateInput?.(actionInputActive, payload)}
                  onCancel={onCancelInput}
                  placeholder={
                    actionInputActive === '+' ? 'Montant versé' : 'Montant retiré'
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="boutons"
                className="flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <BoutonAction icon={Plus} onClick={onPlus} ariaLabel="Verser" tone="noble" />
                <BoutonAction
                  icon={Minus}
                  onClick={onMinus}
                  ariaLabel="Retirer"
                  tone="noble"
                  disabled={montant === 0}
                />
                <BoutonAction
                  icon={Undo2}
                  onClick={onUndo}
                  ariaLabel="Annuler"
                  tone="noble"
                  disabled={!canAnnuler}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={onEdit}
            aria-label={modeEdition ? 'Valider' : 'Modifier'}
            className={`
              h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center
              rounded-md transition-all duration-200 ease-noble
              ${
                modeEdition
                  ? 'bg-vert text-velin-clair hover:bg-vert-clair'
                  : 'bg-transparent text-encre-tertiaire hover:bg-vert/10 hover:text-vert'
              }
              focus-visible:outline-2 focus-visible:outline-vert focus-visible:outline-offset-2
            `}
          >
            <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
