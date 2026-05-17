/**
 * src/components/AuthGate.jsx
 * ----------------------------------------------------------------------------
 * "Portail" entre l'écran de connexion et l'app.
 *
 * 3 états :
 *   1. loading        → LoaderNoble (vérification de session en cours)
 *   2. pas connecté   → EcranConnexion
 *   3. connecté       → children (l'app, avec Navbar et pages)
 * ----------------------------------------------------------------------------
 */
import { useAuth } from '../hooks/useAuth'
import EcranConnexion from './EcranConnexion'
import { LoaderNoble } from './Toast'

export default function AuthGate({ children }) {
  const { user, loading, loginLoading, loginError, login } = useAuth()

  if (loading) {
    return <LoaderNoble message="Ouverture du cabinet..." />
  }

  if (!user) {
    return (
      <EcranConnexion
        onLogin={login}
        loading={loginLoading}
        error={loginError}
      />
    )
  }

  return children
}