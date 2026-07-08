/**
 * src/lib/supabase.js
 * ----------------------------------------------------------------------------
 * Client Supabase unique pour toute l'app.
 * - persistSession : la session reste après fermeture du navigateur (cohérent
 *   avec le brief : « Session persistante »)
 * - autoRefreshToken : Supabase rafraîchit automatiquement le JWT avant
 *   expiration, l'utilisateur ne se fait jamais déconnecter en pleine session.
 * - detectSessionInUrl : nécessaire pour que le callback OAuth fonctionne
 *   (Supabase met le token dans l'URL après le retour de Google).
 *
 * On importe `supabase` depuis ce fichier partout où on en a besoin :
 *   import { supabase } from '@/lib/supabase'
 * (ou avec un chemin relatif si on ne configure pas d'alias plus tard)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Garde-fou si .env.local est mal configuré. On ne throw PAS au chargement
 * du module (ça donnerait un écran blanc sans explication) : main.jsx lit
 * ce flag et affiche un écran d'erreur lisible à la place de l'app.
 */
export const supabaseConfigError = (!supabaseUrl || !supabaseAnonKey)
  ? 'Variables VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY manquantes. ' +
    'Vérifie le fichier .env.local à la racine du projet (ou les variables ' +
    "d'environnement Vercel)."
  : null

if (supabaseConfigError) console.error(supabaseConfigError)

export const supabase = createClient(
  supabaseUrl || 'https://config-manquante.supabase.co',
  supabaseAnonKey || 'config-manquante', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})