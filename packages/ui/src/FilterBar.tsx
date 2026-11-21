'use client';

import './FilterBar.css';
import { Field } from './Field.tsx';
import { Input } from './Input.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';
import type { SegmentOption } from './SegmentedControl.tsx';
import { Select } from './Select.tsx';
import type { SelectOption } from './Select.tsx';

export type FilterSelect = {
  label: string;
  name: string;
  options: readonly SelectOption[];
};

export type FilterBarProps = {
  /** The name of the group. */
  label: string;
  search?: { label: string; name?: string; placeholder?: string };
  selects?: readonly FilterSelect[];
  segments?: { label: string; options: readonly SegmentOption[]; defaultValue?: string };
  onSearch?: (value: string) => void;
  onSelect?: (name: string, value: string) => void;
  onSegment?: (id: string) => void;
};

/** The controls above a list: a search, selects and a segmented choice, each with its label. */
export function FilterBar({ label, search, selects = [], segments, onSearch, onSelect, onSegment }: FilterBarProps) {
  return (
    <div className="omni-filter-bar" role="group" aria-label={label}>
      {search === undefined ? null : (
        <div className="omni-filter-bar__search">
          <Field label={search.label}>
            <Input type="search" {...(search.name === undefined ? {} : { name: search.name })} {...(search.placeholder === undefined ? {} : { placeholder: search.placeholder })} onChange={(event) => { onSearch?.(event.target.value); }} />
          </Field>
        </div>
      )}
      {selects.map((select) => (
        <div className="omni-filter-bar__select" key={select.name}>
          <Field label={select.label}>
            <Select size="sm" name={select.name} options={select.options} onValueChange={(value) => { onSelect?.(select.name, value); }} />
          </Field>
        </div>
      ))}
      {segments === undefined ? null : (
        <div className="omni-filter-bar__segments">
          <span className="omni-filter-bar__caption" aria-hidden="true">{segments.label}</span>
          <SegmentedControl label={segments.label} options={segments.options} {...(segments.defaultValue === undefined ? {} : { defaultValue: segments.defaultValue })} {...(onSegment === undefined ? {} : { onChange: onSegment })} />
        </div>
      )}
    </div>
  );
}
