'use client';
import { useReducer, useRef } from 'react';
import { httpApiKeysPort, type ApiKeysPort } from '../keys/api-keys.client';
import type { ApiKey } from '../keys/api-keys.contract';
import { demoApiKeysPort } from './demo';
import { ApiKeysView, type ApiKeysHandlers } from './ApiKeysView';
import { apiKeysReducer, canMake, initialApiKeysState, reposOf, type ApiKeysSource } from './model';

// Settings › API keys in the browser (PRD 2022 s1): keeps the panel's state and calls the keys' routes
// as the signed-in person (../keys/api-keys.client.ts); in the demo, the same rules in memory. The secret
// lives only in this state: leaving or reloading the page drops it for good.

export interface ApiKeysPanelProps {
  source: ApiKeysSource;
  owner: boolean;
  keys: ApiKey[];
  tracked: string[];
  /** When the page was drawn, as an ISO string, so the server and the browser say the same times. */
  now: string;
}

/** The browser's clipboard, or none: a page served over plain http has no navigator.clipboard. */
const clipboardOf = (nav: { clipboard?: Clipboard }): Clipboard | undefined => nav.clipboard;

export function ApiKeysPanel({ source, owner, keys, tracked, now }: ApiKeysPanelProps) {
  const [state, act] = useReducer(apiKeysReducer, keys, initialApiKeysState);
  const port = useRef<ApiKeysPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo' ? demoApiKeysPort(keys) : httpApiKeysPort(source.workspace));

  const make = async () => {
    if (!canMake(state)) return;
    act({ type: 'busy' });
    const made = await getPort().make(state.form.name.trim(), reposOf(state.form));
    act(made.ok ? { type: 'made', key: made.key, secret: made.secret, origin: window.location.origin } : { type: 'refused', message: made.message });
  };
  const revoke = async (key: ApiKey) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const gone = await getPort().revoke(key);
    act(gone.ok ? { type: 'revoked', id: key.id } : { type: 'refused', message: gone.message });
  };
  const on: ApiKeysHandlers = {
    open: () => { act({ type: 'open' }); },
    close: () => { act({ type: 'close' }); },
    name: (name) => { act({ type: 'name', name }); },
    all: (all) => { act({ type: 'all', all }); },
    repo: (repo, checked) => { act({ type: 'repo', repo, on: checked }); },
    make: () => void make(),
    copy: () => {
      if (state.made) void clipboardOf(navigator)?.writeText(state.made.secret).then(() => { act({ type: 'copied' }); }, () => undefined);
    },
    confirm: (key) => { act({ type: 'confirm', id: key.id }); },
    cancel: () => { act({ type: 'cancel' }); },
    revoke: (key) => void revoke(key),
  };
  return <ApiKeysView state={state} owner={owner} tracked={tracked} now={new Date(now)} demo={source.kind === 'demo'} on={on} />;
}
