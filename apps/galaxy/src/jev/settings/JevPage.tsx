'use client';
import { useReducer, useRef } from 'react';
import type { JevKeyStatus } from '../store';
import { initialState, jevReducer } from './model';
import { demoJevPort, httpJevPort, type JevPort, type KeySaved } from './port';
import { JevView, SWITCH_OFF, type JevHandlers } from './JevView';

// Settings › Jev in the browser (PRD 812 s1): keeps the page's state (model.ts) and calls the key
// routes as the signed-in person (port.ts), one call at a time; the view draws each step. Switching Jev
// off asks first, since it sets every decision Off. In the demo, the same rules run in memory.

export type JevSource = { kind: 'demo' } | { kind: 'database'; workspace: string };

export interface JevPageProps {
  source: JevSource;
  owner: boolean;
  keyStatus: JevKeyStatus;
}

export function JevPage({ source, owner, keyStatus }: JevPageProps) {
  const [state, dispatch] = useReducer(jevReducer, keyStatus, initialState);
  const port = useRef<JevPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo' ? demoJevPort() : httpJevPort(source.workspace));

  const run = async (call: (p: JevPort) => Promise<KeySaved>) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const saved = await call(getPort());
    dispatch(saved.ok ? { type: 'saved', key: saved.key } : { type: 'refused', message: saved.message });
  };

  const on: JevHandlers = {
    edit: () => dispatch({ type: 'edit' }),
    cancel: () => dispatch({ type: 'cancel' }),
    save: (key) => void run((p) => p.saveKey(key)),
    remove: () => {
      if (window.confirm(`${SWITCH_OFF} Switch Jev off?`)) void run((p) => p.removeKey());
    },
  };

  return <JevView state={state} owner={owner} on={on} />;
}
