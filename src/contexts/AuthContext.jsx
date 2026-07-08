/**
 * src/contexts/AuthContext.jsx
 * ----------------------------------------------------------------------------
 * Contexte d'authentification.
 *
 * Gère l'état de session de l'utilisateur, écoute les changements d'auth
 * (login, logout, refresh token), et expose les actions login/logout.
 *
 * États possibles :
 *   - loading: true              → au démarrage, on vérifie la session existante
 *   - loading: false, user: null → pas de session, on affichera EcranConnexion
 *   - loading: false, user: {…}  → connecté, on affichera l'app
 * ----------------------------------------------------------------------------
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../hooks/useAuth'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)

  // Au montage : récupère la session existante (si l'utilisateur revient sur
  // l'app après avoir fermé son navigateur) ET installe un écouteur global
  // qui se déclenche à chaque changement d'auth (login, logout, refresh).
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) console.error('Erreur récupération session :', error)
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        if (newSession) setLoginError(null)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Lance le flow OAuth Google.
   * Supabase redirige vers Google, Google revient à Supabase, Supabase
   * revient à `redirectTo`. L'écouteur onAuthStateChange ci-dessus se
   * déclenchera tout seul quand on rentrera au bercail avec la session.
   */
  const login = useCallback(async () => {
    setLoginLoading(true)
    setLoginError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // window.location.origin = l'URL actuelle de l'app, sans le path.
          // Marche aussi bien en Codespaces qu'en prod sur Vercel.
          redirectTo: window.location.origin + '/',
        },
      })
      if (error) throw error
      // Si on arrive ici, la redirection vers Google est en cours.
      // Le composant va se démonter, pas la peine de toucher au loading.
    } catch (err) {
      console.error('Erreur login :', err)
      setLoginError(err.message || 'Connexion impossible. Réessaye.')
      setLoginLoading(false)
    }
  }, [])

  /**
   * Déconnexion. Vide la session côté Supabase et le localStorage.
   * onAuthStateChange remettra session à null → AuthGate renverra à EcranConnexion.
   */
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Erreur logout :', error)
      throw error
    }
  }, [])

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    loginLoading,
    loginError,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}