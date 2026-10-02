'use client';
// SELECT YOUR APP (PRD 932, s3): the character select a click on SIGN UP WITH GITHUB opens, before
// the GitHub sign-in starts. Controls mounts it in the browser only, so HOME's server markup never
// carries it. Its state is the reducer in state.ts; this component draws it, keeps the focus inside
// the dialog (the two pedestals and the toggle), and hands the effect a step returns to Controls:
// go with a pick, saving it first when REMEMBER MY CHOICE is on, or close. Its styles are in
// selector.css; reduced motion stills the cursor, the cabinet and every entrance.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { AppPick } from '../sign-up';
import { cabinetSvgs, codeMarkSvg } from './art';
import { PEDESTALS, STAT_CELLS } from './look';
import { APPS, openSelector, step, type SelectorAction, type SelectorEffect } from './state';
import './selector.css';

export interface SelectorProps {
  /** Starts the sign-in with the pick; `save` when REMEMBER MY CHOICE was on. */
  onGo: (pick: AppPick, save: boolean) => void;
  /** Closes the overlay without signing in. */
  onClose: () => void;
}

const Svg = ({ svg }: { svg: string }) => <span dangerouslySetInnerHTML={{ __html: svg }} />;

export function Selector({ onGo, onClose }: SelectorProps) {
  const [state, setState] = useState(openSelector);
  const [chosen, setChosen] = useState<AppPick | null>(null);
  const slots = useRef<Partial<Record<AppPick, HTMLButtonElement | null>>>({});
  const toggle = useRef<HTMLButtonElement | null>(null);
  const art = useMemo(() => ({ app: codeMarkSvg(), arcade: cabinetSvgs() }), []);

  // The cursor starts on OMNI APP, and so does the focus: Enter alone opens the board.
  useEffect(() => { slots.current[APPS[0]]?.focus(); }, []);

  const carryOut = (effect: SelectorEffect | null) => {
    if (!effect) return;
    if (effect.type === 'close') { onClose(); return; }
    setChosen(effect.pick);
    onGo(effect.pick, effect.save);
  };

  const apply = (action: SelectorAction) => {
    if (chosen) return state;
    const next = step(state, action);
    setState(next.state);
    carryOut(next.effect);
    return next.state;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // The overlay owns the keyboard while it is open: nothing reaches HOME's PRESS START keys.
    e.stopPropagation();
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const order = [...APPS.map((pick) => slots.current[pick]), toggle.current].filter((el): el is HTMLButtonElement => Boolean(el));
      const at = order.findIndex((el) => el === document.activeElement);
      const next = order[(at + (e.shiftKey ? -1 : 1) + order.length) % order.length];
      next?.focus();
      return;
    }
    // Enter on the toggle flips it, as a button does; anywhere else it picks the selected app.
    if (e.key === 'Enter' && e.target === toggle.current) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      if (e.repeat && e.key === 'Enter') return;
      const next = apply({ type: 'key', key: e.key });
      if (e.key !== 'Enter' && e.key !== 'Escape') slots.current[next.cursor]?.focus();
    }
  };

  return (
    <div
      className="home-select"
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-select-banner"
      aria-busy={chosen ? 'true' : undefined}
      onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) apply({ type: 'key', key: 'Escape' }); }}
    >
      <div className="home-select-stage">
      <h2 id="home-select-banner" className="home-select-banner">SELECT YOUR APP</h2>
      <div className="home-select-cast">
        {APPS.map((pick) => {
          const { name, stat, what } = PEDESTALS[pick];
          const on = state.cursor === pick;
          return (
            <button
              key={pick}
              type="button"
              ref={(el) => { slots.current[pick] = el; }}
              className="home-select-slot"
              data-on={on || undefined}
              data-chosen={chosen === pick || undefined}
              aria-label={`${name}: ${what}`}
              onFocus={() => { if (!on) apply({ type: 'select', pick }); }}
              onMouseEnter={() => { if (!on) apply({ type: 'select', pick }); }}
              onClick={(e) => { e.stopPropagation(); apply({ type: 'pick', pick }); }}
            >
              {on ? <span className="home-select-cursor" aria-hidden="true"><span className="home-glyph">▼</span> P1</span> : null}
              <span className="home-select-frame" aria-hidden="true">
                {pick === 'app'
                  ? <Svg svg={art.app} />
                  : <span className="home-select-cabinet">{art.arcade.map((svg, i) => <Svg key={i} svg={svg} />)}</span>}
              </span>
              <span className="home-select-plinth" aria-hidden="true" />
              <span className="home-select-name">{name}</span>
              <span className="home-select-stat" aria-hidden="true">
                {stat} <span className="home-select-bar">{Array.from({ length: STAT_CELLS }, (_, i) => <i key={i} />)}</span>
              </span>
              <span className="home-select-what">{what}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        ref={toggle}
        role="switch"
        aria-checked={state.remember}
        className="home-select-remember"
        onClick={(e) => { e.stopPropagation(); apply({ type: 'toggle' }); }}
      >
        <span className="home-select-box" aria-hidden="true">{state.remember ? '✓' : ''}</span>
        REMEMBER MY CHOICE
      </button>
      <p className="home-select-keys">
        <span className="home-select-arrows"><kbd><span className="home-glyph">←</span></kbd> <kbd><span className="home-glyph">→</span></kbd> move · </span>
        <kbd>ENTER</kbd> pick · <kbd>ESC</kbd> close
      </p>
      </div>
    </div>
  );
}
