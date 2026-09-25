'use client';
import { useEffect, useRef, useState } from 'react';
import { drawSprite, spriteSize, type Tint } from '@omni/sprites';

// A sprite as a DOM element, for panels and cards. `scale` is in CSS pixels per sprite pixel;
// `animate` plays the two idle frames.
export function Sprite({ name, scale = 1, tint, flip, animate, className, title }: {
  name: string; scale?: number; tint?: Tint; flip?: boolean; animate?: boolean; className?: string; title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = spriteSize(name);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setFrame((f) => 1 - f), 420);
    return () => window.clearInterval(id);
  }, [animate]);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, name, 0, 0, { tint, flip, frame });
  }, [name, tint, flip, w, h, frame]);
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
