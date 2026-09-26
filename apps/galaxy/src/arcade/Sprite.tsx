'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { drawSprite, spriteSize, type Flat, type Hero, type Tint } from '@omni/sprites';
import { fleet, heroOf } from './fleets';

/** The stripes every sprite in the arcade wears: the theme's `stripe-1` to `stripe-4` (theme.ts). None: the forge's own. */
export const Stripes = createContext<Flat | null>(null);

// A sprite as a DOM element, for panels and cards. `scale` is in CSS pixels per sprite pixel;
// `animate` plays the two idle frames. It wears the arcade's stripes (`Stripes`).
export function Sprite({ name, scale = 1, tint, flip, animate, className, title }: {
  name: string; scale?: number; tint?: Tint; flip?: boolean; animate?: boolean; className?: string; title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = spriteSize(name);
  const [frame, setFrame] = useState(0);
  const flat = useContext(Stripes);
  useEffect(() => {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setFrame((f) => 1 - f), 420);
    return () => window.clearInterval(id);
  }, [animate]);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, name, 0, 0, { tint, flat, flip, frame });
  }, [name, tint, flat, flip, w, h, frame]);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={`sprite ${className ?? ''}`}
      style={{ width: w * scale, height: h * scale }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

/** A fleet's mascot (or its hero stand-in). */
export function FleetSprite({ name, scale = 1, animate, flip }: { name: string | null | undefined; scale?: number; animate?: boolean; flip?: boolean }) {
  const f = fleet(name);
  return <Sprite name={f.sprite} tint={f.tint ?? undefined} scale={scale} animate={animate} flip={flip} />;
}

/** A player's hero in their fleet's colours. */
export function HeroSprite({ hero, team, scale = 1, animate, title }: { hero: Hero; team: string | null | undefined; scale?: number; animate?: boolean; title?: string }) {
  const look = heroOf(hero, team);
  return <Sprite name={look.sprite} tint={look.tint} scale={scale} animate={animate} title={title} />;
}
