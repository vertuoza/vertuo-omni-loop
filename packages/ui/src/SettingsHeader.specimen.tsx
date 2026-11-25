import { SettingsHeader } from './SettingsHeader.tsx';
import { SETTINGS_HEADER_DESCRIPTIONS } from './SettingsHeader.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SettingsHeader with and without its description. */
export const settingsHeaderSpecimen: Specimen = (prop, value) => (
  <SettingsHeader
    title="Workspace settings"
    {...(prop === 'description' && one(SETTINGS_HEADER_DESCRIPTIONS, value) === 'shown' ? { description: 'Who can see the workspace and how it is billed.' } : {})}
  />
);
