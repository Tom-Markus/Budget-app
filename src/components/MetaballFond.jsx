/**
 * MetaballFond.jsx
 * ----------------------------------------------------------------------------
 * Fond d'ambiance « or liquide ».
 *
 *   - Par défaut : metaballs WebGL (MetaballGoo) chargées en lazy → Three.js
 *     reste dans un chunk séparé, ne bloque pas le premier rendu de l'app.
 *   - Fallback (pas de WebGL, prefers-reduced-motion, ou pendant le chargement) :
 *     un dégradé doré statique, léger et 100 % CSS.
 *
 * Toujours rendu plein écran, fixe, derrière tout le contenu (z-index 0),
 * sans interaction (pointer-events: none).
 * ----------------------------------------------------------------------------
 */
import { lazy, Suspense, useState } from 'react'
import Boundary3D from './three/Boundary3D'

const MetaballGoo = lazy(() => import('./three/MetaballGoo'))

function peutAfficherWebGL() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

/* Dégradé doré statique : fallback + état de chargement. */
function FondStatique() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.28,
        background: `
          radial-gradient(40% 50% at 28% 38%, rgba(184,149,74,0.55), transparent 70%),
          radial-gradient(36% 46% at 74% 64%, rgba(184,149,74,0.45), transparent 70%),
          radial-gradient(30% 40% at 55% 18%, rgba(184,149,74,0.40), transparent 70%)
        `,
      }}
    />
  )
}

export default function MetaballFond() {
  const [webgl] = useState(peutAfficherWebGL)

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {webgl ? (
        <Boundary3D fallback={<FondStatique />}>
          <Suspense fallback={<FondStatique />}>
            <MetaballGoo opacity={0.32} />
          </Suspense>
        </Boundary3D>
      ) : (
        <FondStatique />
      )}
    </div>
  )
}
