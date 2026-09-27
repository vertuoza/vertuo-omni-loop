'use client';
// The confirm's text layer: OPEN THE APP? over whatever scene is showing, laid out for the grid the
// screen is drawn on (leave.css places it for `.grid-wide` and `.grid-tall`). It covers the screen,
// so a tap reaches nothing under it, and its hints are buttons a tap presses, as every key hint is.
// What a press does while it is open is leave.ts's to say; the arcade reads it.
import { useEffect, useRef } from 'react';
import { Hint } from './hint';
import { LEAVE } from './leave.ts';
import './leave.css';

export function LeaveOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  // It takes the focus while it is open, so Enter and Space answer it rather than press again the
  // row it was opened from, and gives it back as it closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => { if (before?.isConnected) before.focus({ preventScroll: true }); };
  }, []);
  return (
    <div className="leave" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="leave-title">
      <div className="leave-box">
        <p className="leave-title" id="leave-title">{LEAVE.title}</p>
        <p className="leave-line">{LEAVE.line}</p>
        <p className="leave-keys">
          <Hint k="A">{LEAVE.yes}</Hint>
          <Hint k="B">{LEAVE.no}</Hint>
        </p>
      </div>
    </div>
  );
}
