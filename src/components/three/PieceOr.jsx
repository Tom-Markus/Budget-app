/**
 * PieceOr.jsx
 * ----------------------------------------------------------------------------
 * Souverain d'or 3D — pièce de l'écran de connexion.
 *
 *   - Cylindre fin, matière or PBR (metalness 1) + environnement procédural
 *     (Lightformers, aucun HDR externe → robuste hors-ligne)
 *   - Monogramme « T » + liseré gravés via CanvasTexture utilisée en bumpMap
 *   - Tranche cannelée (reeded edge) façon vraie monnaie
 *   - Rotation lente continue + inclinaison qui suit le curseur
 *   - Bloom doré subtil (postprocessing)
 *
 * Chargé en lazy par EcranConnexion (≈160 ko Three.js hors du bundle app).
 * ----------------------------------------------------------------------------
 */
import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

/* Texture de face (bump) : T orné + double liseré circulaire.
   Clair = relief saillant, gris moyen = niveau zéro. */
function makeFaceTexture() {
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')
  const cx = s / 2
  const cy = s / 2

  ctx.fillStyle = '#7d7d7d'
  ctx.fillRect(0, 0, s, s)

  // Double liseré
  ctx.strokeStyle = '#ededed'
  ctx.lineWidth = 9
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = '#4a4a4a'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.455, 0, Math.PI * 2); ctx.stroke()

  // Monogramme T (EB Garamond italique, déjà chargée par l'app)
  ctx.fillStyle = '#efefef'
  ctx.font = `italic 500 ${s * 0.5}px "EB Garamond", Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('T', cx, cy + s * 0.05)

  // Fioritures latérales
  ctx.fillStyle = '#dcdcdc'
  ctx.beginPath()
  ctx.ellipse(cx - s * 0.27, cy, s * 0.05, s * 0.016, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + s * 0.27, cy, s * 0.05, s * 0.016, 0, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/* Texture de tranche (bump) : cannelures verticales répétées. */
function makeEdgeTexture() {
  const w = 1024
  const h = 32
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h)
  const stripes = 150
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#c8c8c8' : '#505050'
    ctx.fillRect((i / stripes) * w, 0, (w / stripes) * 0.5, h)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

function Coin({ pointer }) {
  const group = useRef()
  const spin = useRef(0)

  const faceTex = useMemo(() => makeFaceTexture(), [])
  const edgeTex = useMemo(() => makeEdgeTexture(), [])

  const matFace = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#caa452', metalness: 1, roughness: 0.42,
    bumpMap: faceTex, bumpScale: 0.14, envMapIntensity: 1.35,
  }), [faceTex])

  const matEdge = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#b8954a', metalness: 1, roughness: 0.42,
    bumpMap: edgeTex, bumpScale: 0.03, envMapIntensity: 1.25,
  }), [edgeTex])

  // Ordre des matériaux d'un cylindre : [tranche, face haut, face bas]
  const materials = useMemo(() => [matEdge, matFace, matFace], [matEdge, matFace])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const d = Math.min(delta, 0.05)
    spin.current += d * 0.5
    // Rotation médaille (axe vertical écran) + parallaxe curseur
    g.rotation.y = spin.current + pointer.current.x * 0.45
    g.rotation.x = 0.12 + pointer.current.y * 0.28
  })

  return (
    <group ref={group}>
      {/* rotation.x = PI/2 : la pièce fait face à la caméra */}
      <mesh material={materials} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2, 2, 0.24, 96, 1]} />
      </mesh>
    </group>
  )
}

export default function PieceOr({ size = 220 }) {
  const pointer = useRef({ x: 0, y: 0 })

  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    pointer.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2
    pointer.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2
  }
  const reset = () => { pointer.current.x = 0; pointer.current.y = 0 }

  return (
    <div
      style={{ width: size, height: size }}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} />
        <Suspense fallback={null}>
          <Coin pointer={pointer} />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.4} position={[0, 2, 4]} scale={[7, 7, 1]} color="#fff4d6" />
            <Lightformer form="rect" intensity={1.4} position={[-4, 1, 2]} scale={[4, 6, 1]} color="#ffd98a" />
            <Lightformer form="rect" intensity={1.0} position={[4, -1, 1]} scale={[3, 4, 1]} color="#ffffff" />
            <Lightformer form="rect" intensity={0.6} position={[0, -3, 2]} scale={[6, 3, 1]} color="#9a7b3a" />
          </Environment>
        </Suspense>
        <EffectComposer>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.25} intensity={0.55} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
