/**
 * PetiteEnveloppe.jsx
 * ----------------------------------------------------------------------------
 * Enveloppe standard. Composants :
 *   - Zone de drag en haut-gauche (hover doré 300ms sur PC, long-press mobile)
 *   - Titre serif élégant (éditable en mode édition)
 *   - Description (éditable en mode édition, repliable au repos)
 *   - Bouton mini-logo graphique → ouvre la courbe d'évolution
 *   - Compteur (vert > 0, rouge = 0)
 *   - Flèche directionnelle toujours visible
 *   - Sous la flèche : montant du dernier mouvement
 *   - Barre de progression si objectif activé
 *
 * Boutons d'action — dépendent de l'état :
 *
 *   - SI sous-enveloppes présentes : AUCUN bouton +, −, ↩, ⤴
 *     (le montant est calculé automatiquement comme somme des enfants).
 *     Seuls drag, info, graphique, crayon restent disponibles.
 *
 *   - SI feuille (pas de sous-enveloppes), mode standard :
 *     Boutons +, −, ↩, ⤴, crayon (édition)
 *     Le ↩ est désactivé si canAnnuler === false.
 *
 *   - SI mode édition :
 *     Les boutons d'action sont remplacés par : Objectif, + Sous-catégorie, Supprimer
 *
 * Variantes :
 *   - niveauHierarchique 'normal' : petite enveloppe
 *   - niveauHierarchique 'mini'   : sous-enveloppe imbriquée, taille réduite
 *
 * Props complètes — voir la signature de la fonction.
 * ----------------------------------------------------------------------------
 */
