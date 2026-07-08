/**
 * CurseurDore.jsx
 * Le point doré est défini dans globals.css via cursor: url(SVG) — rendu OS,
 * synchronisation parfaite. Ce composant gère uniquement l'anneau trailing
 * (spring Framer Motion) qui suit avec un décalage volontaire.
 */
import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CurseurDore() {
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);

  const ringX         = useSpring(mx,            { stiffness: 140, damping: 22, mass: 0.8 });
  const ringY         = useSpring(my,            { stiffness: 140, damping: 22, mass: 0.8 });
  const ringSizeMv    = useMotionValue(36);
  const ringSize      = useSpring(ringSizeMv,    { stiffness: 250, damping: 28 });
  const ringOpacityMv = useMotionValue(0);
  const ringOpacity   = useSpring(ringOpacityMv, { stiffness: 120, damping: 20 });

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const onMove = (e) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      ringOpacityMv.set(1);
    };

    let lastOverTarget = null;
    const onOver = (e) => {
      if (e.target === lastOverTarget) return;
      lastOverTarget = e.target;
      const ptr = !!e.target.closest('button,a,input,textarea,select,[role="button"],[tabindex]');
      ringSizeMv.set(ptr ? 48 : 36);
    };

    const onLeave = () => { lastOverTarget = null; ringOpacityMv.set(0); };
    const onEnter = () => ringOpacityMv.set(1);

    window.addEventListener('mousemove',  onMove,  { passive: true });
    window.addEventListener('mouseover',  onOver,  { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      window.removeEventListener('mousemove',  onMove);
      window.removeEventListener('mouseover',  onOver);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
    // Les MotionValues sont stables entre rendus : les inclure ne relance
    // jamais l'effet mais satisfait la règle exhaustive-deps.
  }, [mx, my, ringOpacityMv, ringSizeMv]);

  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null;
  }

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position:      'fixed',
        top: 0, left: 0,
        x:             ringX,
        y:             ringY,
        translateX:    '-50%',
        translateY:    '-50%',
        width:         ringSize,
        height:        ringSize,
        borderRadius:  '50%',
        border:        '1.5px solid rgba(184,149,74,0.55)',
        pointerEvents: 'none',
        zIndex:        99999,
        opacity:       ringOpacity,
      }}
    />
  );
}
