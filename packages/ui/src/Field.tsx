'use client';

import { createContext, useContext, useId } from 'react';
import type { ReactNode } from 'react';
import './Field.css';

/** What a control inside a Field takes from it: its id, what describes it, and whether it is in error. */
export type FieldControl = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldControl | null>(null);

/** The Field a control sits in, or `null` when it stands alone (then it needs its own `label`). */
export function useFieldControl(): FieldControl | null {
  return useContext(FieldContext);
}

export type FieldProps = {
  /** The visible name of the control: always shown, never replaced by a placeholder. */
  label: string;
  /** Help that comes before the person types. */
  hint?: string;
  /** What is wrong, in words; its presence marks the control invalid. */
  error?: string;
  required?: boolean;
  /** The control: an Input, a Textarea or a Select. */
  children?: ReactNode;
};

/** A label, an optional hint and an optional error tied to the one control inside: `for`, `aria-describedby`, `aria-invalid`. */
export function Field({ label, hint, error, required = false, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId].filter((part) => part !== null).join(' ');
  const control: FieldControl = { id, describedBy: describedBy === '' ? undefined : describedBy, invalid: error !== undefined, required };
  return (
    <div className="omni-field">
      <label className="omni-field__label" htmlFor={id}>
        {label}
        {required ? <span className="omni-field__required"> (required)</span> : null}
      </label>
      {hint === undefined ? null : <p className="omni-field__hint" id={hintId}>{hint}</p>}
      <FieldContext.Provider value={control}>{children}</FieldContext.Provider>
      {error === undefined ? null : <p className="omni-field__error" id={errorId}>{error}</p>}
    </div>
  );
}
