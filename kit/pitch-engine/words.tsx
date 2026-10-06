// The words of a scene (PRD 1108 s4): a title built word by word in the Heading font, and the eyebrow,
// lines, pills and bullets in the Text font, each arriving on a spring and leaving with its scene.
import type { CSSProperties, ReactNode } from 'react';
import { EASINGS, SPRINGS, interpolate, spring } from './animation.ts';
import { useEngine, useEnter, useEntryFrame, useExit } from './core.tsx';
import { alpha } from './palette.ts';
import { titleWords, wordState } from './text.ts';

/** How everything leaves with its scene: it softens, lifts and fades. */
export function useExitStyle(): CSSProperties {
  const exit = useExit();
  if (exit === 0) return {};
  return { opacity: 1 - exit, filter: `blur(${exit * 10}px)`, transform: `translateY(${-exit * 24}px)` };
}

type Align = 'left' | 'center';

/** A title, built word by word: each word rises from blurred to sharp, a stagger after the one before. */
export function Title({ text, size, delay, align = 'left', maxWidth }: { text: string; size: number; delay: number; align?: Align; maxWidth: number }): ReactNode {
  const { palette, fonts, timeline } = useEngine();
  const frame = useEntryFrame();
  const exit = useExitStyle();
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: fonts.heading.stack,
        fontWeight: fonts.heading.weight,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: '-0.02em',
        color: palette.ink,
        maxWidth,
        textAlign: align,
        textWrap: 'balance',
        ...exit,
      }}
    >
      {titleWords(text).map((word, index, all) => {
        const state = wordState(frame, index, timeline.fps, { delay });
        const style: CSSProperties = {
          display: 'inline-block',
          whiteSpace: 'nowrap',
          opacity: state.opacity,
          transform: `translateY(${state.rise}em)`,
          filter: state.blur > 0 ? `blur(${state.blur}px)` : 'none',
        };
        return (
          <span key={index}>
            <span style={style}>{word}</span>
            {index < all.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </h1>
  );
}

/** The small line above a title: the Text font, upper case, in the accent, sliding in from the left. */
export function Eyebrow({ text, delay }: { text: string; delay: number }): ReactNode {
  const { palette, fonts } = useEngine();
  const p = useEnter(delay);
  return (
    <div
      style={{
        fontFamily: fonts.text.stack,
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: palette.accent,
        opacity: p,
        transform: `translateX(${(1 - p) * -24}px)`,
        ...useExitStyle(),
      }}
    >
      {text}
    </div>
  );
}

/** A line of reading text in the Text font, arriving as one block after its title. */
export function Line({ text, delay, size = 36, align = 'left', maxWidth, muted = true }: { text: string; delay: number; size?: number; align?: Align; maxWidth: number; muted?: boolean }): ReactNode {
  const { palette, fonts } = useEngine();
  const p = useEnter(delay);
  return (
    <p
      style={{
        margin: 0,
        fontFamily: fonts.text.stack,
        fontWeight: fonts.text.weight,
        fontSize: size,
        lineHeight: 1.3,
        color: muted ? palette.muted : palette.ink,
        maxWidth,
        textAlign: align,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        filter: p < 0.99 ? `blur(${(1 - p) * 6}px)` : 'none',
        ...useExitStyle(),
      }}
    >
      {text}
    </p>
  );
}

export type PillTone = 'outline' | 'accent' | 'cta';

/** The colours of a pill of each tone. */
function usePillColours(tone: PillTone): CSSProperties {
  const { palette } = useEngine();
  if (tone === 'cta') return { background: palette.cta, color: palette.onCta };
  if (tone === 'accent') return { background: palette.accent, color: palette.onAccent };
  return { border: `2px solid ${palette.hairline}`, color: palette.ink };
}

/** A rounded label in the Text font: a tag, a before or after marker, the call to action. */
export function Pill({ text, delay, tone = 'outline', size = 24, glow = 0 }: { text: string; delay: number; tone?: PillTone; size?: number; glow?: number }): ReactNode {
  const { fonts, palette } = useEngine();
  const p = useEnter(delay, SPRINGS.snappy);
  const ring = glow > 0 ? { boxShadow: `0 0 0 ${6 + glow * 8}px ${alpha(tone === 'cta' ? palette.cta : palette.accent, 0.22 - glow * 0.12)}` } : {};
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `${size * 0.5}px ${size}px`,
        borderRadius: 999,
        fontFamily: fonts.text.stack,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '0.04em',
        opacity: p,
        transform: `scale(${interpolate(p, [0, 1], [0.85, 1], { easing: EASINGS.out })})`,
        transformOrigin: 'left center',
        ...usePillColours(tone),
        ...ring,
        ...useExitStyle(),
      }}
    >
      {text}
    </div>
  );
}

const BULLET_STAGGER = 0.18;

/** A feature's bullets: a tick in the accent and a line of the Text font each, one after the other. */
export function Bullets({ items, delay }: { items: readonly string[]; delay: number }): ReactNode {
  const { palette, fonts, timeline } = useEngine();
  const frame = useEntryFrame();
  const exit = useExitStyle();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8, ...exit }}>
      {items.map((item, index) => {
        const p = spring(frame - (delay + index * BULLET_STAGGER) * timeline.fps, timeline.fps, SPRINGS.smooth);
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ flex: 'none' }}>
              <circle cx="16" cy="16" r="16" fill={alpha(palette.accent, 0.16)} />
              <path d="M10 16.5l4 4 8-9" stroke={palette.accent} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: fonts.text.stack, fontWeight: fonts.text.weight, fontSize: 32, lineHeight: 1.25, color: palette.ink }}>{item}</span>
          </div>
        );
      })}
    </div>
  );
}
