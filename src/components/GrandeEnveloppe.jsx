/**
 * GrandeEnveloppe.jsx
 * ----------------------------------------------------------------------------
 * Enveloppe principale "Patrimoine" affichée en haut de la page Accueil.
 *
 * Caractéristiques :
 *   - Titre fixe non éditable ("Patrimoine")
 *   - Compteur central XL avec flèche directionnelle à droite
 *   - Sous la flèche : montant du dernier mouvement
 *   - 2 boutons d'action : + (recevoir), ↩ (annuler)
 *   - Pas de mode édition (titre fixe)
 *   - Sous l'enveloppe : ligne "À répartir" avec son propre compteur secondaire
 *
 * Props :
 *   patrimoine          — number, total actuel
 *   patrimoineDernierMouvement — number, montant du dernier mvt (signé)
 *   patrimoineDirection — 'up' | 'down' | 'transfert'
 *   aRepartir           — number, montant non encore réparti
 *   aRepartirDernierMouvement — number
 *   aRepartirDirection  — 'up' | 'down' | 'transfert'
 *   onRecevoir          — handler ()
 *   onAnnuler           — handler ()
 *   isInputActive       — bool, état de saisie du bouton +
 *   onValidateRecevoir  — handler (value)
 *   onCancelRecevoir    — handler ()
 * ----------------------------------------------------------------------------
 */
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Undo2, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import OdometerCounter from './OdometerCounter.jsx';
import BoutonAction from './BoutonAction.jsx';
import ChampSaisie from './ChampSaisie.jsx';

/**
 * Flèche directionnelle (verte ↑, rouge ↓, barre grise transfert).
 */
function FlecheDirection({ direction, size = 32 }) {
  if (direction === 'transfert') {
    return (
      <span
        className="inline-flex items-center justify-center"
        aria-label="Transfert interne"
        role="img"
      >
        <Minus
          size={size}
          strokeWidth={3}
          className="text-graphite"
          aria-hidden="true"
        />
      </span>
    );
  }

  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  const color = direction === 'up' ? 'text-vert' : 'text-rouge';

  return (
    <Icon
      size={size}
      strokeWidth={2.5}
      className={color}
      aria-label={direction === 'up' ? 'En hausse' : 'En baisse'}
    />
  );
}

export default function GrandeEnveloppe({
  patrimoine = 0,
  patrimoineDernierMouvement = 0,
  patrimoineDirection = 'up',
  aRepartir = 0,
  aRepartirDernierMouvement = 0,
  aRepartirDirection = 'up',
  onRecevoir,
  onAnnuler,
  canAnnuler = true,
  isInputActive = false,
  onValidateRecevoir,
  onCancelRecevoir,
}) {
  // Couleur du compteur principal : vert si > 0, rouge si === 0 (codes trading)
  const couleurPatrimoine = patrimoine > 0 ? 'positif' : 'zero';
  const couleurMvtPatrimoine =
    patrimoineDirection === 'transfert'
      ? 'neutre'
      : patrimoineDirection === 'up'
      ? 'positif'
      : 'negatif';

  const couleurARepartir = aRepartir > 0 ? 'positif' : 'zero';

  const couleurMvtARepartir =
    aRepartirDirection === 'transfert'
      ? 'neutre'
      : aRepartirDirection === 'up'
      ? 'positif'
      : 'negatif';

  return (
    <section aria-labelledby="patrimoine-titre" className="w-full">
      {/* ============ Enveloppe principale ============ */}
      <article
        className="
          surface-velin liserer-signature
          p-6 md:p-8
          flex flex-col gap-5
        "
        style={{
          border: '1px solid rgba(184, 149, 74, 0.18)',
          boxShadow: '0 12px 32px rgba(31, 24, 16, 0.12), 0 4px 8px rgba(31, 24, 16, 0.06), inset 0 1px 0 rgba(184, 149, 74, 0.08)',
        }}
      >
        {/* Ligne 1 : titre + compteur + flèche */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="t-label">Total</p>
            <h2 id="patrimoine-titre" className="t-h1 mt-1">
              Patrimoine
            </h2>
          </div>

          <div className="flex items-end gap-4 md:gap-6">
            <div className="flex flex-col items-end">
              <OdometerCounter
                value={patrimoine}
                color={couleurPatrimoine}
                size="xl"
              />
            </div>

            <div className="flex flex-col items-center gap-1 pb-1">
              <FlecheDirection direction={patrimoineDirection} size={32} />
              <span className={`t-chiffre-sm ${
                couleurMvtPatrimoine === 'positif' ? 'signal-positif' :
                couleurMvtPatrimoine === 'negatif' ? 'signal-negatif' : 'signal-neutre'
              }`}>
                {patrimoineDernierMouvement >= 0 ? '+' : ''}
                {patrimoineDernierMouvement.toLocaleString('fr-BE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{'\u202F'}€
              </span>
            </div>
          </div>
        </div>

        {/* Ligne 2 : boutons d'action OU champ de saisie si actif */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[rgba(31,24,16,0.06)]">
          <AnimatePresence mode="wait">
            {isInputActive ? (
              <motion.div
                key="input"
                className="flex-1 max-w-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChampSaisie
                  onValidate={onValidateRecevoir}
                  onCancel={onCancelRecevoir}
                  placeholder="Montant reçu"
                />
              </motion.div>
            ) : (
              <motion.div
                key="boutons"
                className="flex items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <BoutonAction
                  icon={Undo2}
                  onClick={onAnnuler}
                  ariaLabel="Annuler le dernier mouvement"
                  tone="noble"
                  disabled={!canAnnuler}
                />
                <BoutonAction
                  icon={Plus}
                  onClick={onRecevoir}
                  ariaLabel="Recevoir un montant"
                  tone="bordeaux"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </article>

      {/* ============ Badge "À répartir" + barre de progression ============ */}
      {(() => {
        const pctAlloue = patrimoine > 0
          ? Math.min(100, Math.max(0, ((patrimoine - aRepartir) / patrimoine) * 100))
          : 0
        return (
          <div className="mt-3 px-4 md:px-6">
            {/* Wrapper inline-flex : la barre s'aligne sur la largeur du pill */}
            <div className="inline-flex flex-col gap-1.5">
              {/* Pill À répartir */}
              <div
                className={`
                  inline-flex items-center gap-3 px-4 py-2 rounded-full
                  border transition-colors duration-500
                  ${aRepartir > 0
                    ? 'bg-or/10 border-or/25'
                    : 'bg-velin-fonce border-[rgba(31,24,16,0.07)]'}
                `}
              >
                <span className="t-label-noble">À répartir</span>
                <span
                  className={`w-1 h-1 rounded-full shrink-0 ${aRepartir > 0 ? 'bg-or' : 'bg-encre-tertiaire/40'}`}
                  aria-hidden="true"
                />
                <OdometerCounter
                  value={aRepartir}
                  color={couleurARepartir}
                  size="sm"
                />
              </div>

              {/* Barre de progression — même largeur que le pill */}
              {patrimoine > 0 && (
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(31,24,16,0.08)' }}
                    role="progressbar"
                    aria-valuenow={Math.round(pctAlloue)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Taux d'allocation"
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pctAlloue}%`,
                        background: 'var(--gradient-signature)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[0.7rem] tabular-nums font-medium shrink-0 font-sans"
                    style={{ color: 'var(--encre-tertiaire)' }}
                  >
                    {Math.round(pctAlloue)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

    </section>
  );
}
