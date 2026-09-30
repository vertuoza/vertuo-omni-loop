'use client';
import { useEffect, useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  businessReducer, initialBusinessState, planConfirm, planPick, planTap, sizeOf, sizeValue, viewClaims, type Claim, type ClaimKind, type Product,
} from './model';
import { BusinessView, type BusinessHandlers } from './BusinessView';
import { callsOf, confirmCalls, databaseBusiness, demoBusinessPort, run, type BusinessPort, type Saved } from './store';
import { suggestKey } from './suggest';
import { databaseDraft, demoDraftPort, type DraftDb, type DraftPort } from './draft-port';
import { thatsUs, type DraftView, type WebPage } from './reveal';

// Settings → Business in the browser (PRD 748 s2): keeps the page's state (model.ts) and calls the
// claim functions as the signed-in person (store.ts), one plan at a time; the view draws each step. A
// re-pick of offering, trade or size rejects the old claim before it picks the new one. In the demo,
// the same rules run in memory. With products (PRD 748 s4), a pick and a suggestion name the product
// whose tab is shown, and "+ Add a product" adds one with product_add(), then shows its tab.
//
// The draft (PRD 774 s3), through draft-port.ts: Draft from my repos starts one (or finds the one
// running), then the page reads the draft row every POLL_MS until it ends, and every claim again. A
// draft already running when the page opens is followed the same way. ✓ / ✗ on a found row stay in the
// page; That's us saves them in one call. "+ add a web page" and its removal go through the sources
// route. In the demo, the draft runs in memory, and the demo's store starts again from what the page
// holds after each draft, so a found row can be picked, confirmed or rejected like any other.
//
// What the weekly recheck left (PRD 774 s4): ✓ / ✗ on a replacement or an addition saves at once, and
// ✓ Still true on a faded claim moves its last_seen to now.

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
  /** The business's latest draft, or null (PRD 774 s3). */
  draft?: DraftView | null;
  /** The web pages pasted on the business. */
  pages?: WebPage[];
}

/** How often a running draft's row is read again. */
const POLL_MS = 1500;

export function BusinessPage({ source, claims, products, draft = null, pages = [] }: BusinessPageProps) {
  const [whole, dispatch] = useReducer(businessReducer, null, () => initialBusinessState(claims, products, { draft, pages }));
  // What the demo's stores start from: the claims the page holds now.
  const held = useRef(whole);
  held.current = whole;
  // What the handlers read: the tab's claims (every claim while there is one product).
  const state = { ...whole, claims: viewClaims(whole.claims, whole.products, whole.current) };
  const product = whole.current ?? undefined;
  const port = useRef<BusinessPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoBusinessPort(held.current.claims, held.current.products)
    : databaseBusiness(createBrowserClient(source.url, source.key) as unknown as Rpc, source.workspace, source.product));
  const drafts = useRef<DraftPort | null>(null);
  const getDrafts = () => (drafts.current ??= source.kind === 'demo'
    ? demoDraftPort(() => held.current.claims)
    : databaseDraft(createBrowserClient(source.url, source.key) as unknown as DraftDb, source.workspace));
  /** In the demo, the claims store starts again from the page after a draft or That's us. */
  const renew = () => {
    if (source.kind === 'demo') port.current = null;
  };

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

  // A running draft is read again until it ends; then every claim is read again.
  const running = whole.draft?.state === 'running' ? whole.draft.id : null;
  useEffect(() => {
    if (!running) return;
    let live = true;
    const timer = setInterval(() => {
      void (async () => {
        const row = await getDrafts().latest();
        if (!live || !row) return;
        if (row.state === 'running') {
          dispatch({ type: 'draft', draft: row });
          return;
        }
        const read = await getDrafts().claims();
        if (!live) return;
        renew();
        dispatch({ type: 'drafted', draft: row, claims: read ?? held.current.claims });
      })();
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // getDrafts is stable for the page's life; only a new running draft starts reading again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const startDraft = async () => {
    if (state.busy || running) return;
    dispatch({ type: 'busy' });
    const started = await getDrafts().start();
    if (!started.ok) {
      dispatch({ type: 'refused', message: started.message });
      return;
    }
    dispatch({ type: 'draft', draft: started.draft });
    dispatch({ type: 'done' });
  };

  const saveThatsUs = async () => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const saved = await getDrafts().thatsUs(thatsUs(whole.claims, whole.marks).rejected);
    if (!saved.ok) {
      dispatch({ type: 'refused', message: saved.message });
      return;
    }
    renew();
    dispatch({ type: 'thats-us' });
  };

  const addPage = async (url: string) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const added = await getDrafts().addPage(url);
    dispatch(added.ok ? { type: 'page-added', page: added.page } : { type: 'refused', message: added.message });
  };

  const removePage = async (page: WebPage) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const removed = await getDrafts().removePage(page.id);
    dispatch(removed.ok ? { type: 'page-removed', page: page.id } : { type: 'refused', message: removed.message });
  };

  // What the recheck left (PRD 774 s4): ✓ / ✗ on a replacement or an addition is claim_set_state(),
  // which settles a replacement with the claim it replaces; ✓ Still true is claim_still_true().
  const settle = async (claim: Claim, right: boolean) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const saved = await getPort().setState(claim, right ? 'confirmed' : 'rejected');
    if (!saved.ok) {
      dispatch({ type: 'refused', message: saved.message });
      return;
    }
    renew();
    dispatch({ type: 'settled', claim: saved.claim });
  };

  const keepClaim = async (claim: Claim) => {
    if (state.busy) return;
    dispatch({ type: 'busy' });
    const kept = await getDrafts().stillTrue(claim.id);
    dispatch(kept.ok ? { type: 'still-true', claim: claim.id, at: kept.at } : { type: 'refused', message: kept.message });
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
    draft: () => void startDraft(),
    mark: (claim, mark) => dispatch({ type: 'mark', claim: claim.id, mark }),
    thatsUs: () => void saveThatsUs(),
    openPage: () => dispatch({ type: 'add-page' }),
    closePage: () => dispatch({ type: 'unadd-page' }),
    addPage: (url) => void addPage(url),
    removePage: (page) => void removePage(page),
    settle: (claim, right) => void settle(claim, right),
    stillTrue: (claim) => void keepClaim(claim),
  };

  return <BusinessView state={whole} demo={source.kind === 'demo'} on={on} />;
}
