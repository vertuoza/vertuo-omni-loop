import { SettingsSaveBar } from './SettingsSaveBar.tsx';
import { SETTINGS_SAVE_STATES } from './SettingsSaveBar.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SettingsSaveBar in the variant's state. */
export const settingsSaveBarSpecimen: Specimen = (_prop, value) => <SettingsSaveBar state={one(SETTINGS_SAVE_STATES, value)} />;