import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Minus,
  Undo2,
  CornerUpLeft,
  Pencil,
  LineChart,
  Info,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Target,
  FolderPlus,
  Trash2,
  Check,
} from 'lucide-react';
import {
  DndContext, closestCenter,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import OdometerCounter from './OdometerCounter.jsx';
import BoutonAction from './BoutonAction.jsx';
import ChampSaisie from './ChampSaisie.jsx';

function FlecheDirection({ direction, size = 24 }) {
  if (direction === 'transfert') {
    return (
      <Minus
        size={size}
        strokeWidth={3}
        className="text-graphite"
        aria-label="Transfert interne"
      />
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

function BarreObjectif({ courant, cible }) {
  const ratio = Math.min(Math.max(courant / cible, 0), 1);
  const nearGoal = ratio >= 0.8;
  const atGoal = ratio >= 1;

  return (
    <div className="flex items-center gap-3 mt-2">
      <motion.div
        className="flex-1 rounded-full overflow-hidden bg-velin-fonce"
        initial={{ height: '3px', boxShadow: '0 0 0px rgba(184,149,74,0)' }}
        animate={{
          height: nearGoal ? '5px' : '3px',
          boxShadow: atGoal
            ? '0 0 14px rgba(184,149,74,0.55)'
            : nearGoal
            ? '0 0 8px rgba(184,149,74,0.3)'
            : '0 0 0px rgba(184,149,74,0)',
        }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        role="progressbar"
        aria-valuenow={courant}
        aria-valuemin={0}
        aria-valuemax={cible}
      >
        <motion.div
          style={{
            height: '100%',
            borderRadius: '9999px',
            background: atGoal
              ? 'var(--or)'
              : 'linear-gradient(90deg, var(--or-fonce), var(--or))',
          }}
          initial={{ width: 0, opacity: 1 }}
          animate={{
            width: `${ratio * 100}%`,
            opacity: nearGoal && !atGoal ? [1, 0.5, 1] : 1,
          }}
          transition={{
            width: { duration: 0.7, ease: [0.32, 0.72, 0, 1] },
            opacity: nearGoal && !atGoal
              ? { duration: 1.6, ease: 'easeInOut', repeat: Infinity }
              : { duration: 0.3 },
          }}
        />
      </motion.div>
      <span
        className={`t-meta tabular-nums whitespace-nowrap transition-colors duration-500 ${
          atGoal ? 'text-or-fonce font-medium' : ''
        }`}
      >
        {courant.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' / '}
        {cible.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        {'\u202F'}€
      </span>
    </div>
  );
}

function PetiteEnveloppe({
  id,
  dragHandleProps = {},
  titre = 'Sans titre',
  description = '',
  montant = 0,
  dernierMouvement = 0,
  direction = 'up',
  objectif = null, // { cible: number } ou null
  niveauHierarchique = 'normal', // 'normal' | 'mini'
  niveau = 2, // niveau dans la hiérarchie (2 = petite, 3 = mini)
  modeEdition = false,
  canAnnuler = true,
  canAddSubcategory = true, // contrôle bouton + Sous-catégorie (niveau < 3)
  maxAmountForMinus = null, // plafond pour le bouton − (= montant actuel)
  maxAmountForRenvoyer = null, // plafond pour le bouton ⤴ (= montant actuel)
  onPlus,
  onMinus,
  onUndo,
  onRetourARepartir,
  onEdit, // toggle modeEdition
  onGraphique,
  onDescription,
  onSaveEdition, // ({ titre, description }) => void
  onToggleObjectif, // (newCible: number | null) => void
  onAddSubcategory, // () => void
  onDelete, // () => void
  actionInputActive = null, // '+' | '-' | '⤴' | null
  onValidateInput, // (type, { amount, note? }) => void
  onCancelInput,
  sousEnveloppes = [],
  isDescriptionOpen = false,
  onReorderSousEnveloppes = null,
}) {
  const isMini = niveauHierarchique === 'mini';
  const hasChildren = sousEnveloppes.length > 0;

  // Ordre local des sous-enveloppes pour le DnD (optimistic)
  const [ordreEnfants, setOrdreEnfants] = useState(() => sousEnveloppes.map(s => s.id));

  // Sync si un enfant est ajouté ou supprimé
  useEffect(() => {
    const extIds = sousEnveloppes.map(s => s.id);
    setOrdreEnfants(prev => {
      const prevSet = new Set(prev);
      if (prev.length === extIds.length && extIds.every(id => prevSet.has(id))) return prev;
      return extIds;
    });
  }, [sousEnveloppes]);

  const sousSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
  );

  const handleSousDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = ordreEnfants.indexOf(active.id);
    const newIdx = ordreEnfants.indexOf(over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(ordreEnfants, oldIdx, newIdx);
    setOrdreEnfants(next);
    onReorderSousEnveloppes?.(next);
  }, [ordreEnfants, onReorderSousEnveloppes]);

  const couleurCompteur = montant > 0 ? 'positif' : 'zero';
  const couleurMvt =
    direction === 'transfert'
      ? 'neutre'
      : direction === 'up'
      ? 'positif'
      : 'negatif';

  // Le bouton ⤴ est-il pertinent ? Pas si grande enveloppe ou créance (mais
  // ce composant n'est ni l'un ni l'autre). Donc il est toujours présent
  // SAUF si l'enveloppe a des enfants.
  const showActionButtons = !hasChildren && !modeEdition;
  const showEditionButtons = modeEdition;

  return (
    <motion.article
        className={`
          surface-velin liserer-signature
          relative
          ${isMini ? 'p-4 md:p-5' : 'p-4 md:p-5'}
          ${modeEdition ? 'ring-2 ring-or/60 ring-offset-2 ring-offset-velin' : ''}
        `}
        style={{ borderStyle: modeEdition ? 'dashed' : 'solid' }}
        whileHover={!modeEdition ? {
          y: -3,
          boxShadow: '0 8px 24px rgba(31, 24, 16, 0.10), 0 3px 8px rgba(31, 24, 16, 0.06)',
        } : {}}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        aria-label={`Enveloppe ${titre}`}
      >
        {/* ============ Ligne 1 : Drag + Titre + Actions de coin ============ */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              type="button"
              disabled={modeEdition}
              {...dragHandleProps}
              className={`
                shrink-0 mt-1 p-1 -ml-1 -mt-1 rounded-md
                text-encre-tertiaire
                transition-colors duration-300 ease-noble
                ${
                  modeEdition
                    ? 'opacity-30 cursor-not-allowed'
                    : 'cursor-grab active:cursor-grabbing hover:text-or hover:bg-or/5'
                }
              `}
              aria-label="Réordonner par glisser-déposer"
            >
              <GripVertical size={isMini ? 16 : 18} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className="flex-1 min-w-0">
              {modeEdition ? (
                <input
                  type="text"
                  defaultValue={titre}
                  onChange={(e) => onSaveEdition?.({ titre: e.target.value, description })}
                  className={`
                    ${isMini ? 't-titre-mini-enveloppe' : 't-titre-enveloppe'}
                    w-full bg-transparent
                    border-b border-or/40
                    focus:border-or focus:outline-none
                    pb-0.5
                  `}
                  aria-label="Titre de l'enveloppe"
                />
              ) : (
                <h3 className={isMini ? 't-titre-mini-enveloppe' : 't-titre-enveloppe'}>
                  {titre}
                </h3>
              )}
            </div>
          </div>

          {/* Actions de coin (info + graphique) — masquées en mode édition */}
          {!modeEdition && (
            <div className="flex items-center gap-1 shrink-0">
              {description && (
                <button
                  type="button"
                  onClick={onDescription}
                  aria-label={isDescriptionOpen ? 'Masquer la description' : 'Voir la description'}
                  aria-expanded={isDescriptionOpen}
                  className="
                    p-2 rounded-md
                    text-encre-tertiaire hover:text-encre hover:bg-velin-fonce
                    transition-colors duration-200
                    focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-1
                  "
                >
                  <Info size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onGraphique}
                aria-label="Voir la courbe d'évolution"
                className="
                  p-2 rounded-md
                  text-encre-tertiaire hover:text-encre hover:bg-velin-fonce
                  transition-colors duration-200
                  focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-1
                "
              >
                <LineChart size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* ============ Description ============ */}
        <AnimatePresence>
          {modeEdition ? (
            <motion.div
              key="desc-edit"
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <textarea
                defaultValue={description}
                onChange={(e) => onSaveEdition?.({ titre, description: e.target.value })}
                placeholder="Description (optionnelle)"
                rows={2}
                className="
                  w-full bg-transparent
                  font-serif italic text-base text-encre-secondaire
                  border-b border-or/30 focus:border-or focus:outline-none
                  resize-none pb-1
                "
                aria-label="Description de l'enveloppe"
              />
            </motion.div>
          ) : (
            isDescriptionOpen &&
            description && (
              <motion.p
                key="desc-view"
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="t-body-secondaire overflow-hidden"
              >
                {description}
              </motion.p>
            )
          )}
        </AnimatePresence>

        {/* ============ Ligne 2 : Compteur + flèche + dernier mouvement ============ */}
        <div className="flex items-end justify-between gap-3 mb-2">
          <OdometerCounter
            value={montant}
            color={couleurCompteur}
            size={isMini ? 'md' : 'lg'}
          />

          <div className="flex flex-col items-center gap-0.5">
            <FlecheDirection direction={direction} size={isMini ? 18 : 24} />
            <span
              className={`
                ${isMini ? 'text-[11px]' : 'text-xs'}
                tabular-nums font-sans font-medium
                ${
                  couleurMvt === 'positif'
                    ? 'signal-positif'
                    : couleurMvt === 'negatif'
                    ? 'signal-negatif'
                    : 'signal-neutre'
                }
              `}
            >
              {dernierMouvement >= 0 ? '+' : ''}
              {dernierMouvement.toLocaleString('fr-BE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {'\u202F'}€
            </span>
          </div>
        </div>

        {/* ============ Barre de progression objectif ============ */}
        <AnimatePresence>
          {objectif && objectif.cible > 0 && !modeEdition && (
            <motion.div
              key="barre-objectif"
              initial={false}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <BarreObjectif courant={montant} cible={objectif.cible} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ Ligne 3 : Boutons (action OU édition) ============ */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[rgba(31,24,16,0.06)]">
          <AnimatePresence mode="wait">
            {/* === Mode : champ de saisie actif === */}
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
                  maxAmount={
                    actionInputActive === '-'
                      ? maxAmountForMinus
                      : actionInputActive === '⤴'
                      ? maxAmountForRenvoyer
                      : null
                  }
                  onValidate={(payload) => onValidateInput?.(actionInputActive, payload)}
                  onCancel={onCancelInput}
                  placeholder={
                    actionInputActive === '+'
                      ? 'Recevoir'
                      : actionInputActive === '-'
                      ? 'Dépenser'
                      : 'Renvoyer'
                  }
                />
              </motion.div>
            ) : showEditionButtons ? (
              /* === Mode : édition (3 boutons spéciaux) === */
              <motion.div
                key="edition"
                className="flex items-center gap-2 flex-1 flex-wrap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    onToggleObjectif?.(objectif ? null : 100)
                  }
                  aria-label={objectif ? "Désactiver l'objectif" : 'Activer un objectif'}
                  aria-pressed={!!objectif}
                  className={`
                    inline-flex items-center gap-2 px-3 h-10 min-h-[40px] rounded-md
                    border transition-colors duration-200
                    ${
                      objectif
                        ? 'bg-or/15 border-or/40 text-or-fonce'
                        : 'bg-velin-clair border-[rgba(31,24,16,0.08)] text-encre hover:bg-velin-fonce'
                    }
                    text-sm font-medium
                    focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
                  `}
                >
                  <Target size={16} strokeWidth={1.75} aria-hidden="true" />
                  Objectif
                </button>

                {objectif && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      key={objectif.cible}
                      defaultValue={objectif.cible}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value.replace(',', '.'))
                        if (!isNaN(val) && val > 0) onToggleObjectif?.(val)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                      className="
                        w-24 h-10 min-h-[40px] px-2 rounded-md text-sm
                        font-sans tabular-nums text-encre
                        bg-velin-clair border border-or/40
                        focus:outline-none focus:border-or
                      "
                      aria-label="Montant cible de l'objectif"
                    />
                    <span className="text-sm text-encre-secondaire">€</span>
                  </div>
                )}

                {canAddSubcategory && niveau < 3 && (
                  <button
                    type="button"
                    onClick={onAddSubcategory}
                    aria-label="Ajouter une sous-catégorie"
                    className="
                      inline-flex items-center gap-2 px-3 h-10 min-h-[40px] rounded-md
                      bg-velin-clair border border-[rgba(31,24,16,0.08)] text-encre
                      hover:bg-velin-fonce
                      transition-colors duration-200
                      text-sm font-medium
                      focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
                    "
                  >
                    <FolderPlus size={16} strokeWidth={1.75} aria-hidden="true" />
                    Sous-catégorie
                  </button>
                )}

                <button
                  type="button"
                  onClick={onDelete}
                  aria-label="Supprimer cette enveloppe"
                  className="
                    inline-flex items-center gap-2 px-3 h-10 min-h-[40px] rounded-md
                    bg-transparent border border-rouge/40 text-rouge
                    hover:bg-rouge/10
                    transition-colors duration-200
                    text-sm font-medium
                    focus-visible:outline-2 focus-visible:outline-rouge focus-visible:outline-offset-2
                  "
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  Supprimer
                </button>
              </motion.div>
            ) : showActionButtons ? (
              /* === Mode : boutons d'action standard (feuille) === */
              <motion.div
                key="boutons"
                className="flex items-center gap-2 flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <BoutonAction icon={Plus} onClick={onPlus} ariaLabel={`Ajouter à ${titre}`} tone="noble" />
                <BoutonAction
                  icon={Minus}
                  onClick={onMinus}
                  ariaLabel={`Retirer de ${titre}`}
                  tone="noble"
                  disabled={montant === 0}
                />
                <BoutonAction
                  icon={Undo2}
                  onClick={onUndo}
                  ariaLabel="Annuler le dernier mouvement"
                  tone="noble"
                  disabled={!canAnnuler}
                />
                <BoutonAction
                  icon={CornerUpLeft}
                  onClick={onRetourARepartir}
                  ariaLabel="Renvoyer à répartir"
                  tone="noble"
                  disabled={montant === 0}
                />
              </motion.div>
            ) : (
              /* === Mode : avec enfants, aucun bouton d'action === */
              <motion.div
                key="aucun"
                className="flex-1 text-encre-tertiaire italic text-sm font-serif"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Somme des sous-enveloppes
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bouton crayon — toujours à droite */}
          <button
            type="button"
            onClick={onEdit}
            aria-label={modeEdition ? 'Valider les modifications' : 'Modifier'}
            className={`
              h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center
              rounded-md transition-colors duration-200 ease-noble
              ${
                modeEdition
                  ? 'bg-or text-encre hover:bg-or-clair'
                  : 'bg-transparent text-encre-tertiaire hover:bg-velin-fonce hover:text-encre'
              }
              focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
            `}
          >
            {modeEdition ? (
              <Check size={18} strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* ============ Sous-enveloppes imbriquées (drag & drop) ============ */}
        {sousEnveloppes.length > 0 && (
          <DndContext
            sensors={sousSensors}
            collisionDetection={closestCenter}
            onDragStart={() => { if (navigator.vibrate) navigator.vibrate(10); }}
            onDragEnd={handleSousDragEnd}
          >
            <SortableContext items={ordreEnfants} strategy={verticalListSortingStrategy}>
              <div className="mt-4 border-2 border-or/20 rounded-xl flex flex-col gap-3 p-3">
                {ordreEnfants
                  .map(id => sousEnveloppes.find(s => s.id === id))
                  .filter(Boolean)
                  .map(sous => (
                    <SousEnveloppeSortable
                      key={sous.id}
                      sous={sous}
                      niveauParent={niveau}
                    />
                  ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </motion.article>
  );
}

function SousEnveloppeSortable({ sous, niveauParent }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: sous.id, disabled: sous.modeEdition });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: [transition, 'filter 0.2s ease'].filter(Boolean).join(', '),
    position: 'relative',
    zIndex: isDragging ? 10 : 'auto',
    filter: isDragging ? 'drop-shadow(0 8px 16px rgba(31,24,16,0.15))' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PetiteEnveloppe
        {...sous}
        niveauHierarchique="mini"
        niveau={(niveauParent || 2) + 1}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function propsEgales(prev, next) {
  // Les callbacks (fonctions) et dragHandleProps sont délibérément exclus :
  // ils sont recréés à chaque render du parent mais leur comportement est stable.
  return (
    prev.id === next.id &&
    prev.titre === next.titre &&
    prev.description === next.description &&
    prev.montant === next.montant &&
    prev.dernierMouvement === next.dernierMouvement &&
    prev.direction === next.direction &&
    prev.modeEdition === next.modeEdition &&
    prev.actionInputActive === next.actionInputActive &&
    prev.isDescriptionOpen === next.isDescriptionOpen &&
    prev.canAnnuler === next.canAnnuler &&
    prev.niveauHierarchique === next.niveauHierarchique &&
    prev.maxAmountForMinus === next.maxAmountForMinus &&
    (prev.objectif?.cible) === (next.objectif?.cible) &&
    prev.sousEnveloppes.length === next.sousEnveloppes.length &&
    prev.sousEnveloppes.every((s, i) => {
      const n = next.sousEnveloppes[i]
      return s.id === n.id &&
             s.titre === n.titre &&
             s.direction === n.direction &&
             s.montant === n.montant &&
             s.modeEdition === n.modeEdition &&
             s.actionInputActive === n.actionInputActive &&
             s.canAnnuler === n.canAnnuler &&
             s.isDescriptionOpen === n.isDescriptionOpen
    })
  )
}

export default memo(PetiteEnveloppe, propsEgales)
