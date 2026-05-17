/**
 * src/App.jsx — version Bloc D
 * ----------------------------------------------------------------------------
 * Hiérarchie complète :
 *
 *   BrowserRouter
 *   └─ AuthProvider          (session Supabase)
 *      └─ ToastProvider      (notifications globales)
 *         └─ AuthGate         (connexion ou app)
 *            └─ AppProvider   (NOUVEAU : envelopes + mouvements + soldes)
 *               └─ Routes
 *                  └─ Layout (Navbar + Outlet)
 *                     ├─ /                  → Accueil
 *                     ├─ /graphes-dettes    → GraphesEtDettes
 *                     └─ /reglages          → Reglages
 * ----------------------------------------------------------------------------
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppProvider } from './contexts/AppContext'
import AuthGate from './components/AuthGate'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import GraphesEtDettes from './pages/GraphesEtDettes'
import Reglages from './pages/Reglages'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AuthGate>
            <AppProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Accueil />} />
                  <Route path="/graphes-dettes" element={<GraphesEtDettes />} />
                  <Route path="/reglages" element={<Reglages />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </AppProvider>
          </AuthGate>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}