'use client';

import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Input.css';
import './Select.css';

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  /** The accessible name when the Select stands alone; inside a Field the Field's label names it. */
  label?: string;
  options: readonly SelectOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
};

/** One choice out of a list, in the browser's own picker; inside a Field it takes its id, its description and its error from it. */
export function Select({ label, options, name, value, defaultValue, onChange, disabled = false, required = false, invalid = false }: SelectProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  return (
    <span className="omni-select">
      <select
        className="omni-input omni-select__control"
        id={field?.id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        required={required || field?.required === true}
        aria-label={field === null ? label : undefined}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid ? true : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </span>
  );
}
