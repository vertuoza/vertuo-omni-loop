'use client';
import { useReducer, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import type { PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import {
  approversReducer, databaseApprovers, demoApprovers, initialApproversForm,
  type ApproversAction, type Approvers, type ApproversForm, type ApproversPort, type ApproverState,
} from './approvers';
import { ApproversSection, type ApproversHandlers } from './approvers-section';
import { PRODUCTS_HREF, type PitchedProduct } from './model';
import { PitchSection, type PitchHandlers } from './pitch-form';
import { databaseAssets, demoAssets, PITCH_ASSETS_BUCKET, type AssetsPort } from './pitch-form-assets';
import { initialPitchForm, pitchFormReducer, type AssetTarget } from './pitch-form-model';
import { databaseProducts, demoProductsPort, type ProductsPort } from './store';

// A product's page in the browser (PRD 859 s1, PRD 1108 s2, PRD 1322 s1): its name, its Pitch section
// and its Approvers list. Keeps the Pitch section's state (pitch-form-model.ts), saves the draft through
// set_pitch_settings() as the signed-in person (store.ts) and uploads a file into the `pitch-assets`
// bucket (pitch-form-assets.ts), one call at a time; keeps the Approvers list's state (approvers.ts) and
// changes it through product_approver_set() and product_approver_remove(). Each section draws each step.
// In the demo, the same rules run in memory.

export type ProductsSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface ProductPageProps {
  source: ProductsSource;
  editable: boolean;
  product: PitchedProduct;
  /** Null when the list could not be read. */
  approvers: Approvers | null;
}

type Ports = { products: ProductsPort; assets: AssetsPort; approvers: ApproversPort };

function portsOf(source: ProductsSource, product: PitchedProduct, approvers: Approvers | null): Ports {
  if (source.kind === 'demo') return { products: demoProductsPort([product]), assets: demoAssets(), approvers: demoApprovers(approvers?.members ?? []) };
  const db = createBrowserClient(source.url, source.key);
  return {
    products: databaseProducts(db, source.workspace),
    assets: databaseAssets(db.storage.from(PITCH_ASSETS_BUCKET), source.workspace, product.id),
    approvers: databaseApprovers(db, product.id),
  };
}

/** The list's state, none while it could not be read. */
const listReducer = (form: ApproversForm | null, action: ApproversAction): ApproversForm | null => (form ? approversReducer(form, action) : null);

/** The Approvers list's state and handlers: one change at a time. */
function useApprovers(approvers: Approvers | null, port: () => ApproversPort) {
  const [form, dispatch] = useReducer(listReducer, approvers, (a) => (a ? initialApproversForm(a) : null));
  const run = async (change: () => Promise<{ ok: true } | { ok: false; message: string }>, done: () => void) => {
    dispatch({ type: 'busy' });
    const result = await change();
    if (result.ok) done();
    else dispatch({ type: 'refused', message: result.message });
  };
  const on: ApproversHandlers = {
    set: (member: string, state: ApproverState) => {
      if (form && !form.busy) void run(() => port().set(member, state), () => { dispatch({ type: 'set', member, state }); });
    },
    remove: (member: string) => {
      if (form && !form.busy) void run(() => port().remove(member), () => { dispatch({ type: 'removed', member }); });
    },
  };
  return { form, on };
}

function ProductHead({ name }: { name: string }) {
  return (
    <section className="ask-card products-head" aria-labelledby="product-title">
      <Link className="products-back" href={PRODUCTS_HREF}>← Products</Link>
      <h1 id="product-title">{name}</h1>
    </section>
  );
}

export function ProductPage({ source, editable, product, approvers }: ProductPageProps) {
  const [state, dispatch] = useReducer(pitchFormReducer, product.pitch, initialPitchForm);
  const ports = useRef<Ports | null>(null);
  const getPorts = () => (ports.current ??= portsOf(source, product, approvers));
  const list = useApprovers(approvers, () => getPorts().approvers);

  const save = async (draft: PitchSettings) => {
    dispatch({ type: 'busy' });
    const saved = await getPorts().products.setPitch(product.id, draft);
    dispatch(saved.ok ? { type: 'saved', pitch: saved.pitch } : { type: 'refused', message: saved.message });
  };
  const upload = async (target: AssetTarget, file: File) => {
    dispatch({ type: 'busy' });
    const sent = await getPorts().assets.upload(target, file);
    dispatch(sent.ok ? { type: 'uploaded', target, asset: sent.asset } : { type: 'refused', message: sent.message });
  };

  const on: PitchHandlers = {
    edit: (draft) => { dispatch({ type: 'edit', draft }); },
    preset: (preset) => { dispatch({ type: 'preset', preset }); },
    upload: (target, file) => { if (!state.busy) void upload(target, file); },
    save: () => { if (!state.busy) void save(state.draft); },
    reset: () => { dispatch({ type: 'reset' }); },
  };

  return (
    <div className="ask-col products">
      <ProductHead name={product.name} />
      <PitchSection state={state} editable={editable} on={on} />
      <ApproversSection form={list.form} on={list.on} />
    </div>
  );
}
