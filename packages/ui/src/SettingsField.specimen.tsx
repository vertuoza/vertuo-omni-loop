import { Input } from './Input.tsx';
import { SettingsField } from './SettingsField.tsx';
import { SETTINGS_FIELD_ERRORS, SETTINGS_FIELD_PERMISSIONS } from './SettingsField.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SettingsField around an Input; `permission` and `error` follow the variant, the other at its default. */
export const settingsFieldSpecimen: Specimen = (prop, value) => (
  <SettingsField
    label="Name"
    help="As it shows on the page."
    disabledByPermission={prop === 'permission' && one(SETTINGS_FIELD_PERMISSIONS, value) === 'disabled'}
    {...(prop === 'error' && one(SETTINGS_FIELD_ERRORS, value) === 'shown' ? { error: 'Enter a name.' } : {})}
  >
    <Input name="name" />
  </SettingsField>
);
