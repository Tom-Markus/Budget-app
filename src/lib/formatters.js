/**
 * src/lib/formatters.js
 * ----------------------------------------------------------------------------
 * Format européen strict du brief :
 *   1.234,56 €  (point milliers, virgule décimale, espace fine \u202F avant €)
 *
 * Tolère aussi virgule ET point en entrée utilisateur (parseMontant).
 *
 * Dates : 12 mai / 12 mai 2025 selon l'année (formatDateHistorique).
 * ----------------------------------------------------------------------------
 */

// \u202F = NARROW NO-BREAK SPACE = espace fine insécable (spec brief).
const NBSP_FINE = '\u202F'

/**
 * formatEuros(1234.56)  → "1.234,56 €"
 * formatEuros(0)        → "0,00 €"
 */
export function formatEuros(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return `0,00${NBSP_FINE}€`
  const negative = n < 0
  const abs = Math.abs(n)
  let intPart = Math.floor(abs)
  let decPart = Math.round((abs - intPart) * 100)
  if (decPart === 100) { intPart += 1; decPart = 0 } // report d'arrondi
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decStr = decPart.toString().padStart(2, '0')
  return `${negative ? '-' : ''}${intStr},${decStr}${NBSP_FINE}€`
}

/**
 * formatEurosSigne(12)   → "+12,00 €"
 * formatEurosSigne(-12)  → "-12,00 €"
 * Pour les libellés sous les flèches directionnelles.
 */
export function formatEurosSigne(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return formatEuros(0)
  if (n >= 0) return `+${formatEuros(n)}`
  return formatEuros(n)
}

/**
 * Parse un montant tapé par l'utilisateur. Accepte virgule ET point.
 *   parseMontant("1.234,56") → 1234.56
 *   parseMontant("12.5")     → 12.5
 *   parseMontant("12,5")     → 12.5
 *   parseMontant("abc")      → NaN
 */
export function parseMontant(raw) {
  if (raw === null || raw === undefined) return NaN
  // On retire les espaces (y compris fines/insécables) et on normalise.
  const cleaned = String(raw)
    .replace(/\s/g, '')
    .replace(/\u00A0|\u202F/g, '')
  // Si la chaîne contient à la fois , et . on suppose . = milliers, , = décimale.
  // Sinon on remplace , par . pour parseFloat.
  let normalized
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = cleaned.replace(',', '.')
  }
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Date courte : "12 mai" si année courante, sinon "12 mai 2025"
 */
export function formatDateHistorique(date, refDate = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const memeAnnee = d.getFullYear() === refDate.getFullYear()
  return new Intl.DateTimeFormat('fr-BE', {
    day: 'numeric',
    month: 'long',
    ...(memeAnnee ? {} : { year: 'numeric' }),
  }).format(d)
}