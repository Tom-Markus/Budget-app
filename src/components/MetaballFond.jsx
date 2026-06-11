/**
 * MetaballFond.jsx
 * ----------------------------------------------------------------------------
 * Fond lava-lamp interactif — framerate indépendant (timestamp RAF).
 *
 * Physique :
 *   - Force sinusoïdale lente par blob (trajectoire autonome)
 *   - Attraction souris locale (rayon 260 px, décroissance quadratique)
 *   - Attraction inter-bulles (rayon 380 px) → les bulles se "cherchent"
 *     et fusionnent visuellement quand elles se rapprochent
 *
 * Esthétique « or liquide » :
 *   - 4 tons d'or (champagne → or → or profond → bronze) assignés par taille :
 *     les grandes bulles sont sombres (fond), les petites claires (lumière)
 *   - Reflet radial décentré (38% 30%) + cœur clair → base chaude avant éclairage
 *   - Respiration lente par bulle (scale ±5%, phases décalées)
 *   - Thème clair : mix-blend multiply → encre dorée imprimée sur le vélin
 *     Thème sombre : mix-blend screen  → l'or luit sur la nuit
 *   - Vignette douce au centre (mask) pour préserver la lisibilité du contenu
 *   - prefers-reduced-motion : composition statique, aucune animation
 *
 * Filtre SVG « métal en fusion » :
 *   1. feGaussianBlur σ=18 + feColorMatrix seuil α≈0.36 → goo (fusion)
 *   2. L'alpha flouté (pré-seuil) sert de bump map → relief bombé des bulles
 *   3. feDiffuseLighting (distant, haut-gauche) × goo → ombrage 3D des bords
 *   4. feSpecularLighting large (distant) → lustre directionnel du métal
 *   5. feSpecularLighting net (fePointLight) → glint qui balaie lentement
 *      l'écran en autonomie (Lissajous ~1 min — jamais lié au curseur,
 *      le suivi souris testé puis retiré : trop perturbant)
 *   En thème clair (multiply), les glints « percent » l'encre dorée jusqu'au
 *   vélin ; en thème sombre (screen), ils brillent comme du métal chauffé.
 * Fix Safari : `filter` sur div interne, `position:fixed` sur div externe.
 * ----------------------------------------------------------------------------
 */
import { useEffect, useRef } from 'react';

// Détection tactile — false sur desktop, true sur téléphone/tablette
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

// Gamme tonale — hi = reflet, base = corps, edge = halo de fusion
const TONES = [
  { hi: '#EDD9A3', base: '#D9B873', edge: 'rgba(217,184,115,0.32)' }, // 0 champagne
  { hi: '#D4B16A', base: '#B8954A', edge: 'rgba(184,149,74,0.32)'  }, // 1 or
  { hi: '#C2A055', base: '#9A7A38', edge: 'rgba(154,122,56,0.30)'  }, // 2 or profond
  { hi: '#A98A42', base: '#8E6F2F', edge: 'rgba(142,111,47,0.28)'  }, // 3 bronze
];

