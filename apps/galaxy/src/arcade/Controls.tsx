'use client';
// The controls both Game Boy bodies share. Each sends the action a key does, through the same
// `act()`: they fire on touch-down, the D-pad is one rocker that repeats while held, several fingers
// each press their own control, and every press buzzes where the browser can. The grille toggles
// the sound. Each control is a button too, so a keyboard or a screen reader can press it.
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { dpadDirection, type Direction } from './dpad';
import type { Action } from './keys';
import { holdToRepeat } from './repeat';
import { unlock } from './sound';

type Fire = (action: Action) => void;

/** A 10 ms buzz where the browser offers one; iPhone Safari has none, and stays silent. */
function buzz() {
  try { navigator.vibrate?.(10); } catch { /* not offered */ }
}

// A pointer press fires on the way down, and the click the browser sends after it must not fire
// again; a click with no pointer press before it (Enter or Space on a focused control, a screen
// reader's activation) fires on its own.
const CLICK_AFTER_PRESS_MS = 1000;

function usePress(fire: () => void) {
  const pressedAt = useRef(-Infinity);
  const up = (e: ReactPointerEvent<HTMLElement>) => {
    if (!('down' in e.currentTarget.dataset)) return;
    pressedAt.current = performance.now();
    delete e.currentTarget.dataset.down;
    unlock(); // a touch only lets sound start once the finger is lifted
  };
  return {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      e.preventDefault();
      pressedAt.current = performance.now();
      e.currentTarget.dataset.down = '';
      buzz();
      fire();
    },
    onPointerUp: up,
    onPointerCancel: up,
    onPointerLeave: up,
    onClick() {
      if (performance.now() - pressedAt.current > CLICK_AFTER_PRESS_MS) fire();
    },
  };
}

/** A, B, SELECT or START: fires once per press, never repeating. */
function useButton(action: Action, onAction: Fire) {
  const fire = useRef(onAction);
  fire.current = onAction;
  return usePress(() => fire.current(action));
}

export function FaceButton({ action, onAction }: { action: 'a' | 'b'; onAction: Fire }) {
  const press = useButton(action, onAction);
  const letter = action.toUpperCase();
  return (
    <>
      <button type="button" className={`gb-face gb-face-${action}`} aria-label={action === 'a' ? 'A, confirm' : 'B, back'} {...press}>
        <span aria-hidden="true">{letter}</span>
      </button>
      <span className={`gb-face-label gb-face-label-${action}`} aria-hidden="true">{letter}</span>
    </>
  );
}

export function Pill({ action, onAction }: { action: 'select' | 'start'; onAction: Fire }) {
  const press = useButton(action, onAction);
  return (
    <button type="button" className="gb-pill" aria-label={action === 'select' ? 'Select' : 'Start'} {...press}>
      <i aria-hidden="true" />
      <span aria-hidden="true">{action.toUpperCase()}</span>
    </button>
  );
}

/** The speaker grille: a tap toggles the sound (the setting M toggles), and the lens's LED follows. */
export function Grille({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  const toggle = useRef(onToggle);
  toggle.current = onToggle;
  const press = usePress(() => toggle.current());
  return (
    <button type="button" className="gb-grille" aria-label="Sound" aria-pressed={!muted} {...press}>
      <span className="gb-slots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <span className="gb-grille-label" aria-hidden="true">SOUND</span>
    </button>
  );
}

const ARMS: { dir: Direction; label: string; arrow: string }[] = [
  { dir: 'up', label: 'Up', arrow: '▲' },
  { dir: 'left', label: 'Left', arrow: '◀' },
  { dir: 'right', label: 'Right', arrow: '▶' },
  { dir: 'down', label: 'Down', arrow: '▼' },
];

/**
 * The D-pad: one rocker. The direction comes from where the finger is relative to the cross's centre
 * (`dpadDirection`), sliding to another arm fires it at once, sliding back to the centre stops, and a
 * held direction repeats. One finger drives it at a time: the last one down.
 */
export function DPad({ onAction }: { onAction: Fire }) {
  const fire = useRef(onAction);
  fire.current = onAction;
  const repeat = useMemo(() => holdToRepeat((a) => fire.current(a)), []);
  useEffect(() => () => repeat.release(), [repeat]);
  const cross = useRef<HTMLDivElement>(null);
  const finger = useRef<number | null>(null);
  const held = useRef<Direction | null>(null);
  const pressedAt = useRef(-Infinity);

  const aim = (clientX: number, clientY: number) => {
    const el = cross.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dir = dpadDirection(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2));
    if (dir === held.current) return;
    held.current = dir;
    if (dir) el.dataset.dir = dir; else delete el.dataset.dir;
    if (dir) { buzz(); repeat.press(dir); } else repeat.release();
  };
  const lift = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== finger.current) return;
    finger.current = null;
    held.current = null;
    pressedAt.current = performance.now();
    delete e.currentTarget.dataset.dir;
    repeat.release();
    unlock();
  };

  return (
    <div
      ref={cross}
      className="gb-dpad"
      role="group"
      aria-label="D-pad"
      onPointerDown={(e) => {
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
        finger.current = e.pointerId;
        held.current = null;
        pressedAt.current = performance.now();
        aim(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (e.pointerId === finger.current) aim(e.clientX, e.clientY); }}
      onPointerUp={lift}
      onPointerCancel={lift}
      onLostPointerCapture={lift}
    >
      <span className="gb-hub" aria-hidden="true" />
      {ARMS.map(({ dir, label, arrow }) => (
        <button
          key={dir}
          type="button"
          className={`gb-arm gb-arm-${dir}`}
          aria-label={label}
          onClick={() => { if (performance.now() - pressedAt.current > CLICK_AFTER_PRESS_MS) fire.current(dir); }}
        >
          <span aria-hidden="true">{arrow}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Holds the page still while a Game Boy body is on screen: no scroll, no pinch or double-tap zoom,
 * no pull-to-refresh or rubber band, no text selection and no long-press menu.
 */
export function useHoldStill() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('held-still');
    const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); };
    const opts = { passive: false } as const;
    const events = ['touchmove', 'gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart'];
    for (const type of events) document.addEventListener(type, stop, opts);
    return () => {
      root.classList.remove('held-still');
      for (const type of events) document.removeEventListener(type, stop);
    };
  }, []);
}
