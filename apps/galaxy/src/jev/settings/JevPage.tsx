'use client';
import { useReducer, useRef } from 'react';
import type { JevDecisionSettings, JevKeyStatus } from '../store';
import { initialState, jevReducer } from './model';
import { demoJevPort, httpJevPort, type JevPort, type KeySaved, type SaveDecisionAction } from './port';
import { JevView, SWITCH_OFF, type JevHandlers } from './JevView';

// Settings › Jev in the browser (PRD 812 s1): keeps the page's state (model.ts) and calls the key
// routes as the signed-in person (port.ts), one call at a time; the view draws each step. Switching Jev
// off asks first, since it sets every decision Off. A decision's row is saved on its own, through the
// page's server action (PRD 812 s2). In the demo, the same rules run in memory.

export type JevSource = { kind: 'demo' } | { kind: 'database'; workspace: string; saveDecision: SaveDecisionAction };

export interface JevPageProps {
  source: JevSource;
  owner: boolean;
  keyStatus: JevKeyStatus;
  decisions: JevDecisionSettings[];
}

export function JevPage({ source, owner, keyStatus, decisions }: JevPageProps) {
  const [state, dispatch] = useReducer(jevReducer, { keyStatus, decisions }, (first) => initialState(first.keyStatus, first.decisions));
  const port = useRef<JevPort | null>(null);
  const getPort = () =>
    (port.current ??= source.kind === 'demo' ? demoJevPort() : httpJevPort(source.workspace, globalThis.fetch, source.saveDecision));

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
    saveDecision: (settings) => {
      if (state.savingDecision) return;
      dispatch({ type: 'decision-saving', decision: settings.decision });
      void getPort().saveDecision(settings).then((saved) =>
        dispatch(saved.ok ? { type: 'decision-saved', settings: saved.settings } : { type: 'decision-refused', decision: settings.decision, message: saved.message }));
    },
  };

  return <JevView state={state} owner={owner} on={on} />;
}
