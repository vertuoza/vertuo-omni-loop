import { Input } from './Input.tsx';
import { INPUT_TYPES } from './Input.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An Input with one closed prop at the given value, the rest at their defaults. */
export const inputSpecimen: Specimen = (prop, value) => (
  <Input
    label="Example"
    placeholder="Type here"
    type={prop === 'type' ? one(INPUT_TYPES, value) : 'text'}
    invalid={prop === 'invalid' && value === 'true'}
    disabled={prop === 'disabled' && value === 'true'}
  />
);
