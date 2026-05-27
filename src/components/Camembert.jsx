/**
 * Camembert.jsx
 * ----------------------------------------------------------------------------
 * Camembert de la répartition actuelle des fonds entre les enveloppes
 * principales. Affiché en haut de la page Graphes & Dettes.
 *
 * Caractéristiques :
 *   - Très lisible, légende claire
 *   - Couleurs : palette noble qui évite les collisions trading
 *   - Tooltip au hover/tap (Recharts)
 *
 * Props :
 *   donnees — array of { nom: string, valeur: number }
 *   couleurs — optional array of hex colors
 *
 * Lib : Recharts
 * ----------------------------------------------------------------------------
 */
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import OdometerCounter from './OdometerCounter';

// Palette noble pour le camembert — 8 teintes distinctes sur le cercle chromatique,
// toutes dans un registre sombre et raffiné. Évite vert vif/rouge pour ne pas
// créer de confusion avec les codes trading.
const PALETTE_DEFAUT = [
  '#1E3A5F', // bleu marine
  '#8B2635', // bordeaux
  '#C49A3C', // or
  '#2A5C4A', // vert sauge
  '#6B3A7D', // prune
  '#8B4A1E', // cuivre
  '#3D6E6E', // sarcelle
  '#5C4E28', // olive
];

function formatNombre(v) {
  return v.toLocaleString('fr-BE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CustomTooltipCamembert({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-md"
      style={{
        background: 'var(--velin-clair)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border-doux)',
      }}
    >
      <div className="font-serif italic text-sm text-encre">{d.nom}</div>
      <div className="font-sans font-medium text-encre tabular-nums mt-0.5">
        {formatNombre(d.valeur)}{' '}€
      </div>
      <div className="t-meta tabular-nums mt-0.5">
        {(d.pourcentage * 100).toFixed(1)}%
      </div>
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-3 px-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          <span className="text-xs text-encre-secondaire">
            {entry.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Camembert({ donnees = [], couleurs = PALETTE_DEFAUT }) {
  const total = donnees.reduce((acc, d) => acc + d.valeur, 0);
  const donneesAvecPourcentage = donnees.map((d) => ({
    ...d,
    pourcentage: total > 0 ? d.valeur / total : 0,
  }));

  return (
    <div className="w-full">
      <div className="relative" style={{ height: 270 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donneesAvecPourcentage}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={1.5}
              dataKey="valeur"
              nameKey="nom"
              stroke="var(--velin-clair)"
              strokeWidth={2}
              animationDuration={700}
            >
              {donneesAvecPourcentage.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={couleurs[i % couleurs.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltipCamembert />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Total centré dans le donut via position absolute */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
          <p className="t-label-noble">Total</p>
          <OdometerCounter value={total} color="neutre" size="md" />
        </div>
      </div>

      {/* Légende externe */}
      <CustomLegend
        payload={donneesAvecPourcentage.map((d, i) => ({
          value: d.nom,
          color: couleurs[i % couleurs.length],
        }))}
      />
    </div>
  );
}
