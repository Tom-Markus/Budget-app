import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function GlassFilter() {
  useEffect(() => {
    fetch('https://essykings.github.io/JavaScript/map.png')
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        document.getElementById('glass-navbar-feimage')?.setAttribute('href', url);
      })
      .catch(() => {});
  }, []);

  return createPortal(
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id="glass-navbar"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          primitiveUnits="objectBoundingBox"
        >
          <feImage
            id="glass-navbar-feimage"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            result="map"
          />
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.008" result="blur" />
          <feDisplacementMap
            in="blur"
            in2="map"
            scale="0.35"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>,
    document.body
  );
}
