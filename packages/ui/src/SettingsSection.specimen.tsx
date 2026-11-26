import { SettingsRow } from './SettingsRow.tsx';
import { SettingsSection } from './SettingsSection.tsx';
import { SETTINGS_SECTION_DESCRIPTIONS } from './SettingsSection.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SettingsSection with and without its description, over two rows. */
export const settingsSectionSpecimen: Specimen = (prop, value) => (
  <SettingsSection
    title="Access"
    {...(prop === 'description' && one(SETTINGS_SECTION_DESCRIPTIONS, value) === 'shown' ? { description: 'Who can open the workspace.' } : {})}
  >
    <SettingsRow label="Visibility">Private</SettingsRow>
    <SettingsRow label="Invitations">Owners only</SettingsRow>
  </SettingsSection>
);
