import { Checkbox } from './Checkbox.tsx';
import { Field } from './Field.tsx';
import type { Specimen } from './meta.ts';

/** A Checkbox in a Field with one closed prop at the given value, the rest at their defaults. */
export const checkboxSpecimen: Specimen = (prop, value) => (
  <Field label="Include archived" hint="Archived PRDs stay hidden otherwise.">
    <Checkbox
      name="archived"
      defaultChecked={prop === 'checked' && value === 'true'}
      invalid={prop === 'invalid' && value === 'true'}
      disabled={prop === 'disabled' && value === 'true'}
    />
  </Field>
);
