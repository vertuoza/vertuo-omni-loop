'use client';

import { useState } from 'react';
import type { ElementType, KeyboardEvent, ReactNode } from 'react';
import './SegmentedControl.css';
import type { SEGMENTED_SIZES } from './SegmentedControl.meta.ts';

export type SegmentOption = {
  id: string;
  label: ReactNode;
  /** Where the segment leads: given on every option, the control is a set of links (sub-views, versions), not a choice. */
  href?: string;
};

/** What a segment hands the link that draws it: the app's router link takes the same props as an `<a>`. */
type SegmentLinkAttributes = {
  className: string;
  href: string;
  tabIndex: number;
  'aria-current'?: 'page' | undefined;
  children?: ReactNode;
};

export type SegmentedControlProps = {
  /** The accessible name of the group. */
  label: string;
  options: readonly SegmentOption[];
  /** The `id` of the chosen option (of the current link), when the caller keeps it. */
  value?: string;
  /** The `id` the control starts on when it keeps the choice itself (the caller then gives no `value`). */
  defaultValue?: string;
  onChange?: (id: string) => void;
  size?: (typeof SEGMENTED_SIZES)[number];
  /** The link each segment is drawn with when the options have an `href`: the app's router link. A plain `<a>` by default. */
  link?: ElementType<SegmentLinkAttributes>;
};

/** Where an arrow key, Home or End moves from `at` among `count` segments; null for any other key. */
function nextIndex(key: string, at: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (at + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (at - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * One choice out of a few, side by side, as one control: a radio group whose arrow keys move the choice,
 * or, when every option has an `href`, a group of links whose arrow keys move the focus, the current
 * one marked aria-current.
 */
export function SegmentedControl({ label, options, value: given, defaultValue, onChange, size = 'md', link: Link = 'a' }: SegmentedControlProps) {
  const [kept, setKept] = useState(defaultValue ?? options[0]?.id ?? '');
  const value = given ?? kept;
  const chosen = options.some((option) => option.id === value) ? value : options[0]?.id;
  const className = `omni-segmented omni-segmented--${size}`;
  const segmentClass = (id: string) => (id === value ? 'omni-segment omni-segment--chosen' : 'omni-segment');

  if (options.length > 0 && options.every((option) => option.href !== undefined)) {
    const onLinkKey = (event: KeyboardEvent<HTMLElement>) => {
      const links = [...event.currentTarget.querySelectorAll<HTMLElement>('a')];
      const next = nextIndex(event.key, links.findIndex((a) => a === document.activeElement), links.length);
      if (next === null) return;
      event.preventDefault();
      links[next]?.focus();
    };
    return (
      <div className={className} role="group" aria-label={label} onKeyDown={onLinkKey}>
        {options.map((option) => (
          <Link
            key={option.id}
            className={segmentClass(option.id)}
            href={option.href ?? ''}
            tabIndex={option.id === chosen ? 0 : -1}
            aria-current={option.id === value ? 'page' : undefined}
          >
            {option.label}
          </Link>
        ))}
      </div>
    );
  }

  const choose = (id: string) => {
    setKept(id);
    onChange?.(id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = nextIndex(event.key, options.findIndex((option) => option.id === value), options.length);
    if (next === null) return;
    event.preventDefault();
    const target = options[next];
    if (target === undefined) return;
    choose(target.id);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div className={className} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === chosen ? 0 : -1}
          className={segmentClass(option.id)}
          onClick={() => { choose(option.id); }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
