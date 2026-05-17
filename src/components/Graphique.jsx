/**
 * Graphique.jsx
 * ----------------------------------------------------------------------------
 * Modal d'évolution d'une enveloppe. S'ouvre au clic sur le mini-logo
 * graphique. Affiche :
 *   - Courbe d'évolution (verte si dernier mvt positif, rouge si négatif)
 *   - Sélecteur de période : 7J / 30J / 3M / Tout (défaut 30J, non persisté)
 *   - Bouton croix pour fermer
 *   - Historique des 3 derniers mouvements (scroll dans la zone)
 *   - Si pas d'historique : message "Pas encore d'historique" + ligne plate à 0
 *
 * Props :
 *   isOpen        — bool
 *   onClose       — handler
 *   titre         — string (nom de l'enveloppe)
 *   data          — array of { date: ISO string, valeur: number }
 *   mouvements    — array of { date, montant, note }
 *   dernierMvtSigne — 'positif' | 'negatif' (pour couleur de la courbe)
 *
 * Lib : Recharts (déjà choisi par Tom)
 * ----------------------------------------------------------------------------
 */
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { preparerCourbe } from '../lib/calculs';

const PERIODES = [
  { id: '7J', label: '7 jours', jours: 7, agreger: false },
  { id: '30J', label: '30 jours', jours: 30, agreger: false },
  { id: '3M', label: '3 mois', jours: 90, agreger: true },
  { id: 'TOUT', label: 'Tout', jours: null, agreger: true },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat('fr-BE', {
      day: 'numeric',
      month: 'long',
    }).format(d);
  }
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatDateCompacte(dateStr) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const { date, valeur } = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-md text-xs"
      style={{
        background: 'var(--velin-clair)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid rgba(31,24,16,0.08)',
      }}
    >
      <div className="t-label-noble">{formatDate(date)}</div>
      <div className="font-sans font-medium text-encre tabular-nums mt-0.5">
        {valeur.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{'\u202F'}€
      </div>
    </div>
  );
}

export default function Graphique({
  isOpen,
  onClose,
  titre = '',
  data = [],
  mouvements = [],
  dernierMvtSigne = 'positif',
}) {
  const [periode, setPeriode] = useState('30J');

  // preparerCourbe étend l'axe à toute la fenêtre de période choisie et
  // agrège par jour pour 3M / TOUT (cf. src/lib/calculs.js).
  const dataFilteree = useMemo(() => {
    const p = PERIODES.find((p) => p.id === periode);
    return preparerCourbe(data, p?.jours ?? null, !!p?.agreger);
  }, [data, periode]);

  const couleurCourbe =
    dernierMvtSigne === 'positif' ? 'var(--vert)' : 'var(--rouge)';

  // "Pas encore d'historique" se base sur les données brutes : dataFilteree
  // contient toujours au moins les 2 points de bornage de l'axe.
  const aHistorique = data.length > 0;
  const dataAffichee = dataFilteree;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="graphique-titre"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(14, 31, 58, 0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Contenu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="
              relative w-full max-w-2xl
              surface-velin
              p-6 md:p-8
              flex flex-col
            "
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="t-label">Évolution</p>
                <h3 id="graphique-titre" className="t-h2 mt-1">
                  {titre}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                {/* Sélecteur de période */}
                <div className="flex items-center gap-1 mr-2 bg-velin-fonce rounded-md p-1">
                  {PERIODES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPeriode(p.id)}
                      className={`
                        px-2.5 py-1 rounded-sm text-xs font-medium
                        transition-all duration-200 ease-noble
                        ${
                          periode === p.id
                            ? 'bg-velin-clair text-encre shadow-xs'
                            : 'text-encre-secondaire hover:text-encre'
                        }
                      `}
                      aria-pressed={periode === p.id}
                    >
                      {p.id}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="
                    p-2 rounded-sm
                    text-encre-tertiaire hover:text-encre hover:bg-velin-fonce
                    transition-colors duration-200
                  "
                >
                  <X size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Courbe */}
            <div className="relative w-full h-56 md:h-64 mb-4">
              {!aHistorique && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <span className="t-label-noble">Pas encore d'historique</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dataAffichee}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="graphique-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={couleurCourbe} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={couleurCourbe} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(14, 31, 58, 0.08)"
                    strokeDasharray="2 4"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateCompacte}
                    stroke="var(--nuit)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(14, 31, 58, 0.2)' }}
                  />
                  <YAxis
                    stroke="var(--nuit)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(14, 31, 58, 0.2)' }}
                    tickFormatter={(v) =>
                      v.toLocaleString('fr-BE', { maximumFractionDigits: 0 })
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="valeur"
                    stroke={couleurCourbe}
                    strokeWidth={2.5}
                    fill="url(#graphique-fill)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: couleurCourbe,
                      stroke: 'var(--velin-clair)',
                      strokeWidth: 2,
                    }}
                    animationDuration={700}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Historique des 3 derniers mouvements */}
            <div className="border-t border-[rgba(31,24,16,0.08)] pt-4">
              <p className="t-label mb-3">Derniers mouvements</p>
              <div
                className="max-h-40 overflow-y-auto flex flex-col gap-2 pr-2"
                style={{ overscrollBehavior: 'contain' }}
              >
                {mouvements.length === 0 ? (
                  <p className="t-meta text-center py-4">Aucun mouvement</p>
                ) : (
                  mouvements.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-1.5 border-b border-[rgba(31,24,16,0.06)] last:border-0"
                    >
                      <span className="t-meta tabular-nums w-24 shrink-0">
                        {formatDate(m.date)}
                      </span>
                      <span
                        className={`font-sans font-medium text-sm tabular-nums w-24 shrink-0 text-right ${
                          m.montant >= 0 ? 'signal-positif' : 'signal-negatif'
                        }`}
                      >
                        {m.montant >= 0 ? '+' : ''}
                        {m.montant.toLocaleString('fr-BE', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{'\u202F'}€
                      </span>
                      {m.note && (
                        <span className="t-body-secondaire flex-1 italic truncate">
                          {m.note}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}