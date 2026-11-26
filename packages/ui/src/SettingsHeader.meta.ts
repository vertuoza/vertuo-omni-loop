import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SETTINGS_HEADER_DESCRIPTIONS = ['shown', 'none'] as const;

export const SETTINGS_HEADER_LEVELS = ['1', '2'] as const;

export const settingsHeaderMeta = {
  name: 'SettingsHeader',
  variants: { description: SETTINGS_HEADER_DESCRIPTIONS },
  usage: 'The title of a settings page and, optionally, one line saying what the page holds.',
  do: ['Use it once, at the top of a settings page.', 'Say in the description what a person can change here.'],
  dont: ['Use it for a section inside the page: use a SettingsSection.', 'Put actions in it: the save bar holds them.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: ['The title is the h1 of the page, so the outline of the page starts here; `level` 2 is for a header shown under another title, as on the design system page.'],
  replaces: ['settings-header', 'settings-title'],
  example: '<SettingsHeader title="Workspace settings" description="Who can see the workspace and how it is billed." />',
} satisfies ComponentMeta;
