import { Select } from './Select.tsx';
import type { Specimen } from './meta.ts';

const options = [
  { value: 'dev', label: 'Developer' },
  { value: 'pm', label: 'Product' },
  { value: 'design', label: 'Design' },
];

/** A Select with one closed prop at the given value, the rest at their defaults. */
export const selectSpecimen: Specimen = (prop, value) => (
  <Select label="Example" options={options} invalid={prop === 'invalid' && value === 'true'} disabled={prop === 'disabled' && value === 'true'} />
);
