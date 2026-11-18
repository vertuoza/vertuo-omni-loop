import { Field } from './Field.tsx';
import { FIELD_ERRORS, FIELD_REQUIRED } from './Field.meta.ts';
import { Input } from './Input.tsx';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Field around an Input, with its hint; `required` and `error` follow the variant, the other at its default. */
export const fieldSpecimen: Specimen = (prop, value) => (
  <Field
    label="Name"
    hint="As it shows on the page."
    required={prop === 'required' && one(FIELD_REQUIRED, value) === 'true'}
    {...(prop === 'error' && one(FIELD_ERRORS, value) === 'shown' ? { error: 'Enter a name.' } : {})}
  >
    <Input name="name" />
  </Field>
);
