'use client';
// The poster's planet (PRD 394), HOME's second client component: the planet's labelled box, holding
// the three frames the server drew (poster/art.ts), and, once the browser says motion is allowed, a
// canvas on which the game's own drawPlanet turns the planet while the invasion spreads
// (PosterPlanetSpin.ts). The frames hide only once the canvas has drawn; without JavaScript, and
// under reduced motion, where no canvas is ever mounted, they show as they always did.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { browserClock, PLANET_LABEL, planetMoves, spinPlanet } from './PosterPlanetSpin';

export function PosterPlanet({ size, children }: { size: number; children: ReactNode }) {
  const [moves, setMoves] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMoves(planetMoves(window)); }, []);

  useEffect(() => {
    const ctx = moves ? canvas.current?.getContext('2d') : null;
    if (!ctx) return;
    const stop = spinPlanet(ctx, size, browserClock(), { onFirst: () => { setDrawn(true); } });
    return () => { stop(); setDrawn(false); };
  }, [moves, size]);

  return (
    <div className="home-planet" role="img" aria-label={PLANET_LABEL} data-turning={drawn ? '' : undefined}>
      {children}
      {moves && <canvas ref={canvas} className="home-planet-canvas" width={size} height={size} aria-hidden="true" />}
    </div>
  );
}
