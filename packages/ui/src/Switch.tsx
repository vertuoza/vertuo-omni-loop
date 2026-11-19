'use client';

import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Switch.css';

export type SwitchProps = {
  /** The accessible name when the Switch stands alone; inside a Field the Field's label names it. */
  label?: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
};

/** A setting that is on or off and acts at once; Space toggles it. Inside a Field it takes its id and description from it. */
export function Switch({ label, name, checked, defaultChecked, onChange, disabled = false }: SwitchProps) {
  const field = useFieldControl();
  return (
    <input
      className="omni-switch"
      type="checkbox"
      role="switch"
      id={field?.id}
      name={name}
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={onChange}
      disabled={disabled}
      aria-label={field === null ? label : undefined}
      aria-describedby={field?.describedBy}
    />
  );
}
