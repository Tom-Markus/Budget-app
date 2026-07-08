/**
 * EnveloppeCreance.jsx
 * ----------------------------------------------------------------------------
 * Enveloppe spéciale pour les créances (argent prêté à quelqu'un).
 * Design distinct des enveloppes normales : liseré bordeaux au lieu de l'or,
 * texture papier légèrement différente, MAIS cohérent avec l'ambiance globale.
 *
 * Composants :
 *   - Titre (nom de la personne)
 *   - Compteur avec flèche directionnelle toujours visible
 *   - Boutons : +, -, ↩, crayon, graphique
 *   - PAS de ⤴, PAS de sous-catégories, PAS d'objectif, PAS de description
 *   - Bouton "Voir plus" → animation PARCHEMIN (signature de cette section)
 *
 * Animation PARCHEMIN (centrale) :
 *   - Au clic "Voir plus", le bloc titre glisse vers le HAUT (lent)
 *   - Le bloc compteur glisse vers le BAS (lent)
 *   - Entre les deux, le ticket de caisse se déroule comme un parchemin noble
 *   - Lignes du ticket : date, montant signé, note descriptive obligatoire
 *   - 3 lignes visibles + scroll dans la zone d'historique
 *   - Solde en bas du ticket
 *   - Bouton pour refermer (parchemin se réenroule)
 *
 * Props :
 *   nom, montant (positif = on te doit, négatif = tu dois),
 *   dernierMouvement, direction, historique (array de {date, montant, note}),
 *   onPlus, onMinus, onUndo, onEdit, onGraphique
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
  ArrowUp,
  ArrowDown,
  Minus as MinusIcon,
} from 'lucide-react';
import OdometerCounter from './OdometerCounter.jsx';
import BoutonAction from './BoutonAction.jsx';
import ChampSaisie from './ChampSaisie.jsx';

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

export default function EnveloppeCreance({
  nom = 'Inconnu',
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
}) {
  const [parcheminOuvert, setParcheminOuvert] = useState(false);

  const couleurCompteur = montant > 0 ? 'positif' : 'zero';
  const couleurMvt =
    direction === 'transfert' ? 'neutre' : direction === 'up' ? 'positif' : 'negatif';

  // Solde calculé à partir de l'historique (somme cumulée des mouvements)
  const solde = historique.reduce((acc, m) => acc + (m.montant || 0), 0);

  return (
    <article
      className="
        relative overflow-hidden
        bg-velin-clair
        rounded-lg
        shadow-sm
      "
      style={{
        boxShadow:
          '0 0 0 1px rgba(92, 26, 36, 0.3), 0 2px 6px color-mix(in srgb, var(--encre) 6%, transparent)',
      }}
      aria-label={`Créance — ${nom}`}
    >
      {/* Liseré bordeaux fin */}
      <span
        className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--bordeaux) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      {/* Grain papier renforcé (texture différente) */}
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
                  border-b border-bordeaux/40
                  focus:border-bordeaux focus:outline-none
                  pb-0.5
                "
                aria-label="Nom de la personne"
              />
            ) : (
              <h3 className="font-serif font-medium text-xl text-encre">
                {nom}
              </h3>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onGraphique}
              aria-label="Voir la courbe d'évolution"
              className="
                p-2 rounded-md
                text-encre-tertiaire hover:text-bordeaux hover:bg-bordeaux/5
                transition-colors duration-200
                focus-visible:outline-2 focus-visible:outline-bordeaux focus-visible:outline-offset-1
              "
            >
              <LineChart size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setParcheminOuvert((v) => !v)}
              aria-label={parcheminOuvert ? 'Refermer le détail' : 'Voir le détail (parchemin)'}
              aria-expanded={parcheminOuvert}
              className="
                p-2 rounded-md
                text-encre-tertiaire hover:text-bordeaux hover:bg-bordeaux/5
                transition-colors duration-200
                focus-visible:outline-2 focus-visible:outline-bordeaux focus-visible:outline-offset-1
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

        {/* ============ PARCHEMIN (animation centrale) ============ */}
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
                className="
                  relative rounded-md p-4
                  border border-bordeaux/20
                "
                style={{
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--velin-fonce) 60%, transparent) 0%, color-mix(in srgb, var(--velin-clair) 80%, transparent) 50%, color-mix(in srgb, var(--velin-fonce) 60%, transparent) 100%)',
                }}
              >
                {/* Rouleaux haut et bas (effet parchemin) */}
                <span
                  className="absolute top-0 left-0 right-0 h-2 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(92,26,36,0.15) 0%, transparent 100%)',
                  }}
                  aria-hidden="true"
                />
                <span
                  className="absolute bottom-0 left-0 right-0 h-2 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(0deg, rgba(92,26,36,0.15) 0%, transparent 100%)',
                  }}
                  aria-hidden="true"
                />

                {/* Lignes du ticket — zone scrollable */}
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
                        className="
                          flex items-center gap-3 py-1.5
                          border-b border-bordeaux/10 last:border-b-0
                        "
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
                          })}{'\u202F'}€
                        </span>
                        <span className="t-body-secondaire flex-1 italic">
                          {m.note || '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Solde en bas du ticket */}
                {historique.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-bordeaux/30 flex items-center justify-between">
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
                      })}{'\u202F'}€
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
              })}{'\u202F'}€
            </span>
          </div>
        </div>

        {/* ============ Boutons d'action ============ */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-bordeaux/15">
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
                  noteMode="required"
                  maxAmount={actionInputActive === '-' ? Math.abs(montant) : null}
                  onValidate={(payload) => onValidateInput?.(actionInputActive, payload)}
                  onCancel={onCancelInput}
                  placeholder={
                    actionInputActive === '+'
                      ? 'Montant prêté'
                      : 'Montant remboursé'
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
                <BoutonAction icon={Plus} onClick={onPlus} ariaLabel="Ajouter" tone="noble" />
                <BoutonAction
                  icon={Minus}
                  onClick={onMinus}
                  ariaLabel="Remboursement reçu"
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
                  ? 'bg-bordeaux text-velin-clair hover:bg-bordeaux-clair'
                  : 'bg-transparent text-encre-tertiaire hover:bg-bordeaux/10 hover:text-bordeaux'
              }
              focus-visible:outline-2 focus-visible:outline-bordeaux focus-visible:outline-offset-2
            `}
          >
            <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
