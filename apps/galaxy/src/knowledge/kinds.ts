import { KINDS, type EntryKind } from '../data/knowledge';
import type { TokenName } from '../ask/theme-tokens';

// Each kind's colour on the /knowledge page: purple principles, teal rules, red invariants, as the
// phase-0 page drew them. Each is one of the ask pages' theme tokens, so it follows the light and the
// dark theme; kinds.test.ts holds each at 3:1 against the ground and the surfaces a dot sits on. The
// page's stylesheet reads the colour of the kind in hand as `--km-kind`.

export const KIND_TOKEN: Record<EntryKind, TokenName> = { principle: 'plasma', rule: 'cyan', invariant: 'red' };

/** Where a kind's colour is drawn: the page's ground, and the cards the diagram and the panel sit on. */
export const KIND_GROUNDS: TokenName[] = ['ground', 'surface'];

export const KIND_LABEL: Record<EntryKind, string> = { principle: 'principle', rule: 'rule', invariant: 'invariant' };

const variable = (name: TokenName) => `--ask-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** `--km-kind` for every element marked with a kind. */
export function kindCss(): string {
  return KINDS.map((kind) => `[data-kind="${kind}"] { --km-kind: var(${variable(KIND_TOKEN[kind])}); }`).join('\n');
}
