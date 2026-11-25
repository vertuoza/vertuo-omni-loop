import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SETTINGS_SECTION_DESCRIPTIONS = ['shown', 'none'] as const;

export const settingsSectionMeta = {
  name: 'SettingsSection',
  variants: { description: SETTINGS_SECTION_DESCRIPTIONS },
  usage: 'A group of settings rows under one heading.',
  do: ['Group the settings that belong together, one SettingsRow each.', 'Give every group a heading in words.'],
  dont: ['Nest a SettingsSection in another.', 'Put anything but SettingsRow parts in it.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: ['The group is found in the heading outline, at level 2, below the page title.'],
  replaces: ['settings-section', 'settings-group'],
  example: '<SettingsSection title="Access" description="Who can open the workspace."><SettingsRow label="Visibility">…</SettingsRow></SettingsSection>',
} satisfies ComponentMeta;
