'use client';
import { useReducer, useRef } from 'react';
import { ConnectAgentCard, type TokensHandlers } from './ConnectAgentCard';
import type { AgentToken } from './model';
import { demoTokensPort, httpTokensPort, type TokensPort } from './port';
import { initialTokensState, tokensReducer } from './state';

// Settings › Business › Connect an agent in the browser (PRD 855 s1): keeps the card's state and calls
// the links' routes as the signed-in person (./port.ts); in the demo, the same rules in memory.

export type TokensSource = { kind: 'demo' } | { kind: 'database'; workspace: string };

export interface ConnectAgentProps {
  source: TokensSource;
  tokens: AgentToken[];
}

/** The browser's clipboard, or none: a page served over plain http has no navigator.clipboard. */
const clipboardOf = (nav: { clipboard?: Clipboard }): Clipboard | undefined => nav.clipboard;

export function ConnectAgent({ source, tokens }: ConnectAgentProps) {
  const [state, act] = useReducer(tokensReducer, tokens, initialTokensState);
  const port = useRef<TokensPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoTokensPort(tokens, () => window.location.origin)
    : httpTokensPort(source.workspace));

  const make = async () => {
    if (state.busy || state.name.trim() === '') return;
    act({ type: 'busy' });
    const made = await getPort().make(state.name);
    act(made.ok ? { type: 'made', token: made.token, url: made.url, listed: made.listed } : { type: 'refused', message: made.message });
  };
  const revoke = async (token: AgentToken) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const gone = await getPort().revoke(token);
    act(gone.ok ? { type: 'revoked', id: token.id } : { type: 'refused', message: gone.message });
  };
  const on: TokensHandlers = {
    name: (name) => { act({ type: 'name', name }); },
    make: () => void make(),
    revoke: (token) => void revoke(token),
    copy: (label, text) => {
      void clipboardOf(navigator)?.writeText(text).then(() => { act({ type: 'copied', label }); }, () => undefined);
    },
    done: () => { act({ type: 'done' }); },
  };
  return <ConnectAgentCard state={state} demo={source.kind === 'demo'} on={on} />;
}
