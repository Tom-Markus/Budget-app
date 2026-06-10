/**
 * MetaballGoo.jsx
 * ----------------------------------------------------------------------------
 * Fond « or liquide » — metaballs 2D raymarchées dans un fragment shader.
 *
 *   - Champ scalaire = somme des contributions de chaque bulle (r²/d²)
 *   - Seuil + normale fausse (gradient du champ) → éclairage spéculaire
 *   - Rampe de couleur or profond → or → reflet chaud
 *   - Positions des bulles calculées sur CPU (dérive sinusoïdale + attraction
 *     curseur) et passées en uniforme : interactivité conservée, coût GPU faible.
 *
 * Chargé en lazy par MetaballFond ; rendu plein écran, derrière tout (z 0).
 * ----------------------------------------------------------------------------
 */
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ScreenQuad } from '@react-three/drei'
import * as THREE from 'three'

const N = 12

// Dérive autonome de chaque bulle (fréquences lentes désynchronisées)
const DEFS = [
  { x0: 0.28, y0: 0.38, fx: 0.18, fy: 0.13, px: 0.0, py: 0.6, r: 0.30 },
  { x0: 0.72, y0: 0.26, fx: 0.14, fy: 0.11, px: 1.4, py: 2.2, r: 0.27 },
  { x0: 0.52, y0: 0.74, fx: 0.11, fy: 0.09, px: 2.7, py: 1.1, r: 0.33 },
  { x0: 0.16, y0: 0.58, fx: 0.16, fy: 0.13, px: 4.0, py: 4.3, r: 0.25 },
  { x0: 0.84, y0: 0.64, fx: 0.09, fy: 0.14, px: 5.2, py: 3.6, r: 0.29 },
  { x0: 0.45, y0: 0.15, fx: 0.13, fy: 0.18, px: 3.1, py: 5.5, r: 0.26 },
  { x0: 0.60, y0: 0.48, fx: 0.12, fy: 0.09, px: 0.8, py: 3.0, r: 0.30 },
  { x0: 0.35, y0: 0.82, fx: 0.15, fy: 0.12, px: 2.0, py: 1.8, r: 0.26 },
  { x0: 0.80, y0: 0.14, fx: 0.08, fy: 0.16, px: 4.8, py: 0.3, r: 0.28 },
  { x0: 0.08, y0: 0.20, fx: 0.12, fy: 0.10, px: 1.9, py: 0.9, r: 0.24 },
  { x0: 0.90, y0: 0.42, fx: 0.10, fy: 0.14, px: 3.6, py: 2.7, r: 0.28 },
  { x0: 0.22, y0: 0.92, fx: 0.11, fy: 0.08, px: 5.8, py: 4.1, r: 0.25 },
]

const VERT = /* glsl */`
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = /* glsl */`
  precision highp float;
  uniform vec2  uRes;
  uniform vec3  uBlobs[${N}];   // x, y (px), r (px)
  uniform float uOpacity;

  void main() {
    vec2 p = gl_FragCoord.xy;
    float field = 0.0;
    vec2  grad  = vec2(0.0);

    for (int i = 0; i < ${N}; i++) {
      vec2  d  = p - uBlobs[i].xy;
      float r  = uBlobs[i].z;
      float d2 = dot(d, d) + 1.0;
      float f  = (r * r) / d2;
      field += f;
      grad  += (-2.0 * r * r / (d2 * d2)) * d;
    }

    float edge = smoothstep(0.55, 1.05, field);
    if (edge <= 0.001) discard;

    // Normale fausse depuis le gradient du champ
    vec3 n = normalize(vec3(grad * 4.0, 1.0));
    vec3 lightDir = normalize(vec3(0.35, 0.55, 1.0));
    float diff = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-lightDir, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 22.0);

    vec3 deep = vec3(0.40, 0.29, 0.10);
    vec3 gold = vec3(0.72, 0.58, 0.29);
    vec3 hi   = vec3(1.00, 0.92, 0.66);
    vec3 col  = mix(deep, gold, diff) + hi * spec * 0.85;

    gl_FragColor = vec4(col, edge * uOpacity);
  }
`

function Goo({ opacity }) {
  const matRef = useRef()
  const { size } = useThree()

  const stateRef = useRef(DEFS.map(b => ({ ...b, x: 0, y: 0 })))
  const mouse = useRef({ x: -1, y: -1, active: false })
  const tRef = useRef(0)

  const uniforms = useMemo(() => ({
    uRes: { value: new THREE.Vector2(1, 1) },
    uBlobs: { value: Array.from({ length: N }, () => new THREE.Vector3()) },
    uOpacity: { value: opacity },
  }), [opacity])

  // Suivi curseur (en pixels CSS, origine bas-gauche comme gl_FragCoord)
  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = e.clientX
      mouse.current.y = window.innerHeight - e.clientY
      mouse.current.active = true
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    tRef.current += dt
    const t = tRef.current
    const W = size.width
    const H = size.height
    const minDim = Math.min(W, H)
    const ATTRACT_R = minDim * 0.35

    const arr = uniforms.uBlobs.value
    const state = stateRef.current
    for (let i = 0; i < N; i++) {
      const b = state[i]
      // Dérive autonome
      let tx = (b.x0 + Math.sin(t * b.fx + b.px) * 0.06) * W
      let ty = (b.y0 + Math.cos(t * b.fy + b.py) * 0.06) * H
      // Attraction douce vers le curseur
      if (mouse.current.active) {
        const dx = mouse.current.x - tx
        const dy = mouse.current.y - ty
        const dist = Math.hypot(dx, dy)
        if (dist > 1 && dist < ATTRACT_R) {
          const k = (1 - dist / ATTRACT_R) ** 2 * 0.4
          tx += dx * k
          ty += dy * k
        }
      }
      // Lissage (inertie)
      b.x += (tx - (b.x || tx)) * Math.min(1, dt * 3)
      b.y += (ty - (b.y || ty)) * Math.min(1, dt * 3)
      arr[i].set(b.x, b.y, b.r * minDim)
    }

    uniforms.uRes.value.set(W, H)
    if (matRef.current) matRef.current.uniformsNeedUpdate = true
  })

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={matRef}
        transparent
        depthTest={false}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </ScreenQuad>
  )
}

export default function MetaballGoo({ opacity = 0.32 }) {
  return (
    <Canvas
      dpr={1}              /* fond flou : pas besoin de retina, moitié du coût GPU */
      gl={{ antialias: false, alpha: true }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <Goo opacity={opacity} />
    </Canvas>
  )
}
