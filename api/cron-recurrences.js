// Vercel Cron — versements automatiques d'épargne, exécutés côté serveur.
// Planifié dans vercel.json (tous les jours à 03h00 UTC). Les versements
// tombent donc même si l'app n'est jamais ouverte.
//
// Anti-doublon : même verrou optimiste que le rattrapage client
// (executerRecurrencesDues) — recurring_last_run n'est avancé que s'il vaut
// encore la valeur lue. Client et serveur peuvent tourner en parallèle sans
// jamais créer de doublon.
//
// Variables d'environnement requises (Vercel → Settings → Environment Variables) :
//   SUPABASE_SERVICE_ROLE_KEY — clé service_role (Supabase → Settings → API).
//                               Contourne la RLS : NE JAMAIS l'exposer au client.
//   CRON_SECRET               — recommandé : Vercel l'envoie automatiquement en
//                               Authorization: Bearer <CRON_SECRET> sur les crons,
//                               ce qui bloque les appels externes à cet endpoint.
import { createClient } from '@supabase/supabase-js'

const INTERVALLES_VALIDES = ['daily', 'weekly', 'monthly', 'yearly']

function avancerDate(date, interval) {
  const d = new Date(date)
  switch (interval) {
    case 'daily':   d.setDate(d.getDate() + 1); break
    case 'weekly':  d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly':  d.setFullYear(d.getFullYear() + 1); break
    default: throw new Error('Cadence inconnue.')
  }
  return d
}

export default async function handler(req, res) {
  // Si CRON_SECRET est configuré, seul le cron Vercel (qui l'envoie en
  // Authorization) peut déclencher l'exécution.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return res.status(500).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY (et SUPABASE_URL ou VITE_SUPABASE_URL) requis',
    })
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: epargnes, error: eList } = await supabase
    .from('envelopes')
    .select('id, recurring_amount, recurring_interval, recurring_last_run')
    .eq('type', 'savings')
    .gt('recurring_amount', 0)
    .not('recurring_interval', 'is', null)
    .not('recurring_last_run', 'is', null)
  if (eList) return res.status(500).json({ error: eList.message })

  const now = new Date()
  let comptes = 0
  let versements = 0
  const erreurs = []

  for (const env of epargnes || []) {
    try {
      const montant = Number(env.recurring_amount)
      if (!(montant > 0) || !INTERVALLES_VALIDES.includes(env.recurring_interval)) continue
      const base = env.recurring_last_run

      let prochaine = avancerDate(base, env.recurring_interval)
      const echeances = []
      let garde = 0
      while (prochaine <= now && garde < 1200) {
        echeances.push(new Date(prochaine))
        prochaine = avancerDate(prochaine, env.recurring_interval)
        garde++
      }
      if (echeances.length === 0) continue

      // Verrou optimiste : avance last_run seulement s'il vaut encore `base`
      const derniere = echeances[echeances.length - 1]
      const { data: verrou, error: eLock } = await supabase
        .from('envelopes')
        .update({ recurring_last_run: derniere.toISOString() })
        .eq('id', env.id)
        .eq('recurring_last_run', base)
        .select('id')
      if (eLock) throw new Error(eLock.message)
      if (!verrou || verrou.length === 0) continue // déjà traité ailleurs

      const rows = echeances.map(d => ({
        envelope_id: env.id,
        amount: montant,
        type: 'savings_add',
        note: 'Versement automatique',
        created_at: d.toISOString(),
      }))
      const { error: eIns } = await supabase.from('movements').insert(rows)
      if (eIns) throw new Error(eIns.message)

      comptes++
      versements += rows.length
    } catch (err) {
      erreurs.push({ envelope: env.id, message: err.message })
    }
  }

  console.log(`cron-recurrences: ${versements} versement(s) sur ${comptes} compte(s)`,
    erreurs.length ? erreurs : '')
  return res.json({ ok: true, comptes, versements, erreurs })
}
