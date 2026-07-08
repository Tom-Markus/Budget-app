import {
  Sun, Cloud, Cloudy, CloudSun, CloudSunRain,
  CloudDrizzle, CloudRain, CloudRainWind,
  CloudSnow, CloudFog, CloudLightning, Snowflake,
  Wind, MapPin, Sunrise, Sunset,
} from 'lucide-react'

/* ── Codes WMO (Open-Meteo) → icône + label + couleur ─────────────────────── */
const WMO = {
  // Ciel dégagé / dégagé
  0:  { Icon: Sun,            label: 'Ensoleillé',              color: '#FBBF24' },
  1:  { Icon: Sun,            label: 'Ciel dégagé',             color: '#FBBF24' },
  // Nuages
  2:  { Icon: CloudSun,       label: 'Mi-nuageux',              color: '#FBBF24' },
  3:  { Icon: Cloudy,         label: 'Couvert',                 color: '#6B7280' },
  // Brouillard
  45: { Icon: CloudFog,       label: 'Brumeux',                 color: '#9CA3AF' },
  48: { Icon: CloudFog,       label: 'Brouillard givrant',      color: '#93C5FD' },
  // Bruine
  51: { Icon: CloudDrizzle,   label: 'Bruine légère',           color: '#7DD3FC' },
  53: { Icon: CloudDrizzle,   label: 'Bruine',                  color: '#60A5FA' },
  55: { Icon: CloudDrizzle,   label: 'Bruine forte',            color: '#3B82F6' },
  // Bruine verglaçante
  56: { Icon: CloudDrizzle,   label: 'Bruine verglaçante',      color: '#67E8F9' },
  57: { Icon: CloudDrizzle,   label: 'Bruine verglaçante',      color: '#22D3EE' },
  // Pluie
  61: { Icon: CloudRain,      label: 'Pluie légère',            color: '#60A5FA' },
  63: { Icon: CloudRain,      label: 'Pluie',                   color: '#3B82F6' },
  65: { Icon: CloudRain,      label: 'Pluie forte',             color: '#1D4ED8' },
  // Pluie verglaçante
  66: { Icon: CloudRain,      label: 'Pluie verglaçante',       color: '#67E8F9' },
  67: { Icon: CloudRainWind,  label: 'Pluie verglaçante forte', color: '#22D3EE' },
  // Neige
  71: { Icon: CloudSnow,      label: 'Neige légère',            color: '#BAE6FD' },
  73: { Icon: CloudSnow,      label: 'Neige',                   color: '#93C5FD' },
  75: { Icon: CloudSnow,      label: 'Neige forte',             color: '#7DD3FC' },
  77: { Icon: Snowflake,      label: 'Grains de neige',         color: '#BAE6FD' },
  // Averses de pluie
  80: { Icon: CloudSunRain,   label: 'Averses légères',         color: '#60A5FA' },
  81: { Icon: CloudRain,      label: 'Averses',                 color: '#3B82F6' },
  82: { Icon: CloudRainWind,  label: 'Averses violentes',       color: '#1D4ED8' },
  // Averses de neige
  85: { Icon: CloudSnow,      label: 'Averses de neige',        color: '#BAE6FD' },
  86: { Icon: CloudSnow,      label: 'Averses de neige fortes', color: '#93C5FD' },
  // Orage
  95: { Icon: CloudLightning, label: 'Orage',                   color: '#A78BFA' },
  96: { Icon: CloudLightning, label: 'Orage avec grêle',        color: '#8B5CF6' },
  99: { Icon: CloudLightning, label: 'Orage fort avec grêle',   color: '#7C3AED' },
}

function getWmo(code) {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { Icon: Cloud, label: '?', color: '#9CA3AF' }
}

