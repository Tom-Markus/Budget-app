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

if (!supabaseUrl || !supabaseAnonKey) {
  // Garde-fou explicite si .env.local est mal configuré.
  // Plutôt qu'un bug bizarre plus loin, on plante tôt avec un message clair.
  throw new Error(
    'Variables VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY manquantes. ' +
    'Vérifie le fichier .env.local à la racine du projet.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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