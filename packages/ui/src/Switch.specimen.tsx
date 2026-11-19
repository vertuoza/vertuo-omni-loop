import { Field } from './Field.tsx';
import type { Specimen } from './meta.ts';
import { Switch } from './Switch.tsx';

/** A Switch in a Field with one closed prop at the given value, the rest at their defaults. */
export const switchSpecimen: Specimen = (prop, value) => (
  <Field label="Email me about the outbox" hint="One message a day at most.">
    <Switch
      name="email"
      defaultChecked={prop === 'checked' && value === 'true'}
      disabled={prop === 'disabled' && value === 'true'}
    />
  </Field>
);
