import { EmptyState } from './EmptyState.tsx';
import { EMPTY_STATE_SIZES } from './EmptyState.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An EmptyState at each size. */
export const emptyStateSpecimen: Specimen = (_prop, value) => (
  <EmptyState title="No questions yet" size={one(EMPTY_STATE_SIZES, value)}>
    Questions appear once the plan is read.
  </EmptyState>
);