export function WidgetMeteo({ weather }) {

  if (weather === undefined) {
    return (
      <div className="surface-velin liserer-signature p-5 flex gap-4 items-center animate-pulse h-full">
        <div className="h-9 w-9 bg-encre/6 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 bg-encre/6 rounded" />
          <div className="h-5 w-16 bg-encre/8 rounded" />
          <div className="h-2.5 w-28 bg-encre/5 rounded" />
        </div>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="surface-velin liserer-signature p-5 h-full flex items-center gap-3">
        <MapPin size={18} className="text-encre-tertiaire/40 shrink-0" aria-hidden="true" />
        <p className="font-sans text-[13px] text-encre-tertiaire">Météo indisponible — localisation désactivée</p>
      </div>
    )
  }

  const { Icon: WeatherIcon, label: weatherLabel, color: weatherColor } = getWmo(weather.code)

  return (
    <div className="surface-velin liserer-signature p-5 h-full flex flex-col items-center justify-center gap-4">
      <div className="flex items-center justify-center gap-4 w-full">
        <WeatherIcon size={40} strokeWidth={1.25} style={{ color: weatherColor }} aria-hidden="true" className="shrink-0" />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="font-serif font-medium text-[33px] text-encre leading-none tabular-nums">
              {weather.temp}°C
            </span>
            <span className="font-sans text-[13px] text-encre-secondaire truncate">{weather.city}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="font-sans italic text-[13px] text-encre-tertiaire">{weatherLabel}</span>
            <span className="text-encre-tertiaire/30 text-[11px]">·</span>
            <Wind size={11} strokeWidth={1.5} className="text-encre-tertiaire/50 shrink-0" aria-hidden="true" />
            <span className="font-sans text-[13px] text-encre-tertiaire">{weather.wind} km/h</span>
            {(weather.todayMax != null || weather.todayMin != null) && (
              <>
                <span className="text-encre-tertiaire/30 text-[11px]">·</span>
                <span
                  className="font-sans text-[13px] tabular-nums"
                  style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
                  title="Min / Max du jour"
                >
                  {weather.todayMin != null && (
                    <span className="text-nuit-clair/70">↓{weather.todayMin}°</span>
                  )}
                  {weather.todayMin != null && weather.todayMax != null && (
                    <span className="text-encre-tertiaire/40 mx-0.5"> </span>
                  )}
                  {weather.todayMax != null && (
                    <span className="text-rouge/70">↑{weather.todayMax}°</span>
                  )}
                </span>
              </>
            )}
          </div>
          {(weather.sunrise || weather.sunset) && (
            <div className="flex items-center gap-4 mt-1.5">
              {weather.sunrise && (
                <span className="flex items-center gap-1.5">
                  <Sunrise size={14} strokeWidth={1.5} className="text-or shrink-0" aria-hidden="true" />
                  <span className="font-sans text-[13px] text-encre-secondaire tabular-nums" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>{weather.sunrise}</span>
                </span>
              )}
              {weather.sunset && (
                <span className="flex items-center gap-1.5">
                  <Sunset size={14} strokeWidth={1.5} className="text-or/60 shrink-0" aria-hidden="true" />
                  <span className="font-sans text-[13px] text-encre-secondaire tabular-nums" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>{weather.sunset}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {weather.forecast?.length > 0 && (
        <div className="w-full border-t border-encre/6 pt-3 flex items-center justify-center gap-1">
          {weather.forecast.map((day, i) => {
            const { Icon: FIcon, color: fColor } = getWmo(day.code)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 px-1">
                <span className="font-sans text-[11px] text-encre-tertiaire/60 uppercase tracking-widest">
                  {day.day?.replace('.', '')}
                </span>
                <FIcon size={16} strokeWidth={1.5} style={{ color: fColor }} aria-hidden="true" />
                <div className="flex items-baseline gap-1 tabular-nums" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
                  <span className="font-sans text-[13px] font-medium text-encre">{day.maxTemp}°</span>
                  <span className="font-sans text-[11px] text-encre-tertiaire/50">{day.minTemp}°</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
