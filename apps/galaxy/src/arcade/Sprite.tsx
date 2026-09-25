'use client';
import { useEffect, useRef } from 'react';
import { drawSprite, spriteSize, type Tint } from '@omni/sprites';

// A sprite as a DOM element, for panels and cards. `scale` is in CSS pixels per sprite pixel.
export function Sprite({ name, scale = 2, tint, flip, className, title }: {
  name: string; scale?: number; tint?: Tint; flip?: boolean; className?: string; title?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { w, h } = spriteSize(name);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, name, 0, 0, { tint, flip });
  }, [name, tint, flip, w, h]);
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
