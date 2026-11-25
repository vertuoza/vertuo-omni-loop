import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SETTINGS_FIELD_PERMISSIONS = ['allowed', 'disabled'] as const;
export const SETTINGS_FIELD_ERRORS = ['shown', 'none'] as const;

export const settingsFieldMeta = {
  name: 'SettingsField',
  variants: { permission: SETTINGS_FIELD_PERMISSIONS, error: SETTINGS_FIELD_ERRORS },
  usage: 'The label, the help and the error of one setting, and the words it says when the viewer is not an owner: put one control inside it.',
  do: ['Say what the setting does in the help.', 'Set disabledByPermission when the viewer is not an owner: it says so in words.'],
  dont: ['Put more than one control in it.', 'Show a disabled control with no reason.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')],
    'error=shown': onSurfaces('danger'),
  },
  accessibility: [
    'Built on Field: the label names the control, the help and the error describe it, an error sets `aria-invalid`.',
    'Disabled by permission, the control is disabled and described by "Read only: you are not an owner", written out as text, never colour alone.',
  ],
  replaces: ['settings-field', 'setting-input'],
  example: '<SettingsField label="Name" help="As it shows on the page." disabledByPermission={!isOwner}><Input name="name" /></SettingsField>',
} satisfies ComponentMeta;
