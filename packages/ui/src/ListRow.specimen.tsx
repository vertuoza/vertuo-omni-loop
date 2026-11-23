import { ListRow } from './ListRow.tsx';
import { LIST_ROW_CLAMPS, LIST_ROW_DENSITIES } from './ListRow.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A ListRow at each density, as a link and as plain content, then each opt-in: selected, a leading mark, a clamp. */
export const listRowSpecimen: Specimen = (prop, value) => (
  <ListRow
    title={prop === 'clamp' ? 'AC-1 tokens are generated from the one file the design system keeps, and every part reads them from there, never from a copy' : 'AC-1 tokens are generated'}
    detail="test"
    trailing="Passing"
    {...(prop === 'link' && value === 'true' ? { href: '#row' } : {})}
    {...(prop === 'density' ? { density: one(LIST_ROW_DENSITIES, value) } : {})}
    {...(prop === 'selected' && value === 'true' ? { selected: true } : {})}
    {...(prop === 'leading' && value === 'true' ? { leading: <span aria-hidden="true">✓</span> } : {})}
    {...(prop === 'clamp' ? { clamp: LIST_ROW_CLAMPS.find((n) => String(n) === value) ?? 1 } : {})}
  />
);
