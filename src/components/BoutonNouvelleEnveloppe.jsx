/**
 * BoutonNouvelleEnveloppe.jsx
 * ----------------------------------------------------------------------------
 * Bouton + mini-formulaire pour créer une nouvelle enveloppe.
 * Style : cadre pointillé noble au repos, devient formulaire au clic.
 *
 * Variantes :
 *   - variant 'enveloppe'  → champs : titre + description (optionnelle)
 *   - variant 'creance'    → champs : nom de la personne
 *   - variant 'sous-categorie' → champs : titre + description (optionnelle)
 *
 * Props :
 *   variant      — 'enveloppe' | 'creance' | 'sous-categorie' (défaut: 'enveloppe')
 *   onCreate     — handler({ titre, description? }) → Promise (le composant gère le loading)
 *   onCancel     — handler() optionnel (sortie du formulaire sans création)
 * ----------------------------------------------------------------------------
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';

const LABELS = {
  enveloppe: {
    bouton: 'Nouvelle enveloppe',
    titrePlaceholder: 'Nom de l\u2019enveloppe',
    descPlaceholder: 'Description (optionnelle)',
    hasDescription: true,
  },
  'sous-categorie': {
    bouton: 'Sous-catégorie',
    titrePlaceholder: 'Nom de la sous-catégorie',
    descPlaceholder: 'Description (optionnelle)',
    hasDescription: true,
  },
  creance: {
    bouton: 'Nouvelle créance',
    titrePlaceholder: 'Nom de la personne',
    descPlaceholder: null,
    hasDescription: false,
  },
};

export default function BoutonNouvelleEnveloppe({
  variant = 'enveloppe',
  onCreate,
  onCancel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const labels = LABELS[variant];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleOpen() {
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setTitre('');
    setDescription('');
    onCancel?.();
  }

  async function handleSubmit() {
    if (!titre.trim()) return;
    setLoading(true);
    try {
      await onCreate?.({
        titre: titre.trim(),
        description: description.trim() || undefined,
      });
      setTitre('');
      setDescription('');
      setIsOpen(false);
    } catch (err) {
      // L'erreur est gérée par le parent via toast
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  }

  return (
    <AnimatePresence mode="wait">
      {!isOpen ? (
        /* ====== État au repos : cadre pointillé ====== */
        <motion.button
          key="repos"
          type="button"
          onClick={handleOpen}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="
            w-full flex items-center justify-center gap-2
            min-h-[88px] py-6 px-5
            bg-transparent
            border-2 border-dashed border-encre-tertiaire/40
            rounded-lg
            text-encre-tertiaire
            font-serif italic text-base
            hover:border-or/60 hover:text-or hover:bg-or/5
            transition-colors duration-300 ease-noble
            focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
          "
          aria-label={labels.bouton}
        >
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{labels.bouton}</span>
        </motion.button>
      ) : (
        /* ====== Formulaire ouvert ====== */
        <motion.div
          key="formulaire"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="
            surface-velin
            p-5 md:p-6
            flex flex-col gap-3
          "
        >
          <input
            ref={inputRef}
            type="text"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            onKeyDown={handleKey}
            placeholder={labels.titrePlaceholder}
            className="
              w-full bg-transparent
              border-b border-or/40 focus:border-or focus:outline-none
              font-serif italic font-medium text-xl text-encre
              placeholder:text-encre-tertiaire
              pb-1
            "
            aria-label={labels.titrePlaceholder}
          />

          {labels.hasDescription && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKey}
              placeholder={labels.descPlaceholder}
              rows={2}
              className="
                w-full bg-transparent
                font-serif italic text-base text-encre-secondaire
                border-b border-or/20 focus:border-or/60 focus:outline-none
                resize-none pb-1
                placeholder:text-encre-tertiaire
              "
              aria-label={labels.descPlaceholder}
            />
          )}

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="
                h-10 min-h-[40px] px-4 rounded-md
                text-encre-secondaire hover:text-encre hover:bg-velin-fonce
                transition-colors duration-200
                text-sm font-medium
                focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
              "
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!titre.trim() || loading}
              className={`
                h-10 min-h-[40px] px-5 rounded-md
                inline-flex items-center gap-2
                transition-colors duration-200
                text-sm font-medium
                ${
                  !titre.trim() || loading
                    ? 'bg-or/30 text-encre/40 cursor-not-allowed'
                    : 'bg-bordeaux text-velin-clair hover:bg-bordeaux-clair'
                }
                focus-visible:outline-2 focus-visible:outline-or focus-visible:outline-offset-2
              `}
            >
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              Créer
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
