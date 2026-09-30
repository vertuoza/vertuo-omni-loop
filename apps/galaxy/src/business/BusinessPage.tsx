'use client';
import { useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { businessReducer, initialState, planConfirm, planPick, planTap, sizeOf, sizeValue, type Claim, type ClaimKind } from './model';
import { BusinessView, type BusinessHandlers } from './BusinessView';
import { callsOf, confirmCalls, databaseBusiness, demoBusinessPort, run, type BusinessPort, type Saved } from './store';

// Settings → Business in the browser (PRD 748 s2): keeps the page's state (model.ts) and calls the
// claim functions as the signed-in person (store.ts), one plan at a time; the view draws each step. A
// re-pick of offering, trade or size rejects the old claim before it picks the new one. In the demo,
// the same rules run in memory.

export type BusinessSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string; product: string };

type Rpc = Parameters<typeof databaseBusiness>[0];

export interface BusinessPageProps {
  source: BusinessSource;
  claims: Claim[];
}

export function BusinessPage({ source, claims }: BusinessPageProps) {
  const [state, dispatch] = useReducer(businessReducer, claims, initialState);
  const port = useRef<BusinessPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoBusinessPort(claims)
    : databaseBusiness(createBrowserClient(source.url, source.key) as unknown as Rpc, source.workspace, source.product));

  const go = async (calls: Array<() => Promise<Saved>>) => {
    if (state.busy) return;
    if (calls.length === 0) {
      dispatch({ type: 'done' });
      return;
    }
    dispatch({ type: 'busy' });
    const ok = await run(calls, (step) => dispatch(step));
    if (ok) dispatch({ type: 'done' });
  };

  const plan = (kind: ClaimKind, planned: { reject: Claim[]; pick: string | null }) => void go(callsOf(getPort(), kind, planned));

  const on: BusinessHandlers = {
    tap: (kind, value) => plan(kind, planTap(state.claims, kind, value)),
    pick: (kind, value) => plan(kind, planPick(state.claims, kind, value)),
    type: (kind) => dispatch({ type: 'type', kind }),
    untype: () => dispatch({ type: 'untype' }),
    sizeDraft: (stops) => dispatch({ type: 'size-draft', stops }),
    sizeCommit: () => {
      if (!state.sizeDraft) return;
      const value = sizeValue(state.sizeDraft);
      const rest = sizeOf(state.claims);
      if (rest.picked && sizeValue(rest.stops) === value) {
        dispatch({ type: 'done' });
        return;
      }
      plan('size', planPick(state.claims, 'size', value));
    },
    confirm: (claim) => void go(confirmCalls(getPort(), planConfirm(state.claims, claim), claim)),
    reject: (claim) => void go([() => getPort().setState(claim, 'rejected')]),
    skip: () => dispatch({ type: 'skip' }),
    unskip: () => dispatch({ type: 'unskip' }),
  };

  return <BusinessView state={state} demo={source.kind === 'demo'} on={on} />;
}
