import type { TabEntry } from './view';

// The PRD page marks its PRD seen (PRD 579, s1), so its New documents group leaves the bell at the
// next read: on mount, and again each time the versions it renders change while it is open. What the
// page renders of its versions is told by its artifact tabs' badges (`v3`): versions are only ever
// added, so each artifact's latest number moves exactly when a new one lands.

const ARTIFACTS = new Set<TabEntry['kind']>(['spec', 'plan', 'before-after']);

/** The rendered versions' signature: each artifact tab's latest version, `-` when it has none. */
export const seenSignature = (tabs: readonly TabEntry[]): string =>
  tabs.filter((t) => ARTIFACTS.has(t.kind)).map((t) => `${t.kind}:${t.badge ?? '-'}`).join('|');

/** Marks `id` seen the first time it is told a signature, and again each time the signature changes. */
export function seenWatch(id: string, mark: (id: string) => void): (signature: string) => void {
  let last: string | null = null;
  return (signature) => {
    if (signature === last) return;
    last = signature;
    mark(id);
  };
}
