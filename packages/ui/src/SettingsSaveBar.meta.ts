import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SETTINGS_SAVE_STATES = ['idle', 'saving', 'saved', 'failed'] as const;

export const settingsSaveBarMeta = {
  name: 'SettingsSaveBar',
  variants: { state: SETTINGS_SAVE_STATES },
  usage: 'The bar that saves a settings page: it says in words whether the page is unsaved, saving, saved or failed, and a failed save offers a retry.',
  do: ['Pass the one state the save is in.', 'Hand it onSave and onRetry: it loads and stores nothing itself.'],
  dont: ['Show two states at once.', 'Say a save worked or failed with colour alone.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')],
    'state=failed': onSurfaces('danger'),
  },
  accessibility: [
    'The state is written out as text in a `role="status"` region, so it is announced politely, never colour alone.',
    'While saving, the save button is disabled; when it failed, a Retry button is offered.',
  ],
  replaces: ['settings-save-bar', 'save-bar'],
  example: '<SettingsSaveBar state={state} onSave={save} onRetry={save} />',
} satisfies ComponentMeta;
