import { Field } from './Field.tsx';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';
import { Radio } from './Radio.tsx';
import { RADIO_ORIENTATIONS } from './Radio.meta.ts';

const options = [
  { value: 'team', label: 'Team' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'public', label: 'Public' },
];

/** A Radio in a Field with one closed prop at the given value, the rest at their defaults. */
export const radioSpecimen: Specimen = (prop, value) => (
  <Field label="Who can see it" hint="You can change it later.">
    <Radio
      label="Who can see it"
      name="who"
      options={options}
      defaultValue="team"
      orientation={prop === 'orientation' ? one(RADIO_ORIENTATIONS, value) : 'vertical'}
      invalid={prop === 'invalid' && value === 'true'}
      disabled={prop === 'disabled' && value === 'true'}
    />
  </Field>
);
