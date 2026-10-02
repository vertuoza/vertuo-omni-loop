'use client';
import { useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';
import type { FleetRow } from '../arcade/types';
import { FleetsView, type FleetsHandlers } from './FleetsView';
import { fleetsReducer, initialState } from './model';
import { databaseFleets, demoFleetsPort, type FleetsPort, type Saved } from './store';

// /app/settings/fleets in the browser (PRD 400 s3): keeps the page's state (model.ts) and calls the fleet
// functions as the signed-in person (store.ts), one call at a time; the view draws each step. In the
// demo, the same rules run in memory.

export type FleetsSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface FleetsPageProps {
  source: FleetsSource;
  owner: boolean;
  fleets: FleetRow[];
  mascots: readonly string[];
}

export function FleetsPage({ source, owner, fleets, mascots }: FleetsPageProps) {
  const [state, dispatch] = useReducer(fleetsReducer, fleets, initialState);
  const port = useRef<FleetsPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoFleetsPort(fleets)
    : databaseFleets(createBrowserClient<Database>(source.url, source.key), source.workspace));

  const run = async (call: (p: FleetsPort) => Promise<Saved>) => {
    dispatch({ type: 'busy' });
    const saved = await call(getPort());
    dispatch(saved.ok ? { type: 'saved', fleet: saved.fleet } : { type: 'refused', refusal: saved.refusal });
  };

  const on: FleetsHandlers = {
    create: () => { dispatch({ type: 'new' }); },
    edit: (name) => { dispatch({ type: 'edit', name }); },
    change: (field, value) => { dispatch({ type: 'change', field, value }); },
    cancel: () => { dispatch({ type: 'cancel' }); },
    save: () => {
      const draft = state.draft;
      if (!draft || state.busy) return;
      const { name, ...look } = draft;
      void run((p) => (name ? p.update(name, look) : p.create(look)));
    },
    askRetire: (name) => { dispatch({ type: 'ask-retire', name }); },
    keep: () => { dispatch({ type: 'keep' }); },
    retire: (name) => { if (!state.busy) void run((p) => p.retire(name)); },
    restore: (name) => { if (!state.busy) void run((p) => p.restore(name)); },
  };

  return <FleetsView state={state} owner={owner} mascots={mascots} on={on} />;
}
