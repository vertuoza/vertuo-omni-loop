import type { DossierView } from './view';

// The PRD page marks its PRD seen (PRD 579, s1), so its New documents group leaves the bell at the
// next read: on mount, and again each time the versions it renders change while it is open. What the
// page renders of its versions is told by each kept artifact's version count (omni-loop-20 s7: the
// before/after page, the spec and the plan sit in the Specifications tab, no longer a tab each):
// versions are only ever added, so each artifact's latest number moves exactly when a new one lands.

const ARTIFACTS = ['before-after', 'spec', 'plan'] as const;

/** The rendered versions' signature: each kept artifact's latest version, `-` when it has none. */
export const seenSignature = (latest: DossierView['latest']): string =>
  ARTIFACTS.map((kind) => `${kind}:${latest[kind] ? `v${String(latest[kind])}` : '-'}`).join('|');

/** Marks `id` seen the first time it is told a signature, and again each time the signature changes. */
export function seenWatch(id: string, mark: (id: string) => void): (signature: string) => void {
  let last: string | null = null;
  return (signature) => {
    if (signature === last) return;
    last = signature;
    mark(id);
  };
}
