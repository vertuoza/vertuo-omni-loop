'use client';

import { useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import './SegmentedControl.css';
import type { SEGMENTED_SIZES } from './SegmentedControl.meta.ts';

export type SegmentOption = {
  id: string;
  label: ReactNode;
};

export type SegmentedControlProps = {
  /** The accessible name of the group. */
  label: string;
  options: readonly SegmentOption[];
  /** The `id` of the chosen option, when the caller keeps it. */
  value?: string;
  /** The `id` the control starts on when it keeps the choice itself (the caller then gives no `value`). */
  defaultValue?: string;
  onChange?: (id: string) => void;
  size?: (typeof SEGMENTED_SIZES)[number];
};

/** One choice out of a few, side by side; the arrow keys move the choice, as a radio group's do. */
export function SegmentedControl({ label, options, value: given, defaultValue, onChange, size = 'md' }: SegmentedControlProps) {
  const [kept, setKept] = useState(defaultValue ?? options[0]?.id ?? '');
  const value = given ?? kept;
  const choose = (id: string) => {
    setKept(id);
    onChange?.(id);
  };
  const move = (event: KeyboardEvent<HTMLElement>, step: number | 'first' | 'last') => {
    event.preventDefault();
    const at = options.findIndex((option) => option.id === value);
    const next = step === 'first' ? 0 : step === 'last' ? options.length - 1 : (at + step + options.length) % options.length;
    const target = options[next];
    if (target === undefined) return;
    choose(target.id);
    const radios = event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
    radios[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(event, 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(event, -1);
    else if (event.key === 'Home') move(event, 'first');
    else if (event.key === 'End') move(event, 'last');
  };
  const chosen = options.some((option) => option.id === value) ? value : options[0]?.id;
  return (
    <div className={`omni-segmented omni-segmented--${size}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === chosen ? 0 : -1}
          className={option.id === value ? 'omni-segment omni-segment--chosen' : 'omni-segment'}
          onClick={() => { choose(option.id); }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
