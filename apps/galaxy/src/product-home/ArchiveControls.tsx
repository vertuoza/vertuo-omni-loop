'use client';
import { useState } from 'react';
import { archiveConfirm } from './archive';
import { productArchiveClient, type ProductArchivePort } from './product-archive.client';

// The product home's Archive and Restore (PRD 2232 s1), a workspace owner's only. Archive asks first with
// the browser's own confirm, as PRD 2188's Remove does, naming the repositories that stop reading the
// product; cancelled, nothing changes; confirmed, the owner lands on /app/products. Restore, on an archived
// product's banner, brings it back and shows the live home again. A refusal shows beside the button, in
// the route's words. In the demo nothing is sent.

const PRODUCTS_HREF = '/app/products';
export const DEMO_CHANGES_NOTHING = 'The demo changes nothing: sign in to archive or restore a product.';

/** What a press needs from the browser: its confirm, the routes, and where to go once done. */
export interface PressDeps {
  confirm: (message: string) => boolean;
  port: () => ProductArchivePort;
  /** Leaves for `href`, or reloads the page when it is null. */
  go: (href: string | null) => void;
  demo: boolean;
}

/** Archive pressed: asks first; confirmed, archives and lands on the products page. Answers what to show
 * beside the button: a refusal, or null (cancelled, or gone). */
export async function pressArchive(name: string, repositories: readonly string[], deps: PressDeps): Promise<string | null> {
  if (!deps.confirm(archiveConfirm(name, repositories))) return null;
  if (deps.demo) return DEMO_CHANGES_NOTHING;
  const done = await deps.port().archive();
  if (!done.ok) return done.message;
  deps.go(PRODUCTS_HREF);
  return null;
}

/** Restore pressed: restores, then shows the live home again. Answers a refusal, or null. */
export async function pressRestore(deps: PressDeps): Promise<string | null> {
  if (deps.demo) return DEMO_CHANGES_NOTHING;
  const done = await deps.port().restore();
  if (!done.ok) return done.message;
  deps.go(null);
  return null;
}

/** The browser's own confirm, the product's routes, and its navigation. */
const browser = (product: string, demo: boolean): PressDeps => ({
  confirm: (message) => window.confirm(message),
  port: () => productArchiveClient(product),
  go: (href) => { if (href === null) window.location.reload(); else window.location.assign(href); },
  demo,
});

/** One button's press: busy while it runs, then the refusal it shows, if any. */
function usePress(run: () => Promise<string | null>) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const shown = await run();
    setProblem(shown);
    setBusy(false);
  };
  return { busy, problem, press: () => void press() };
}

const Problem = ({ problem }: { problem: string | null }) => (problem === null ? null : <span className="ask-problem" role="alert">{problem}</span>);

/** The head card's quiet Archive. */
export function ArchiveButton({ product, name, repositories, demo }: { product: string; name: string; repositories: readonly string[]; demo: boolean }) {
  const { busy, problem, press } = usePress(() => pressArchive(name, repositories, browser(product, demo)));
  return (
    <span className="product-home-archive">
      <button type="button" className="ask-button quiet product-home-archive-button" aria-label={`Archive ${name}`} disabled={busy} onClick={press}>
        {busy ? 'Archiving…' : 'Archive'}
      </button>
      <Problem problem={problem} />
    </span>
  );
}

/** The archived banner's Restore, the page's one primary action. */
export function RestoreButton({ product, name, demo }: { product: string; name: string; demo: boolean }) {
  const { busy, problem, press } = usePress(() => pressRestore(browser(product, demo)));
  return (
    <span className="product-home-restore">
      <button type="button" className="ask-button" aria-label={`Restore ${name}`} data-primary disabled={busy} onClick={press}>
        {busy ? 'Restoring…' : 'Restore'}
      </button>
      <Problem problem={problem} />
    </span>
  );
}
