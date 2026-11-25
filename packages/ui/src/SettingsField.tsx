import type { ReactNode } from 'react';
import { Field } from './Field.tsx';
import './SettingsField.css';

export type SettingsFieldProps = {
  /** The visible name of the setting's control. */
  label: string;
  /** Help that says what the setting does. */
  help?: string;
  /** What is wrong, in words. */
  error?: string;
  /** The viewer is not an owner: the control is disabled and the field says so in words. */
  disabledByPermission?: boolean;
  /** The control: an Input, a Textarea or a Select. */
  children?: ReactNode;
};

/** The words a field says when the viewer may not change it. */
export const NOT_AN_OWNER = 'Read only: you are not an owner, so you cannot change this.';

/** A Field for a setting: label, help and error as Field wires them, plus the disabled-by-permission state. */
export function SettingsField({ label, help, error, disabledByPermission = false, children }: SettingsFieldProps) {
  const hint = [help, disabledByPermission ? NOT_AN_OWNER : undefined].filter((part) => part !== undefined).join(' ');
  const field = (
    <Field label={label} {...(hint === '' ? {} : { hint })} {...(error === undefined ? {} : { error })}>
      {children}
    </Field>
  );
  return disabledByPermission ? (
    <fieldset className="omni-settings-field omni-settings-field--disabled" disabled>
      {field}
    </fieldset>
  ) : (
    <div className="omni-settings-field">{field}</div>
  );
}
