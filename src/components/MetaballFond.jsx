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
 * Filtre SVG : feGaussianBlur σ=18 + feColorMatrix seuil α≈0.36.
 * Fix Safari : `filter` sur div interne, `position:fixed` sur div externe.
 * ----------------------------------------------------------------------------
 */
import { useEffect, useRef } from 'react';

const BLOB_DEFS = [
  { size: 380, x0: 0.28, y0: 0.38, freqX: 0.000898, freqY: 0.000628, phX: 0.0, phY: 0.6,  vx0:  0.4, vy0: -0.2 },
  { size: 340, x0: 0.72, y0: 0.26, freqX: 0.000698, freqY: 0.000524, phX: 1.4, phY: 2.2,  vx0: -0.3, vy0:  0.5 },
  { size: 420, x0: 0.52, y0: 0.74, freqX: 0.000524, freqY: 0.000419, phX: 2.7, phY: 1.1,  vx0:  0.2, vy0: -0.4 },
  { size: 310, x0: 0.16, y0: 0.58, freqX: 0.000785, freqY: 0.000628, phX: 4.0, phY: 4.3,  vx0:  0.5, vy0:  0.3 },
  { size: 360, x0: 0.84, y0: 0.64, freqX: 0.000449, freqY: 0.000698, phX: 5.2, phY: 3.6,  vx0: -0.4, vy0: -0.3 },
  { size: 330, x0: 0.45, y0: 0.15, freqX: 0.000628, freqY: 0.000898, phX: 3.1, phY: 5.5,  vx0:  0.3, vy0:  0.6 },
  { size: 370, x0: 0.60, y0: 0.48, freqX: 0.000571, freqY: 0.000449, phX: 0.8, phY: 3.0,  vx0: -0.2, vy0:  0.4 },
  { size: 320, x0: 0.35, y0: 0.82, freqX: 0.000726, freqY: 0.000571, phX: 2.0, phY: 1.8,  vx0:  0.4, vy0: -0.5 },
  { size: 350, x0: 0.80, y0: 0.14, freqX: 0.000419, freqY: 0.000785, phX: 4.8, phY: 0.3,  vx0: -0.5, vy0:  0.2 },
  { size: 300, x0: 0.08, y0: 0.20, freqX: 0.000612, freqY: 0.000502, phX: 1.9, phY: 0.9,  vx0:  0.3, vy0:  0.4 },
  { size: 345, x0: 0.90, y0: 0.42, freqX: 0.000480, freqY: 0.000660, phX: 3.6, phY: 2.7,  vx0: -0.2, vy0: -0.4 },
  { size: 315, x0: 0.22, y0: 0.92, freqX: 0.000550, freqY: 0.000380, phX: 5.8, phY: 4.1,  vx0:  0.5, vy0: -0.3 },
  { size: 390, x0: 0.68, y0: 0.88, freqX: 0.000730, freqY: 0.000590, phX: 2.4, phY: 6.1,  vx0: -0.3, vy0:  0.3 },
];

const DRIFT            = 0.044; // amplitude force sinusoïdale
const DAMPING          = 0.992; // viscosité globale
const MAX_SPD          = 1.1;   // vitesse plafond (px/frame à 60fps)
const ATTRACT_R        = 260;   // rayon attraction souris (px)
const ATTRACT_STR      = 0.62;  // force attraction souris
const BLOB_ATTRACT_R   = 380;   // rayon attraction inter-bulles (px)
const BLOB_ATTRACT_STR = 0.012; // force attraction entre bulles
const BOUNDARY_PUSH    = 0.07;  // rebond bords

export default function MetaballFond() {
  const wrapRef  = useRef(null);
  const innerRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const blobEls  = useRef([]);
  const stateRef = useRef(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    let width  = window.innerWidth;
    let height = window.innerHeight;

    BLOB_DEFS.forEach((b) => {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute;
        top: 0; left: 0;
        width: ${b.size}px;
        height: ${b.size}px;
        border-radius: 50%;
        background: radial-gradient(circle at center,
          #B8954A 0%,
          #B8954A 36%,
          rgba(184,149,74,0.35) 58%,
          transparent 72%
        );
        will-change: transform;
      `;
      inner.appendChild(el);
      blobEls.current.push(el);
    });

    stateRef.current = BLOB_DEFS.map((b) => ({
      ...b,
      x:  b.x0 * width,
      y:  b.y0 * height,
      vx: b.vx0,
      vy: b.vy0,
    }));

    let t      = 0;
    let lastTs = 0;
    let rafId;

    // Matrice de distances pré-allouée (réutilisée chaque frame, zéro GC)
    const BLOB_N = BLOB_DEFS.length;
    const dist2  = new Float32Array(BLOB_N * BLOB_N);

    const onMouseMove = (e) => {
      mouseRef.current.x = e.clientX / width;
      mouseRef.current.y = e.clientY / height;
    };
    const onResize = () => {
      width  = window.innerWidth;
      height = window.innerHeight;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize',    onResize,    { passive: true });

    function tick(ts) {
      rafId = requestAnimationFrame(tick);
      // Throttle à ~30fps — fond animé, pas besoin de 60fps
      if (lastTs && ts - lastTs < 30) return;
      const dt  = lastTs ? Math.min(ts - lastTs, 50) : 16;
      lastTs    = ts;
      const dtN = dt / 16;
      t        += dt;

      const mx   = mouseRef.current.x * width;
      const my   = mouseRef.current.y * height;
      const damp = Math.pow(DAMPING, dtN);
      const blobs = stateRef.current;

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

        // --- Attraction souris ---
        const dx     = mx - s.x;
        const dy     = my - s.y;
        const dist   = Math.hypot(dx, dy);
        const inZone = dist > 1 && dist < ATTRACT_R;

        // Drift autonome : s'atténue près du curseur pour éviter le tremblement
        const driftScale = inZone ? dist / ATTRACT_R : 1;
        const fx = Math.sin(t * s.freqX + s.phX) * DRIFT * driftScale;
        const fy = Math.cos(t * s.freqY + s.phY) * DRIFT * driftScale;

        let mfx = 0, mfy = 0, extraDamp = 0;
        if (inZone) {
          const ratio = 1 - dist / ATTRACT_R;
          const force = ratio * ratio * ATTRACT_STR;
          mfx       = (dx / dist) * force;
          mfy       = (dy / dist) * force;
          extraDamp = ratio * 0.35;
        }

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

        el.style.transform = `translate(${s.x - s.size * 0.5}px, ${s.y - s.size * 0.5}px)`;
      });
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize',    onResize);
      blobEls.current.forEach((el) => el.remove());
      blobEls.current  = [];
      stateRef.current = null;
    };
  }, []);

  return (
    <>
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <filter
            id="metaball-fond"
            colorInterpolationFilters="sRGB"
            x="-50%" y="-50%" width="200%" height="200%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={wrapRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
      >
        <div
          ref={innerRef}
          style={{ position: 'absolute', inset: 0, filter: 'url(#metaball-fond)', opacity: 0.30 }}
        />
      </div>
    </>
  );
}
