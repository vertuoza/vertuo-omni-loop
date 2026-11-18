import { OutboxItem } from './OutboxItem.tsx';
import { OUTBOX_LEVELS } from './OutboxItem.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An OutboxItem at each level. */
export const outboxItemSpecimen: Specimen = (_prop, value) => (
  <OutboxItem level={one(OUTBOX_LEVELS, value)} title="Keep the old route?" detail="PRD 12 · s4" href="#outbox-1" />
);
