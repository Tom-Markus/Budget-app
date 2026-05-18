/**
 * src/components/Layout.jsx
 * ----------------------------------------------------------------------------
 * Layout principal (affiché uniquement quand l'utilisateur est connecté).
 * Navbar du design system + zone <Outlet/> où React Router injecte la page.
 *
 * Le composant Navbar attend `currentPage` (string) + `onNavigate` (callback).
 * On fait ici le pont avec React Router :
 *   - location.pathname  → currentPage
 *   - navigate(url)      → onNavigate
 * ----------------------------------------------------------------------------
 */
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import Navbar from './Navbar'
import MetaballFond from './MetaballFond'
import CurseurDore from './CurseurDore'

const PAGE_TO_URL = {
  accueil: '/',
  graphes: '/graphes-dettes',
  reglages: '/reglages',
}
const URL_TO_PAGE = Object.fromEntries(
  Object.entries(PAGE_TO_URL).map(([k, v]) => [v, k])
)

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  // Indicateur "hors ligne" basé sur l'API navigator.onLine
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const currentPage = URL_TO_PAGE[location.pathname] ?? 'accueil'

  const handleNavigate = (pageId) => {
    const url = PAGE_TO_URL[pageId]
    if (url) navigate(url)
  }

  // Stable — évite de passer une nouvelle Date à chaque render de Layout
  const today = useMemo(() => new Date(), [])

  return (
    <>
      <MetaballFond />
      <CurseurDore />
      {/* z-index: 1 pour passer devant le fond metaball (z-index: 0) */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isOnline={isOnline}
          currentDate={today}
        />
        {/*
          pb-[calc(60px+env(safe-area-inset-bottom,0px))] : sur mobile, la bottom nav
          fixe de 60px masquerait le bas du contenu sans ce padding compensatoire.
          md:py-10 annule le padding-bottom mobile sur desktop (pas de bottom nav).
        */}
        <main className="container-page pt-6 pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:py-10">
          <Outlet />
        </main>
      </div>
    </>
  )
}