'use client';
import { useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types.ts';
import { initialState, repositoriesReducer, type RepositoryRow } from './model';
import { RepositoriesView, type Access, type RepositoriesHandlers } from './RepositoriesView';
import { databaseRepositories, demoRepositoriesPort, type RepositoriesPort, type Saved } from './store';

// Settings → Repositories in the browser (PRD 612 s1): keeps the page's state (model.ts) and calls the
// repository functions as the signed-in person (store.ts), one call at a time; the view draws each
// step. PRD 1246 s4 adds the ideas board's switch, PRD 1299 s1 the phase 0 switch. In the demo, the same
// rules run in memory.

export type RepositoriesSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface RepositoriesPageProps {
  source: RepositoriesSource;
  owner: boolean;
  repositories: RepositoryRow[];
  access: Access;
  now: number;
}

export function RepositoriesPage({ source, owner, repositories, access, now }: RepositoriesPageProps) {
  const [state, dispatch] = useReducer(repositoriesReducer, repositories, initialState);
  const port = useRef<RepositoriesPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoRepositoriesPort(repositories)
    : databaseRepositories(createBrowserClient<Database>(source.url, source.key), source.workspace));

  const run = async (call: (p: RepositoriesPort) => Promise<Saved>) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const saved = await call(getPort());
    dispatch(saved.ok ? { type: 'saved', repository: saved.repository } : { type: 'refused', message: saved.message });
  };

  const on: RepositoriesHandlers = {
    pick: () => { dispatch({ type: 'pick' }); },
    close: () => { dispatch({ type: 'close' }); },
    add: (fullName) => void run((p) => p.add(fullName)),
    setTracked: (fullName, tracked) => void run((p) => p.setTracked(fullName, tracked)),
    setPublicIdeas: (fullName, on) => void run((p) => p.setPublicIdeas(fullName, on)),
    setPhase0: (fullName, phase0) => void run((p) => p.setPhase0(fullName, phase0)),
  };

  return <RepositoriesView state={state} owner={owner} access={access} now={now} on={on} />;
}
