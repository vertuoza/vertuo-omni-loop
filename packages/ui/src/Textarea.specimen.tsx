import { Textarea } from './Textarea.tsx';
import type { Specimen } from './meta.ts';

/** A Textarea with one closed prop at the given value, the rest at their defaults. */
export const textareaSpecimen: Specimen = (prop, value) => (
  <Textarea label="Example" placeholder="Type here" invalid={prop === 'invalid' && value === 'true'} disabled={prop === 'disabled' && value === 'true'} />
);
