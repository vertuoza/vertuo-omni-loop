import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SETTINGS_ROW_STATES = ['editable', 'read-only'] as const;

export const settingsRowMeta = {
  name: 'SettingsRow',
  variants: { state: SETTINGS_ROW_STATES },
  usage: 'One setting of a settings page: its label, its control and, when it cannot be changed, the reason in words.',
  do: ['Say why a row is read only, in words, beside it.', 'Put one control or one value in a row.'],
  dont: ['Show a read-only row by colour alone.', 'Put a row outside a SettingsSection.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'The control sits in a group named by the label.',
    'A read-only row is described by its reason, written out as text starting "Read only:", never colour alone.',
  ],
  replaces: ['settings-row', 'setting-item'],
  example: '<SettingsRow label="Visibility" readOnly reason="only an owner can change it">Private</SettingsRow>',
} satisfies ComponentMeta;
