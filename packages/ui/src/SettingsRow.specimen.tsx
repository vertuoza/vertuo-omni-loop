import { SettingsRow } from './SettingsRow.tsx';
import { SETTINGS_ROW_STATES } from './SettingsRow.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SettingsRow editable, then read only with its reason. */
export const settingsRowSpecimen: Specimen = (prop, value) =>
  prop === 'state' && one(SETTINGS_ROW_STATES, value) === 'read-only' ? (
    <SettingsRow label="Visibility" readOnly reason="only an owner can change it.">
      Private
    </SettingsRow>
  ) : (
    <SettingsRow label="Visibility">Private</SettingsRow>
  );
