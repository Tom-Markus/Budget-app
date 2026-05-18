/**
 * ChampSaisie.jsx
 * ----------------------------------------------------------------------------
 * Champ de saisie qui apparaît à la place des boutons (+, -, ⤴)
 * quand l'utilisateur clique dessus. Prend toute la largeur du bas
 * de l'enveloppe, avec sigle € à droite et bouton V de validation.
 *
 * Props :
 *   onValidate     — handler({ amount: number, note?: string })
 *   onCancel       — handler() pour fermer sans valider
 *   placeholder    — string (par défaut: '0,00')
 *   noteMode       — 'none' | 'optional' | 'required' (défaut: 'none')
 *                    'none'     : pas de champ note
 *                    'optional' : icône note qui ouvre un champ texte
 *                    'required' : champ note toujours visible, obligatoire
 *   maxAmount      — number, plafond (au-dessus → bouton V désactivé + tooltip)
 *                    Si défini, sert à empêcher un compteur de passer sous 0.
 *   autoFocus      — bool (défaut: true)
 *
 * Saisie tolérante : accepte virgule OU point. Affichage interne en virgule.
 *
 * Validations désactivant le bouton V :
 *   - Saisie vide
 *   - Saisie non numérique
 *   - Montant ≤ 0
 *   - Montant > maxAmount (tooltip "Montant trop élevé")
 *   - noteMode === 'required' et note vide
 * ----------------------------------------------------------------------------
 */
import { motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Check, X, MessageSquare } from 'lucide-react';

export default function ChampSaisie({
  onValidate,
  onCancel,
  placeholder = '0,00',
  noteMode = 'none',
  maxAmount = null,
  autoFocus = true,
}) {
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [noteVisible, setNoteVisible] = useState(noteMode === 'required');
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  function handleChange(e) {
    const v = e.target.value;
    if (/^-?[0-9]*[,.]?[0-9]*$/.test(v)) {
      setRaw(v);
    }
  }

  function parseValue() {
    const normalized = raw.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? null : n;
  }

  const parsed = parseValue();

  // Validations
  const isEmpty = raw.trim() === '' || parsed === null;
  const isNonPositive = !isEmpty && parsed <= 0;
  const isOverMax = !isEmpty && maxAmount !== null && parsed > maxAmount;
  const isNoteMissing = noteMode === 'required' && note.trim() === '';

  const isInvalid = isEmpty || isNonPositive || isOverMax || isNoteMissing;

  // Tooltip à afficher si bouton désactivé pour cause précise
  let disabledReason = null;
  if (isOverMax) disabledReason = 'Montant trop élevé';
  else if (isNoteMissing) disabledReason = 'Note obligatoire';

  function handleSubmit() {
    if (isInvalid) {
      // Petit shake visuel pour signaler le rejet
      setShake(true);
      setTimeout(() => setShake(false), 220);
      // Si la note manque, on focus dessus
      if (isNoteMissing && noteRef.current) {
        noteRef.current.focus();
      }
      return;
    }
    onValidate({
      amount: parsed,
      note: noteMode === 'none' ? undefined : note.trim() || undefined,
    });
    setRaw('');
    setNote('');
  }

  function handleKey(e) {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel?.();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={shake
        ? { opacity: 1, x: [-4, 4, -3, 3, 0] }
        : { opacity: 1 }
      }
      exit={{ opacity: 0 }}
      transition={{
        duration: shake ? 0.22 : 0.18,
        ease: shake ? [0, 0, 0.2, 1] : 'easeOut',
      }}
      className="flex flex-col gap-2 w-full"
    >
      {/* Ligne principale : montant + sigle € + boutons */}
      <div className="flex items-center gap-2 w-full bg-velin-clair border border-[rgba(31,24,16,0.12)] rounded-md px-3 h-11 min-h-[44px]">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="t-chiffre-md flex-1 bg-transparent text-encre placeholder:text-encre-tertiaire focus:outline-none min-w-0"
          aria-label="Montant en euros"
          aria-invalid={isInvalid}
        />

        <span className="t-chiffre-md text-encre-secondaire pointer-events-none">€</span>

        {/* Bouton "note" optionnel (mini icône) */}
        {noteMode === 'optional' && (
          <button
            type="button"
            onClick={() => {
              setNoteVisible((v) => !v);
              setTimeout(() => noteRef.current?.focus(), 50);
            }}
            aria-label={noteVisible ? 'Masquer la note' : 'Ajouter une note'}
            aria-pressed={noteVisible}
            className={`
              h-8 w-8 flex items-center justify-center
              rounded-sm transition-colors duration-200
              ${
                noteVisible
                  ? 'bg-or/15 text-or-fonce'
                  : 'text-encre-tertiaire hover:text-encre hover:bg-velin-fonce'
              }
              focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
            `}
          >
            <MessageSquare size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isInvalid}
          aria-label="Valider"
          title={disabledReason || undefined}
          className={`
            h-8 w-8 flex items-center justify-center
            rounded-sm transition-colors duration-200
            ${
              isInvalid
                ? 'bg-or/30 text-encre/40 cursor-not-allowed'
                : 'bg-or text-encre hover:bg-or-clair active:scale-95'
            }
            focus-visible:outline-2 focus-visible:outline-encre focus-visible:outline-offset-2
          `}
        >
          <Check size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Annuler la saisie"
            className="
              h-8 w-8 flex items-center justify-center
              text-encre-tertiaire hover:text-encre rounded-sm
              transition-colors duration-200
              focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
            "
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Champ note (visible si required, ou si optional + toggled) */}
      {(noteMode === 'required' || (noteMode === 'optional' && noteVisible)) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="overflow-hidden"
        >
          <input
            ref={noteRef}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKey}
            placeholder={noteMode === 'required' ? 'Note (obligatoire)' : 'Note'}
            className="
              w-full bg-velin-clair border border-[rgba(31,24,16,0.12)] rounded-md
              px-3 h-10 min-h-[40px]
              text-encre placeholder:text-encre-tertiaire
              font-serif italic text-base
              focus:outline-none focus:border-or/40
            "
            aria-label="Note descriptive"
            aria-required={noteMode === 'required'}
          />
        </motion.div>
      )}

      {/* Tooltip discret en cas de désactivation contextuelle */}
      {disabledReason && (
        <span className="text-xs text-rouge italic px-1" role="status" aria-live="polite">
          {disabledReason}
        </span>
      )}
    </motion.div>
  );
}
