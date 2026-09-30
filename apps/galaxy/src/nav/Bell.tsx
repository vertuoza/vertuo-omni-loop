'use client';
import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { PersonChip } from '../people/PersonChip';
import { BLOCKED_BY_BROWSER } from '../waiting/alerts';
import { useAlerts, useWaiting } from '../waiting/WaitingProvider';
import type { DocumentGroup } from '../waiting/documents';
import type { WaitingList } from '../waiting/waiting';
import { bell, bellName, bellPanel, CLOSED_BELL, NOTHING_WAITING, type BellAlerts, type BellUnread } from './bell';
import './bell.css';

// The top bar's bell (PRD 499), between Game mode and the avatar: the waiting list's count as a red
// badge, and a panel under it listing what waits, Questions then Outbox (src/nav/bell.ts). Escape
// (the focus back on the bell), a click outside it or choosing an item closes it. Below 900 px the
// panel takes the screen's width under the top bar (bell.css). The panel's foot holds the Desktop
// alerts and Chime switches (s5), kept by the waiting provider. PRD 579: a New documents group after
// Outbox, which never adds to the badge. PRD 652: who shared a question shows as a person chip.
// PRD 774 (s5): a Business group last, "Business · N to check", which never adds to the badge either.

export function Bell() {
  const { list, unread, unreadPrds, documents, business } = useWaiting();
  const alerts = useAlerts();
  const [now, setNow] = useState(() => Date.now());
  return <BellView list={list} documents={documents} business={business} unread={{ ...unread, outboxPrds: unreadPrds }} now={now} onOpen={() => setNow(Date.now())} alerts={alerts} />;
}

/** The bell as it draws a given list: what the render tests pin. */
export function BellView({ list, documents = [], business = 0, unread, now, onOpen, alerts }: {
  list: WaitingList;
  /** The New documents part's groups, newest first. */
  documents?: readonly DocumentGroup[];
  /** How many things wait to be checked on Settings › Business. Never counted in the badge. */
  business?: number;
  unread: BellUnread;
  now: number;
  onOpen?: () => void;
  alerts?: BellAlerts;
}) {
  const [state, send] = useReducer(bell, CLOSED_BELL);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = `${useId()}-bell`;
  const count = list.questions.length + list.outbox.length;
  const panel = bellPanel(list, unread, now, documents, business);

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
                      <span className="bell-line-meta" suppressHydrationWarning>
                        {line.meta}
                        {line.sharedBy && <> · shared by <PersonChip person={line.sharedBy} size="inline" link={false} /></>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {alerts && <AlertSwitches {...alerts} />}
      </div>
    </div>
  );
}

/** The panel's foot: Desktop alerts (which the browser may block) and Chime. */
function AlertSwitches({ desktop, chime, onDesktop, onChime }: BellAlerts) {
  const blocked = desktop === 'blocked';
  return (
    <footer className="bell-alerts">
      <label className="bell-switch">
        <input type="checkbox" checked={desktop === 'on'} disabled={blocked} onChange={(e) => onDesktop?.(e.currentTarget.checked)} />
        <span className="bell-switch-label">Desktop alerts</span>
        {blocked && <span className="bell-switch-note">{BLOCKED_BY_BROWSER}</span>}
      </label>
      <label className="bell-switch">
        <input type="checkbox" checked={chime} onChange={(e) => onChime?.(e.currentTarget.checked)} />
        <span className="bell-switch-label">Chime</span>
      </label>
    </footer>
  );
}
