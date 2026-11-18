'use client';

import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Input.css';
import type { INPUT_TYPES } from './Input.meta.ts';

export type InputProps = {
  /** The accessible name when the Input stands alone; inside a Field the Field's label names it. */
  label?: string;
  type?: (typeof INPUT_TYPES)[number];
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Marks the value wrong; inside a Field the Field's `error` does it. */
  invalid?: boolean;
};

/** A single line of text; inside a Field it takes its id, its description and its error from it. */
export function Input({ label, type = 'text', name, value, defaultValue, placeholder, onChange, disabled = false, readOnly = false, required = false, invalid = false }: InputProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  return (
    <input
      className="omni-input"
      type={type}
      id={field?.id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
      required={required || field?.required === true}
      aria-label={field === null ? label : undefined}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid ? true : undefined}
    />
  );
}
