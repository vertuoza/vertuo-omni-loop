'use client';

import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Checkbox.css';

export type CheckboxProps = {
  /** The accessible name when the Checkbox stands alone; inside a Field the Field's label names it. */
  label?: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  required?: boolean;
  /** Marks the choice wrong; inside a Field the Field's `error` does it. */
  invalid?: boolean;
};

/** A yes or no choice the person ticks; Space toggles it. Inside a Field it takes its id, its description and its error from it. */
export function Checkbox({ label, name, checked, defaultChecked, onChange, disabled = false, required = false, invalid = false }: CheckboxProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  return (
    <input
      className="omni-checkbox"
      type="checkbox"
      id={field?.id}
      name={name}
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={onChange}
      disabled={disabled}
      required={required || field?.required === true}
      aria-label={field === null ? label : undefined}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid ? true : undefined}
    />
  );
}
