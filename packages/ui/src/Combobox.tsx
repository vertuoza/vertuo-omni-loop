'use client';

import { Combobox as Base } from '@base-ui/react/combobox';
import { useFieldControl } from './Field.tsx';
import './Input.css';
import './Select.css';
import './Menu.css';
import './Combobox.css';

export type ComboboxOption = {
  value: string;
  label: string;
};

export type ComboboxProps = {
  /** The accessible name when the Combobox stands alone; inside a Field the Field's label names it. */
  label?: string;
  options: readonly ComboboxOption[];
  name?: string;
  /** The `value` of the option picked, when the caller keeps it; `null` for none. */
  value?: string | null;
  /** The `value` of the option picked at first, when it keeps that itself. */
  defaultValue?: string;
  /** Called with the `value` of the option picked, or `null` when the person clears it. */
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  /** What the list says when nothing matches what was typed. */
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  /** Marks the value wrong; inside a Field the Field's `error` does it. */
  invalid?: boolean;
};

const labelOf = (option: ComboboxOption): string => option.label;
const valueOf = (option: ComboboxOption): string => option.value;

/**
 * An Input that filters a list of options as the person types; its keyboard, filtering and
 * dismissal are Base UI's Combobox. Inside a Field it takes its id, its description and its error
 * from it, and it wears the Input's look.
 */
export function Combobox({ label, options, name, value, defaultValue, onValueChange, placeholder, emptyText = 'Nothing matches.', disabled = false, required = false, invalid = false }: ComboboxProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  const find = (wanted: string | null | undefined) => (wanted === undefined ? undefined : options.find((option) => option.value === wanted) ?? null);
  return (
    <Base.Root
      items={options}
      itemToStringLabel={labelOf}
      itemToStringValue={valueOf}
      name={name}
      value={find(value)}
      defaultValue={find(defaultValue)}
      onValueChange={(picked: ComboboxOption | null) => onValueChange?.(picked?.value ?? null)}
      disabled={disabled}
      required={required || field?.required === true}
    >
      <span className="omni-select">
        <Base.Input
          className="omni-input omni-select__control omni-combobox__input"
          id={field?.id}
          placeholder={placeholder}
          aria-label={field === null ? label : undefined}
          aria-describedby={field?.describedBy}
          aria-invalid={isInvalid ? true : undefined}
        />
      </span>
      <Base.Portal>
        <Base.Positioner className="omni-combobox-positioner" align="start" sideOffset={4}>
          <Base.Popup className="omni-menu omni-combobox">
            <Base.Empty className="omni-combobox__empty">{emptyText}</Base.Empty>
            <Base.List className="omni-combobox__list">
              {(option: ComboboxOption) => (
                <Base.Item key={option.value} value={option} className="omni-menu__item omni-menu__item--neutral omni-combobox__item">{option.label}</Base.Item>
              )}
            </Base.List>
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
