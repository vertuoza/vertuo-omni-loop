import { useId } from 'react';
import type { ReactNode } from 'react';
import './SettingsRow.css';

export type SettingsRowProps = {
  /** What the setting is called. */
  label: ReactNode;
  /** Read only: the control is shown as a value and cannot be changed. */
  readOnly?: boolean;
  /** Why it is read only, in words: shown beside the control when `readOnly`. */
  reason?: ReactNode;
  /** The control, or the value, of the setting. */
  children?: ReactNode;
};

/** One setting: its label, its control and, when it cannot be changed, the reason in words. */
export function SettingsRow({ label, readOnly = false, reason, children }: SettingsRowProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const reasonId = `${id}-reason`;
  const says = readOnly && reason !== undefined;
  return (
    <div className={`omni-settings-row omni-settings-row--${readOnly ? 'read-only' : 'editable'}`}>
      <span className="omni-settings-row__label" id={labelId}>
        {label}
      </span>
      <div className="omni-settings-row__control">
        <div role="group" aria-labelledby={labelId} {...(says ? { 'aria-describedby': reasonId } : {})}>
          {children}
        </div>
        {says ? (
          <p className="omni-settings-row__reason" id={reasonId}>
            Read only: {reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
