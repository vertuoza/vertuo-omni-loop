'use client';

import { useId } from 'react';
import type { ChangeEventHandler } from 'react';
import { useFieldControl } from './Field.tsx';
import './Radio.css';
import type { RADIO_ORIENTATIONS } from './Radio.meta.ts';

export type RadioOption = {
  value: string;
  label: string;
};

export type RadioProps = {
  /** The accessible name of the group. */
  label: string;
  /** The `name` the radios share. */
  name?: string;
  options: readonly RadioOption[];
  /** The `value` chosen, when the caller keeps it. */
  value?: string;
  /** The `value` the group starts on when it keeps the choice itself. */
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  orientation?: (typeof RADIO_ORIENTATIONS)[number];
  disabled?: boolean;
  required?: boolean;
  /** Marks the choice wrong; inside a Field the Field's `error` does it. */
  invalid?: boolean;
};

/** One choice out of a few, each its own radio; the arrow keys move the choice. Inside a Field it takes its description and its error from it. */
export function Radio({ label, name, options, value, defaultValue, onChange, orientation = 'vertical', disabled = false, required = false, invalid = false }: RadioProps) {
  const field = useFieldControl();
  const own = useId();
  const group = name ?? own;
  const isInvalid = invalid || field?.invalid === true;
  return (
    <div
      className={`omni-radio-group omni-radio-group--${orientation}`}
      role="radiogroup"
      id={field?.id}
      aria-label={label}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid ? true : undefined}
      aria-required={required || field?.required === true ? true : undefined}
    >
      {options.map((option) => (
        <label key={option.value} className="omni-radio-option">
          <input
            className="omni-radio"
            type="radio"
            name={group}
            value={option.value}
            checked={value === undefined ? undefined : value === option.value}
            defaultChecked={value === undefined && defaultValue !== undefined ? defaultValue === option.value : undefined}
            onChange={onChange}
            disabled={disabled}
            required={required || field?.required === true}
            aria-invalid={isInvalid ? true : undefined}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
