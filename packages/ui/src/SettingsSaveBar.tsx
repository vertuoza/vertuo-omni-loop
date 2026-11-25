import { Button } from './Button.tsx';
import './SettingsSaveBar.css';
import type { SETTINGS_SAVE_STATES } from './SettingsSaveBar.meta.ts';

export type SettingsSaveBarState = (typeof SETTINGS_SAVE_STATES)[number];

export type SettingsSaveBarProps = {
  /** Where the save is: exactly one is shown. */
  state: SettingsSaveBarState;
  /** Called by the save button. */
  onSave?: () => void;
  /** Called by the retry button, shown when the save failed. */
  onRetry?: () => void;
};

/** What each state says, in words. */
export const SAVE_BAR_WORDS: Record<SettingsSaveBarState, string> = {
  idle: 'You have unsaved changes.',
  saving: 'Saving…',
  saved: 'Saved.',
  failed: 'Not saved: the save failed.',
};

/** The bar that saves a settings page: one state at a time, said in words; a failed save offers a retry. */
export function SettingsSaveBar({ state, onSave, onRetry }: SettingsSaveBarProps) {
  return (
    <div className={`omni-settings-save-bar omni-settings-save-bar--${state}`}>
      <p className="omni-settings-save-bar__status" role="status">
        {SAVE_BAR_WORDS[state]}
      </p>
      <div className="omni-settings-save-bar__actions">
        {state === 'failed' ? <Button {...(onRetry === undefined ? {} : { onClick: onRetry })}>Retry</Button> : null}
        <Button variant="primary" disabled={state === 'saving'} {...(onSave === undefined ? {} : { onClick: onSave })}>
          Save
        </Button>
      </div>
    </div>
  );
}
