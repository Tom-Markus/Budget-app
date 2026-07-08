/**
 * src/lib/widgetsApi.js
 * ----------------------------------------------------------------------------
 * Fetchers des widgets de la page News (météo, Fear & Greed, taux de change).
 * Séparés des composants pour que chaque fichier de widget n'exporte qu'un
 * composant (Fast Refresh fiable en dev).
 * ----------------------------------------------------------------------------
 */

// ── Météo — Open-Meteo + géocodage inverse BigDataCloud ────────────────────

export async function fetchWeather() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        try {
          // Météo (Open-Meteo) — API principale
          const wRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,weather_code,wind_speed_10m` +
            `&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code` +
            `&timezone=auto&wind_speed_unit=kmh&forecast_days=4`
          )
          const w = await wRes.json()

          // Géocodage inverse — BigDataCloud (CORS natif, gratuit, sans clé)
          // Non bloquant : si ça échoue, on garde le fallback 'Ma position'
          let city = 'Ma position'
          try {
            const gRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`
            )
            const g = await gRes.json()
            city = g.city || g.locality || g.principalSubdivision || 'Ma position'
          } catch { /* géocodage indisponible — on garde le fallback */ }

          const fmtTime = (iso) => iso?.slice(11, 16) ?? null
          const fmtDay  = (iso) => iso ? new Date(iso).toLocaleDateString('fr-BE', { weekday: 'short' }) : null
          const daily = w.daily ?? {}
          const forecast = [1, 2, 3].map(i => ({
            day:     fmtDay(daily.sunrise?.[i] ?? daily.time?.[i]),
            maxTemp: daily.temperature_2m_max?.[i] != null ? Math.round(daily.temperature_2m_max[i]) : null,
            minTemp: daily.temperature_2m_min?.[i] != null ? Math.round(daily.temperature_2m_min[i]) : null,
            code:    daily.weather_code?.[i] ?? 0,
          })).filter(d => d.day)
          resolve({
            temp:     Math.round(w.current.temperature_2m),
            code:     w.current.weather_code,
            wind:     Math.round(w.current.wind_speed_10m),
            city,
            sunrise:  fmtTime(w.daily?.sunrise?.[0]),
            sunset:   fmtTime(w.daily?.sunset?.[0]),
            todayMax: daily.temperature_2m_max?.[0] != null ? Math.round(daily.temperature_2m_max[0]) : null,
            todayMin: daily.temperature_2m_min?.[0] != null ? Math.round(daily.temperature_2m_min[0]) : null,
            forecast,
          })
        } catch { resolve(null) }
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 }
    )
  })
}

// ── Fear & Greed — alternative.me ──────────────────────────────────────────

export async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const { data } = await res.json()
    if (!data?.[0]) return null
    return {
      value:          parseInt(data[0].value, 10),
      classification: data[0].value_classification,
    }
  } catch { return null }
}

// ── Taux de change — Frankfurter via /api/fx ───────────────────────────────

export async function fetchFx() {
  try {
    const res = await fetch('/api/fx')
    if (!res.ok) return null
    const { rates, date } = await res.json()
    return { rates, date }
  } catch { return null }
}
