import { Card } from './Card.tsx';
import { CARD_PADDINGS, CARD_SURFACES } from './Card.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Card on each surface, at each padding. */
export const cardSpecimen: Specimen = (prop, value) => (
  <Card
    {...(prop === 'surface' ? { surface: one(CARD_SURFACES, value) } : {})}
    {...(prop === 'padding' ? { padding: one(CARD_PADDINGS, value) } : {})}
  >
    What the PRD changes.
  </Card>
);
