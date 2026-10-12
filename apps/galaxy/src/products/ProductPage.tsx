'use client';
import { useReducer, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import type { PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { repositoriesTabHref } from '../product-repositories/repositories-tab.contract';
import { PRODUCTS_HREF, type PitchedProduct } from './model';
import { PitchSection, type PitchHandlers } from './pitch-form';
import { databaseAssets, demoAssets, PITCH_ASSETS_BUCKET, type AssetsPort } from './pitch-form-assets';
import { initialPitchForm, pitchFormReducer, type AssetTarget } from './pitch-form-model';
import { databaseProducts, demoProductsPort, type ProductsPort } from './store';

// A product's page in the browser (PRD 859 s1, PRD 1108 s2): its name and its Pitch section. Keeps the
// Pitch section's state (pitch-form-model.ts), saves the draft through set_pitch_settings() as the
// signed-in person (store.ts) and uploads a file into the `pitch-assets` bucket (pitch-form-assets.ts),
// one call at a time; the section draws each step. Its Approvers list (PRD 1322 s1) moved to the product
// home's Repositories & approvers tab (PRD 1364 s11): the page says so and links there, so a bookmark to
// the old section still finds it. In the demo, the same rules run in memory.

export type ProductsSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface ProductPageProps {
  source: ProductsSource;
  editable: boolean;
  product: PitchedProduct;
}

type Ports = { products: ProductsPort; assets: AssetsPort };

function portsOf(source: ProductsSource, product: PitchedProduct): Ports {
  if (source.kind === 'demo') return { products: demoProductsPort([product]), assets: demoAssets() };
  const db = createBrowserClient(source.url, source.key);
  return {
    products: databaseProducts(db, source.workspace),
    assets: databaseAssets(db.storage.from(PITCH_ASSETS_BUCKET), source.workspace, product.id),
  };
}

const APPROVERS_MOVED = 'Who approves this product’s PRDs is set on its home, under Repositories & approvers.';

/** Where the Approvers list went (PRD 1364 s11): the product home's Repositories & approvers tab. */
function ApproversMoved({ product }: { product: string }) {
  return (
    <section className="ask-card products-section" aria-labelledby="approvers-title">
      <h2 id="approvers-title">Approvers</h2>
      <p className="ask-muted">{APPROVERS_MOVED}</p>
      <Link href={repositoriesTabHref(product)}>Open Repositories &amp; approvers →</Link>
    </section>
  );
}

function ProductHead({ name }: { name: string }) {
  return (
    <section className="ask-card products-head" aria-labelledby="product-title">
      <Link className="products-back" href={PRODUCTS_HREF}>← Products</Link>
      <h1 id="product-title">{name}</h1>
    </section>
  );
}

export function ProductPage({ source, editable, product }: ProductPageProps) {
  const [state, dispatch] = useReducer(pitchFormReducer, product.pitch, initialPitchForm);
  const ports = useRef<Ports | null>(null);
  const getPorts = () => (ports.current ??= portsOf(source, product));

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
      <ApproversMoved product={product.id} />
    </div>
  );
}
