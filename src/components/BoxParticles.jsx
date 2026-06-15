import { useEffect, useState } from 'react';
import { getReducedMotion } from '../lib/theme';

export default function BoxParticles({ x, y, color }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (getReducedMotion()) return;
    const count = 12;
    const list = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 20 + Math.random() * 30; // px burst distance
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rot = (Math.random() * 720) - 360; // deg
      const duration = 500 + Math.random() * 300; // ms
      return { id: i, dx, dy, rot, duration };
    });
    setPieces(list);

    const t = setTimeout(() => setPieces([]), 1000);
    return () => clearTimeout(t);
  }, []);

  if (pieces.length === 0) return null;
  return (
    <g className="box-particles" transform={`translate(${x}, ${y})`} aria-hidden="true" pointerEvents="none">
      {pieces.map(p => (
        <rect
          key={p.id}
          x={-2} y={-2} width={4} height={4}
          fill={color}
          style={{
            animation: `boxParticleBurst ${p.duration}ms ease-out forwards`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rot}deg`,
          }}
        />
      ))}
    </g>
  );
}
