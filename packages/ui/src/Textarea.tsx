'use client';

import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Input.css';
import './Textarea.css';

export type TextareaProps = {
  /** The accessible name when the Textarea stands alone; inside a Field the Field's label names it. */
  label?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  /** How many lines tall it starts. */
  rows?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
};

/** Several lines of text; inside a Field it takes its id, its description and its error from it. */
export function Textarea({ label, name, value, defaultValue, placeholder, onChange, rows = 4, disabled = false, readOnly = false, required = false, invalid = false }: TextareaProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  return (
    <textarea
      className="omni-input omni-textarea"
      id={field?.id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onChange}
      rows={rows}
      disabled={disabled}
      readOnly={readOnly}
      required={required || field?.required === true}
      aria-label={field === null ? label : undefined}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid ? true : undefined}
    />
  );
}
