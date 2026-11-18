import { Button } from './Button.tsx';
import { ErrorState } from './ErrorState.tsx';
import { ERROR_STATE_SIZES } from './ErrorState.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An ErrorState at each size, with its one action. */
export const errorStateSpecimen: Specimen = (_prop, value) => (
  <ErrorState title="The plan did not load" size={one(ERROR_STATE_SIZES, value)} action={<Button variant="secondary">Try again</Button>}>
    The server did not answer, so the slices below are out of date.
  </ErrorState>
);
