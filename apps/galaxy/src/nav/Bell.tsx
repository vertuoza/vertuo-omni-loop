'use client';
import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { useWaiting } from '../waiting/WaitingProvider';
import type { WaitingList } from '../waiting/waiting';
import { bell, bellName, bellPanel, CLOSED_BELL, NOTHING_WAITING, type BellUnread } from './bell';
import './bell.css';

// The top bar's bell (PRD 499), between Game mode and the avatar: the waiting list's count as a red
// badge, and a panel under it listing what waits, Questions then Outbox (src/nav/bell.ts). Escape
// (the focus back on the bell), a click outside it or choosing an item closes it. Below 900 px the
// panel takes the screen's width under the top bar (bell.css).

export function Bell() {
  const { list, unread, unreadPrds } = useWaiting();
  const [now, setNow] = useState(() => Date.now());
  return <BellView list={list} unread={{ ...unread, outboxPrds: unreadPrds }} now={now} onOpen={() => setNow(Date.now())} />;
}

/** The bell as it draws a given list: what the render tests pin. */
export function BellView({ list, unread, now, onOpen }: { list: WaitingList; unread: BellUnread; now: number; onOpen?: () => void }) {
  const [state, send] = useReducer(bell, CLOSED_BELL);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = `${useId()}-bell`;
  const count = list.questions.length + list.outbox.length;
  const panel = bellPanel(list, unread, now);

  useEffect(() => {
    if (state.focus === 'bell') button.current?.focus();
  }, [state]);

  useEffect(() => {
    if (!state.open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) send('outside');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') send('escape');
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [state.open]);

  return (
    <div className="bell" ref={root}>
      <button
        ref={button}
        type="button"
        className="bell-button"
        aria-label={bellName(count)}
        aria-expanded={state.open}
        aria-controls={panelId}
        onClick={() => {
          if (!state.open) onOpen?.();
          send('toggle');
        }}
      >
        <svg className="bell-icon" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="bell-badge" aria-hidden="true">{count}</span>}
      </button>
      <div id={panelId} className="bell-panel" role="region" aria-label="Waiting for you" hidden={!state.open}>
        {panel.empty && <p className="bell-empty">{NOTHING_WAITING}</p>}
        {panel.groups.map((group) => (
          <section key={group.label} className="bell-group" aria-label={group.label}>
            <h2 className="bell-group-label">{group.label}</h2>
            {group.problem && <p className="bell-problem" role="status">{group.problem}</p>}
            {group.lines.length > 0 && (
              <ul className="bell-lines">
                {group.lines.map((line) => (
                  <li key={line.id}>
                    <a className="bell-line" href={line.href} onClick={() => send('choose')}>
                      <span className="bell-line-head">{line.head}</span>
                      <span className="bell-line-text">{line.text}</span>
                      <span className="bell-line-meta" suppressHydrationWarning>{line.meta}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
