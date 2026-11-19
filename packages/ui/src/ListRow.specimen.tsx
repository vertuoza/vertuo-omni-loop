import { ListRow } from './ListRow.tsx';
import { LIST_ROW_DENSITIES } from './ListRow.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A ListRow at each density, as a link and as plain content. */
export const listRowSpecimen: Specimen = (prop, value) => (
  <ListRow
    title="AC-1 tokens are generated"
    detail="test"
    trailing="Passing"
    {...(prop === 'link' && value === 'true' ? { href: '#row' } : {})}
    {...(prop === 'density' ? { density: one(LIST_ROW_DENSITIES, value) } : {})}
  />
);
