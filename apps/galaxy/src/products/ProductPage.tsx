'use client';
import { useReducer, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { initialProductState, productReducer, type PitchLook, type ProductRow } from './model';
import { ProductView } from './ProductsView';
import { databaseProducts, demoProductsPort, type ProductsPort } from './store';

// A product's page in the browser (PRD 859 s1): keeps the page's state (model.ts) and calls
// set_pitch_look() as the signed-in person (store.ts), one call at a time; the view draws each step.
// In the demo, the same rule runs in memory.

export type ProductsSource =
  | { kind: 'demo' }
  | { kind: 'database'; url: string; key: string; workspace: string };

export interface ProductPageProps {
  source: ProductsSource;
  editable: boolean;
  product: ProductRow;
}

export function ProductPage({ source, editable, product }: ProductPageProps) {
  const [state, dispatch] = useReducer(productReducer, product, initialProductState);
  const port = useRef<ProductsPort | null>(null);
  const getPort = () => (port.current ??= source.kind === 'demo'
    ? demoProductsPort([product])
    : databaseProducts(createBrowserClient(source.url, source.key), source.workspace));

  const setLook = async (look: PitchLook) => {
    if (state.busy || look === state.product.look) return;
    dispatch({ type: 'busy' });
    const saved = await getPort().setLook(state.product.id, look);
    dispatch(saved.ok ? { type: 'saved', product: saved.product } : { type: 'refused', message: saved.message });
  };

  return <ProductView state={state} editable={editable} onLook={(look) => void setLook(look)} />;
}
