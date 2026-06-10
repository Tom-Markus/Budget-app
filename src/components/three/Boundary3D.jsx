/**
 * Boundary3D.jsx
 * ----------------------------------------------------------------------------
 * Error boundary dédié au rendu 3D / WebGL. Si un canvas Three.js échoue au
 * runtime (compilation shader, contexte WebGL perdu, etc.), on affiche le
 * `fallback` fourni plutôt que de laisser l'erreur remonter et casser l'app.
 * ----------------------------------------------------------------------------
 */
import { Component } from 'react'

export default class Boundary3D extends Component {
  state = { dead: false }

  static getDerivedStateFromError() {
    return { dead: true }
  }

  componentDidCatch(err) {
    if (import.meta.env?.DEV) console.warn('[Boundary3D] rendu 3D désactivé :', err)
  }

  render() {
    if (this.state.dead) return this.props.fallback ?? null
    return this.props.children
  }
}
