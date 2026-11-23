'use client';
import { Select } from '@omni/ui';
import { useEffect, useState } from 'react';
import { DefinitionList } from '@omni/ui';
import { productClient } from '../product/product.client';
import type { ProductPick } from '../product/product.contract';

// The PRD page's Product picker (PRD 1364 s7), first of About this PRD (omni-loop-20 s6): the workspace's products and No
// product, the PRD's own selected. Any member changes it until the PRD is approved; once an approval is in
// force it is disabled, with `product is locked: PRD <n> is approved` beside it, and a void enables it
// again. It reads and writes through the picker's route (src/dossier/product/), once the page runs: the
// fact shows once read, so the server's render of About this PRD is as before. A person the route
// refuses (signed out, or not a member) sees no fact. A change the route refuses puts the PRD's product
// back and shows the route's own words.

const client = productClient();

/** The option picked, as a product id, or null for No product. */
export const productChoice = (value: string): string | null => (value === '' ? null : value);

type FieldProps = {
  pick: ProductPick;
  busy: boolean;
  problem: string | null;
  onPick: (product: string | null) => void;
};

/** The picker, as it reads: its select, then the lock or a refusal. */
export function ProductField({ pick, busy, problem, onPick }: FieldProps) {
  return (
    <>
      <Select
        size="sm"
        label="Product"
        value={pick.product?.id ?? ''}
        disabled={busy || pick.locked !== null}
        onValueChange={(id) => { onPick(productChoice(id)); }}
        options={[{ value: '', label: 'No product' }, ...pick.products.map((product) => ({ value: product.id, label: product.name }))]}
      />
      {pick.locked && <p className="ask-hint">{pick.locked}</p>}
      {problem && <span className="ask-problem" role="alert">{problem}</span>}
    </>
  );
}

/** The Product fact of About this PRD. */
export function ProductPicker({ dossier }: { dossier: string }) {
  const [pick, setPick] = useState<ProductPick | null | 'reading' | 'unread'>('reading');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client.read(dossier).then((read) => { if (live) setPick(read); }, () => { if (live) setPick('unread'); });
    return () => { live = false; };
  }, [dossier]);

  if (pick === null || pick === 'reading') return null;

  async function change(current: ProductPick, product: string | null) {
    setBusy(true);
    setProblem(null);
    const answer = await client.change(dossier, product);
    if (answer.ok) setPick({ ...current, product: answer.product });
    else if (answer.locked) setPick({ ...current, locked: answer.error });
    else setProblem(answer.error);
    setBusy(false);
  }

  const value = pick === 'unread'
    ? <span className="ask-problem" role="alert">The product could not be read. Reload the page in a moment.</span>
    : <ProductField pick={pick} busy={busy} problem={problem} onPick={(product) => { void change(pick, product); }} />;
  return <DefinitionList density="compact" facts={[{ id: 'product', label: 'Product', value }]} />;
}
