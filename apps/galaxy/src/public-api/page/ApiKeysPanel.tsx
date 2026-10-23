'use client';
import { useReducer, useRef } from 'react';
import { httpApiKeysPort, httpGithubAppPort, type ApiKeysPort, type GithubAppPort } from '../keys/api-keys.client';
import type { ApiKey } from '../keys/api-keys.contract';
import { demoApiKeysPort, demoGithubAppPort } from './demo';
import { ApiKeysView, type ApiKeysHandlers } from './ApiKeysView';
import { apiKeysReducer, canAttach, canMake, FILE_UNREADABLE, initialApiKeysState, reposOf, type ApiKeysSource } from './model';

// Settings › API keys in the browser (PRD 2022 s1): keeps the panel's state and calls the keys' routes
// as the signed-in person (../keys/api-keys.client.ts); in the demo, the same rules in memory. The secret
// lives only in this state: leaving or reloading the page drops it for good. A key's GitHub App (PRD 2433
// s5) goes through its own routes the same way: the private key file is read here and sent with the App ID;
// it stays in the state only while the form is open (a refusal leaves it so the owner may try again), and
// is dropped once the App is attached or the form is cancelled.

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
  const apps = useRef<GithubAppPort | null>(null);
  const getApps = () => (apps.current ??= source.kind === 'demo' ? demoGithubAppPort() : httpGithubAppPort());

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
  const attach = async () => {
    const form = state.attach;
    const key = form ? state.keys.find((k) => k.id === form.id) : undefined;
    if (!form?.file || !key || !canAttach(state)) return;
    act({ type: 'busy' });
    const attached = await getApps().attach(key, form.appId, form.file.text);
    act(attached.ok ? { type: 'attached', id: key.id, slug: attached.slug } : { type: 'refused', message: attached.message });
  };
  const remove = async (key: ApiKey) => {
    if (state.busy) return;
    act({ type: 'busy' });
    const gone = await getApps().remove(key);
    act(gone.ok ? { type: 'removed', id: key.id } : { type: 'refused', message: gone.message });
  };
  const choose = async (file: File | null) => {
    if (!file) {
      act({ type: 'attach-file', file: null });
      return;
    }
    try {
      act({ type: 'attach-file', file: { name: file.name, text: await file.text() } });
    } catch {
      act({ type: 'refused', message: FILE_UNREADABLE });
    }
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
    attachOpen: (key) => { act({ type: 'attach-open', key }); },
    attachClose: () => { act({ type: 'attach-close' }); },
    appId: (appId) => { act({ type: 'attach-id', appId }); },
    file: (file) => void choose(file),
    attach: () => void attach(),
    removeAsk: (key) => { act({ type: 'remove-confirm', id: key.id }); },
    removeCancel: () => { act({ type: 'remove-cancel' }); },
    remove: (key) => void remove(key),
  };
  return <ApiKeysView state={state} owner={owner} tracked={tracked} now={new Date(now)} demo={source.kind === 'demo'} on={on} />;
}