// tone : grandes bulles = tons profonds (arrière-plan), petites = champagne (lumière)
// brF/brP : fréquence + phase de respiration (période ~20-35 s)
const BLOB_DEFS = [
  { size: 380, tone: 2, x0: 0.28, y0: 0.38, freqX: 0.000898, freqY: 0.000628, phX: 0.0, phY: 0.6,  vx0:  0.4, vy0: -0.2, brF: 0.00022, brP: 0.0 },
  { size: 340, tone: 1, x0: 0.72, y0: 0.26, freqX: 0.000698, freqY: 0.000524, phX: 1.4, phY: 2.2,  vx0: -0.3, vy0:  0.5, brF: 0.00027, brP: 1.1 },
  { size: 420, tone: 3, x0: 0.52, y0: 0.74, freqX: 0.000524, freqY: 0.000419, phX: 2.7, phY: 1.1,  vx0:  0.2, vy0: -0.4, brF: 0.00018, brP: 2.3 },
  { size: 310, tone: 0, x0: 0.16, y0: 0.58, freqX: 0.000785, freqY: 0.000628, phX: 4.0, phY: 4.3,  vx0:  0.5, vy0:  0.3, brF: 0.00031, brP: 3.4 },
  { size: 360, tone: 2, x0: 0.84, y0: 0.64, freqX: 0.000449, freqY: 0.000698, phX: 5.2, phY: 3.6,  vx0: -0.4, vy0: -0.3, brF: 0.00024, brP: 4.6 },
  { size: 330, tone: 1, x0: 0.45, y0: 0.15, freqX: 0.000628, freqY: 0.000898, phX: 3.1, phY: 5.5,  vx0:  0.3, vy0:  0.6, brF: 0.00029, brP: 5.7 },
  { size: 370, tone: 2, x0: 0.60, y0: 0.48, freqX: 0.000571, freqY: 0.000449, phX: 0.8, phY: 3.0,  vx0: -0.2, vy0:  0.4, brF: 0.00021, brP: 0.9 },
  { size: 320, tone: 0, x0: 0.35, y0: 0.82, freqX: 0.000726, freqY: 0.000571, phX: 2.0, phY: 1.8,  vx0:  0.4, vy0: -0.5, brF: 0.00030, brP: 2.0 },
  { size: 350, tone: 1, x0: 0.80, y0: 0.14, freqX: 0.000419, freqY: 0.000785, phX: 4.8, phY: 0.3,  vx0: -0.5, vy0:  0.2, brF: 0.00025, brP: 3.1 },
  { size: 300, tone: 0, x0: 0.08, y0: 0.20, freqX: 0.000612, freqY: 0.000502, phX: 1.9, phY: 0.9,  vx0:  0.3, vy0:  0.4, brF: 0.00032, brP: 4.2 },
  { size: 345, tone: 1, x0: 0.90, y0: 0.42, freqX: 0.000480, freqY: 0.000660, phX: 3.6, phY: 2.7,  vx0: -0.2, vy0: -0.4, brF: 0.00026, brP: 5.3 },
  { size: 315, tone: 0, x0: 0.22, y0: 0.92, freqX: 0.000550, freqY: 0.000380, phX: 5.8, phY: 4.1,  vx0:  0.5, vy0: -0.3, brF: 0.00028, brP: 0.4 },
  { size: 390, tone: 3, x0: 0.68, y0: 0.88, freqX: 0.000730, freqY: 0.000590, phX: 2.4, phY: 6.1,  vx0: -0.3, vy0:  0.3, brF: 0.00019, brP: 1.6 },
];

const DRIFT            = 0.044; // amplitude force sinusoïdale
const DAMPING          = 0.992; // viscosité globale
const MAX_SPD          = 1.1;   // vitesse plafond (px/frame à 60fps)
const ATTRACT_R        = 260;   // rayon attraction souris (px)
const ATTRACT_STR      = 0.62;  // force attraction souris
const BLOB_ATTRACT_R   = 380;   // rayon attraction inter-bulles (px)
const BLOB_ATTRACT_STR = 0.012; // force attraction entre bulles
const BOUNDARY_PUSH    = 0.07;  // rebond bords
const BREATH_AMP       = 0.05;  // amplitude respiration (scale ±5%)
const LIGHT_Z          = 300;   // hauteur de la lumière ponctuelle (px) — taille du glint

// Sur mobile : 6 blobs, filtre simplifié, throttle 50ms ; desktop : complet
const ACTIVE_BLOB_DEFS = isTouchDevice ? BLOB_DEFS.slice(0, 6) : BLOB_DEFS;
const FRAME_BUDGET     = isTouchDevice ? 50 : 30; // ms entre frames
const BLUR_SIGMA       = isTouchDevice ? 12 : 18; // stdDeviation feGaussianBlur

// Vignette : bulles atténuées au centre (zone de contenu), pleines en périphérie
const VIGNETTE_MASK =
  'radial-gradient(ellipse 140% 110% at 50% 38%, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.85) 45%, #000 78%)';

