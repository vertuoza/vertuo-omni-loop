'use client';
import { useEffect, useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  businessReducer, initialState, planConfirm, planPick, planTap, sizeOf, sizeValue, viewClaims, type Claim, type ClaimKind, type Product,
} from './model';
import { BusinessView, type BusinessHandlers } from './BusinessView';
import { callsOf, confirmCalls, databaseBusiness, demoBusinessPort, run, type BusinessPort, type Saved } from './store';
import { suggestKey } from './suggest';

// Settings → Business in the browser (PRD 748 s2): keeps the page's state (model.ts) and calls the
// claim functions as the signed-in person (store.ts), one plan at a time; the view draws each step. A
// re-pick of offering, trade or size rejects the old claim before it picks the new one. In the demo,
// the same rules run in memory. With products (PRD 748 s4), a pick and a suggestion name the product
// whose tab is shown, and "+ Add a product" adds one with product_add(), then shows its tab.

export type BusinessSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string; product: string };

type Rpc = Parameters<typeof databaseBusiness>[0];

export interface BusinessPageProps {
  source: BusinessSource;
  /** Every claim of the business, of every product. */
  claims: Claim[];
  /** The business's products, first first (PRD 748 s4). */
  products: Product[];
}

export function BusinessPage({ source, claims, products }: BusinessPageProps) {
  const [whole, dispatch] = useReducer(businessReducer, null, () => initialState(claims, products));
  // What the handlers read: the tab's claims (every claim while there is one product).
  const state = { ...whole, claims: viewClaims(whole.claims, whole.products, whole.current) };
  const product = whole.current ?? undefined;
  const port = useRef<BusinessPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoBusinessPort(claims, products)
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

  // Suggested rivals (PRD 748 s3): once offering, trade and region are picked, the page asks once for
  // those picks, and again only when one changes. Guesses left from an earlier visit are not asked
  // for again. The answer never blocks a control, and no guess is never an error.
  // Each product asks for its own (PRD 748 s4): the key names the tab.
  const keyOf = (picked: Claim[], on: string | null) => {
    const k = suggestKey(picked);
    return k && `${on ?? ''}|${k}`;
  };
  const key = keyOf(state.claims, whole.current);
  const opening = viewClaims(claims, products, products[0]?.id ?? null);
  const asked = useRef<string | null>(opening.some((c) => c.kind === 'rival' && c.state === 'proposed') ? keyOf(opening, products[0]?.id ?? null) : null);
  useEffect(() => {
    if (!key || key === asked.current) return;
    asked.current = key;
    void getPort().suggest(product).then((found) => {
      if (found.length > 0) dispatch({ type: 'suggested', claims: found });
    });
    // getPort is stable for the page's life; only the picks' key asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const plan = (kind: ClaimKind, planned: { reject: Claim[]; pick: string | null }) => void go(callsOf(getPort(), kind, planned, product));

  const addProduct = async (name: string) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const added = await getPort().addProduct(name);
    dispatch(added.ok ? { type: 'product-added', product: added.product } : { type: 'refused', message: added.message });
  };

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
    openProduct: () => dispatch({ type: 'add-product' }),
    closeProduct: () => dispatch({ type: 'unadd-product' }),
    addProduct: (name) => void addProduct(name),
    showProduct: (id) => dispatch({ type: 'show-product', product: id }),
  };

  return <BusinessView state={whole} demo={source.kind === 'demo'} on={on} />;
}
