'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { KitToken } from './terminal-tokens.contract';
import { demoTerminalPort, httpTerminalPort } from './terminal-tokens.client';
import { initialTerminalState, terminalReducer } from './terminal-tokens';
import { TerminalTokensCard, type TerminalHandlers } from './TerminalTokensCard';

// **Terminal tokens** in the browser (PRD 1628 s4): keeps the section's state, asks once, as the page
// opens, for the token the round trip just made (shown once: the route clears it, so a reload finds
// none), and revokes as the signed-in person. In the demo, Make a token draws a token in the page.

export type TerminalSource = { kind: 'demo' } | { kind: 'database'; workspace: string };

export interface TerminalTokensProps {
  source: TerminalSource;
  /** Null when your tokens could not be read. */
  tokens: KitToken[] | null;
  live: number | null;
  limit: number;
  /** The workspace's slug, the token acts in. */
  workspace: string;
  back: string;
  now: number;
}

/** The browser's clipboard, or none: a page served over plain http has no navigator.clipboard. */
const clipboardOf = (nav: { clipboard?: Clipboard }): Clipboard | undefined => nav.clipboard;

export function TerminalTokens({ source, tokens, live, limit, workspace, back, now }: TerminalTokensProps) {
  const [state, act] = useReducer(terminalReducer, { tokens, live, limit }, initialTerminalState);
  const [port] = useState(() => (source.kind === 'demo' ? demoTerminalPort() : httpTerminalPort(source.workspace)));
  // Asked once per page, even when React runs the effect twice: the route gives the token a single time.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void port.takeMade().then((shown) => {
      if (shown) act({ type: 'shown', shown });
    });
  }, [port]);

  const revoke = async (id: string) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const done = await port.revoke(id);
    act(done.ok ? { type: 'revoked', id } : { type: 'refused', message: done.message });
  };
  const makeHere = source.kind === 'demo' ? port.makeHere : null;
  const on: TerminalHandlers = {
    confirm: (id) => { act({ type: 'confirm', id }); },
    keep: () => { act({ type: 'keep' }); },
    revoke: (id) => void revoke(id),
    copy: (text) => {
      void clipboardOf(navigator)?.writeText(text).then(() => { act({ type: 'copied' }); }, () => undefined);
    },
    make: makeHere && ((name, days) => {
      void makeHere(name, days).then(({ shown, listed }) => { act({ type: 'shown', shown, listed }); });
    }),
  };
  return <TerminalTokensCard state={state} workspace={workspace} back={back} now={now} demo={source.kind === 'demo'} on={on} />;
}