// Halos d'ambiance statiques (hors filtre goo) — profondeur atmosphérique
const AMBIENT_BG = `
  radial-gradient(900px 600px at 12% 8%, rgba(212,177,106,0.10), transparent 70%),
  radial-gradient(1000px 700px at 88% 92%, rgba(142,111,47,0.10), transparent 70%)
`;

export default function MetaballFond() {
  const wrapRef  = useRef(null);
  const innerRef = useRef(null);
  const isMouseDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  // Toujours hors écran au départ : l'attraction ne commence qu'après le 1er vrai mouvement souris
  const mouseRef   = useRef({ x: -10, y: -10 });
  const lightRef   = useRef(null);  // fePointLight du glint spéculaire
  const blobEls    = useRef([]);
  const stateRef   = useRef(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    let width  = window.innerWidth;
    let height = window.innerHeight;

    ACTIVE_BLOB_DEFS.forEach((b) => {
      const tone = TONES[b.tone];
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: ${b.size}px;
        height: ${b.size}px;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 30%,
          ${tone.hi} 0%,
          ${tone.base} 42%,
          ${tone.edge} 58%,
          transparent 72%
        );
        will-change: transform;
      `;
      inner.appendChild(el);
      blobEls.current.push(el);
    });

    stateRef.current = ACTIVE_BLOB_DEFS.map((b) => ({
      ...b,
      x:  b.x0 * width,
      y:  b.y0 * height,
      vx: b.vx0,
      vy: b.vy0,
    }));

    // Accessibilité : composition statique élégante, aucune boucle d'animation
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      stateRef.current.forEach((s, i) => {
        const el = blobEls.current[i];
        if (el) el.style.transform = `translate(${s.x - s.size * 0.5}px, ${s.y - s.size * 0.5}px)`;
      });
      // Lumière fixe, alignée sur le reflet des dégradés (38% 30%)
      if (lightRef.current) {
        lightRef.current.setAttribute('x', (width * 0.38).toFixed(1));
        lightRef.current.setAttribute('y', (height * 0.30).toFixed(1));
      }
      return () => {
        blobEls.current.forEach((el) => el.remove());
        blobEls.current  = [];
        stateRef.current = null;
      };
    }

    let t      = 0;
    let lastTs = 0;
    let rafId;

    // Matrice de distances pré-allouée (réutilisée chaque frame, zéro GC)
    const BLOB_N = ACTIVE_BLOB_DEFS.length;
    const dist2  = new Float32Array(BLOB_N * BLOB_N);

    // isMouseDevice est déjà déclaré au niveau du composant, on la récupère via la closure
    const localIsMouseDevice = isMouseDevice;

    const onMouseMove = (e) => {
      mouseRef.current.x = e.clientX / width;
      mouseRef.current.y = e.clientY / height;
    };
    const onResize = () => {
      width  = window.innerWidth;
      height = window.innerHeight;
    };

    if (localIsMouseDevice) {
      window.addEventListener('pointermove', onMouseMove, { passive: true });
    }
    window.addEventListener('resize', onResize, { passive: true });

    function tick(ts) {
      rafId = requestAnimationFrame(tick);
      if (lastTs && ts - lastTs < FRAME_BUDGET) return;
      const dt  = lastTs ? Math.min(ts - lastTs, 50) : 16;
      lastTs    = ts;
      const dtN = dt / 16;
      t        += dt;

      const mx   = mouseRef.current.x * width;
      const my   = mouseRef.current.y * height;
      const damp = Math.pow(DAMPING, dtN);
      const blobs = stateRef.current;

      // Glint spéculaire : balayage lent autonome (desktop uniquement)
      if (!isTouchDevice) {
        const light = lightRef.current;
        if (light) {
          const lx = width  * (0.50 + 0.34 * Math.sin(t * 0.00011));
          const ly = height * (0.32 + 0.20 * Math.cos(t * 0.000085));
          light.setAttribute('x', lx.toFixed(1));
          light.setAttribute('y', ly.toFixed(1));
        }
      }

      // Pré-calcul des distances (moitié haute, symétrie, zéro alloc)
      for (let i = 0; i < BLOB_N; i++) {
        for (let j = i + 1; j < BLOB_N; j++) {
          const d = Math.hypot(blobs[j].x - blobs[i].x, blobs[j].y - blobs[i].y);
          dist2[i * BLOB_N + j] = d;
          dist2[j * BLOB_N + i] = d;
        }
      }

      blobs.forEach((s, i) => {
        const el = blobEls.current[i];
        if (!el) return;

        // --- Attraction souris (uniquement sur desktop) ---
        let mfx = 0, mfy = 0, extraDamp = 0;

        // Drift autonome : base sans atténuation (on l'atténue seulement si souris + en zone)
        let driftScale = 1;

        if (localIsMouseDevice) {
          const dx     = mx - s.x;
          const dy     = my - s.y;
          const dist   = Math.hypot(dx, dy);
          const inZone = dist > 1 && dist < ATTRACT_R;

          // Drift autonome : s'atténue près du curseur pour éviter le tremblement
          driftScale = inZone ? dist / ATTRACT_R : 1;

          if (inZone) {
            const ratio = 1 - dist / ATTRACT_R;
            const force = ratio * ratio * ATTRACT_STR;
            mfx       = (dx / dist) * force;
            mfy       = (dy / dist) * force;
            extraDamp = ratio * 0.35;
          }
        }

        const fx = Math.sin(t * s.freqX + s.phX) * DRIFT * driftScale;
        const fy = Math.cos(t * s.freqY + s.phY) * DRIFT * driftScale;

        // --- Attraction inter-bulles (3 voisins les plus proches) ---
        // Trouve les 3 indices avec la distance minimale (O(n) scan, pas de sort)
        let bfx = 0, bfy = 0;
        const row = i * BLOB_N;
        let top1 = -1, top2 = -1, top3 = -1;
        let d1 = Infinity, d2 = Infinity, d3 = Infinity;
        for (let j = 0; j < BLOB_N; j++) {
          if (j === i) continue;
          const d = dist2[row + j];
          if (d < d1) { d3 = d2; top3 = top2; d2 = d1; top2 = top1; d1 = d; top1 = j; }
          else if (d < d2) { d3 = d2; top3 = top2; d2 = d; top2 = j; }
          else if (d < d3) { d3 = d; top3 = j; }
        }
        for (const j of [top1, top2, top3]) {
          if (j < 0) continue;
          const bdist = dist2[row + j];
          if (bdist > 1 && bdist < BLOB_ATTRACT_R) {
            const other = blobs[j];
            const ratio = 1 - bdist / BLOB_ATTRACT_R;
            const force = ratio * ratio * BLOB_ATTRACT_STR;
            bfx += ((other.x - s.x) / bdist) * force;
            bfy += ((other.y - s.y) / bdist) * force;
          }
        }

        // --- Intégration vitesse + position ---
        s.vx = s.vx * damp * (1 - extraDamp) + (fx + mfx + bfx) * dtN;
        s.vy = s.vy * damp * (1 - extraDamp) + (fy + mfy + bfy) * dtN;

        const spd = Math.hypot(s.vx, s.vy);
        if (spd > MAX_SPD) { s.vx = s.vx / spd * MAX_SPD; s.vy = s.vy / spd * MAX_SPD; }

        s.x += s.vx * dtN;
        s.y += s.vy * dtN;

        // --- Rebond souple sur les bords ---
        const mg = s.size * 0.22;
        if (s.x < mg && s.vx < 0)
          s.vx += BOUNDARY_PUSH * (1 - s.x / mg) * dtN;
        if (s.x > width - mg && s.vx > 0)
          s.vx -= BOUNDARY_PUSH * (1 - (width - s.x) / mg) * dtN;
        if (s.y < mg && s.vy < 0)
          s.vy += BOUNDARY_PUSH * (1 - s.y / mg) * dtN;
        if (s.y > height - mg && s.vy > 0)
          s.vy -= BOUNDARY_PUSH * (1 - (height - s.y) / mg) * dtN;

        // --- Respiration organique (scale autour du centre de la bulle) ---
        const breath = 1 + Math.sin(t * s.brF + s.brP) * BREATH_AMP;
        el.style.transform =
          `translate(${s.x - s.size * 0.5}px, ${s.y - s.size * 0.5}px) scale(${breath})`;
      });
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (localIsMouseDevice) {
        window.removeEventListener('pointermove', onMouseMove);
      }
      window.removeEventListener('resize', onResize);
      blobEls.current.forEach((el) => el.remove());
      blobEls.current  = [];
      stateRef.current = null;
    };
  }, []);

  return (
    <>
      {/*
        Blend adaptatif au thème :
        - clair  : multiply → l'or s'imprègne du vélin et de son grain (encre dorée)
        - sombre : screen   → l'or devient lumière sur la nuit
        Fallback : si le blend est isolé par le navigateur, rendu normal ≈ ancien visuel.
      */}
      <style>{`
        .metaball-fond { mix-blend-mode: multiply; }
        [data-theme="dark"] .metaball-fond { mix-blend-mode: screen; }
        .metaball-fond-inner { opacity: 0.42; }
        [data-theme="dark"] .metaball-fond-inner { opacity: 0.50; }
      `}</style>

      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          {/*
            Région réduite : 10% de débordement suffit pour l'effet goo (blur σ≤18 → ~54px,
            10% de 1920px = 192px). Précédemment à 50%, on traitait 4× l'écran inutilement.
          */}
          <filter
            id="metaball-fond"
            colorInterpolationFilters="sRGB"
            x="-10%" y="-10%" width="120%" height="120%"
          >
            {/* 1. Goo — fusion des bulles */}
            <feGaussianBlur in="SourceGraphic" stdDeviation={BLUR_SIGMA} result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
              result="goo"
            />

            {/* 2-4. Éclairage 3D — desktop uniquement (trop coûteux sur mobile) */}
            {!isTouchDevice && (<>
              <feDiffuseLighting
                in="blur"
                surfaceScale="6"
                diffuseConstant="1.18"
                lightingColor="#FFF4DC"
                result="diffuse"
              >
                <feDistantLight azimuth="225" elevation="55" />
              </feDiffuseLighting>
              <feComposite
                in="diffuse" in2="goo"
                operator="arithmetic" k1="1" k2="0" k3="0" k4="0"
                result="lit"
              />
              <feSpecularLighting
                in="blur"
                surfaceScale="6"
                specularConstant="0.85"
                specularExponent="55"
                lightingColor="#FFF7DD"
                result="glint"
              >
                <fePointLight ref={lightRef} x="-9999" y="-9999" z={LIGHT_Z} />
              </feSpecularLighting>
              <feComposite in="glint" in2="goo" operator="in" result="glintClip" />
              <feComposite
                in="glintClip" in2="lit"
                operator="arithmetic" k1="0" k2="1" k3="1" k4="0"
                result="metal"
              />
              <feColorMatrix in="metal" type="saturate" values="1.55" />
            </>)}

            {/* Mobile : juste le goo + saturation */}
            {isTouchDevice && (
              <feColorMatrix in="goo" type="saturate" values="1.55" />
            )}
          </filter>
        </defs>
      </svg>

      <div
        ref={wrapRef}
        aria-hidden="true"
        className="metaball-fond"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          WebkitMaskImage: VIGNETTE_MASK,
          maskImage: VIGNETTE_MASK,
        }}
      >
        {/* Halos d'ambiance — nappes statiques très douces, hors filtre goo */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, background: AMBIENT_BG }}
        />
        <div
          ref={innerRef}
          className="metaball-fond-inner"
          style={{ position: 'absolute', inset: 0, filter: 'url(#metaball-fond)' }}
        />
      </div>
    </>
  );
}
