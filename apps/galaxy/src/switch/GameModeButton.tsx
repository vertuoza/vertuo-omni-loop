'use client';
import { useId, useRef, type MouseEvent } from 'react';
import { GAME_HOME, GAME_MODE } from './switch';
import './switch.css';

// Game mode, the last control of every app page's header (PRD 238): a button that asks first. The
// dialog is modal: Switch goes to the arcade's menu in the same tab and has the focus as it opens;
// Stay, Esc (the browser's own) or a click on the backdrop closes it, and the page is as it was.

function Gamepad() {
  return (
    <svg className="game-mode-glyph" viewBox="0 0 16 12" width="16" height="12" aria-hidden="true" focusable="false">
      <rect x="0.5" y="1.5" width="15" height="9" rx="4.5" fill="none" stroke="currentColor" />
      <path d="M4 4.5v3M2.5 6h3" stroke="currentColor" />
      <circle cx="11" cy="5" r="1" fill="currentColor" />
      <circle cx="12.5" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

export function GameModeButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const go = useRef<HTMLAnchorElement>(null);
  const title = useId();

  const open = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    go.current?.focus();
  };
  const close = () => dialog.current?.close();
  // The dialog has no padding of its own: a click whose target is the dialog itself landed on its
  // backdrop, outside the box.
  const outside = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <>
      <button type="button" className="game-mode" aria-haspopup="dialog" onClick={open}>
        <Gamepad />
        {GAME_MODE.label}
      </button>
      <dialog ref={dialog} className="game-mode-dialog" aria-labelledby={title} onClick={outside}>
        <div className="game-mode-box">
          <h2 id={title} className="game-mode-title">{GAME_MODE.title}</h2>
          <p className="game-mode-line">{GAME_MODE.line}</p>
          <div className="game-mode-actions">
            <button type="button" className="ask-button quiet" onClick={close}>{GAME_MODE.stay}</button>
            <a ref={go} className="ask-button" href={GAME_HOME}>{GAME_MODE.go}</a>
          </div>
        </div>
      </dialog>
    </>
  );
}
