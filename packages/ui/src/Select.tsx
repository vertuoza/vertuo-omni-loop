'use client';

import { Select as Base } from '@base-ui/react/select';
import { useFieldControl } from './Field.tsx';
import { Icon } from './Icon.tsx';
import './Input.css';
import './Menu.css';
import './Select.css';

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  /** The accessible name when the Select stands alone; inside a Field the Field's label names it. */
  label?: string;
  options: readonly SelectOption[];
  /** Posted as `name=value` by a surrounding form, through a hidden input. */
  name?: string;
  /** The `value` of the option picked, when the caller keeps it. */
  value?: string;
  /** The `value` of the option picked at first, when it keeps that itself; the first option when neither this nor a `placeholder` is given. */
  defaultValue?: string;
  /** Called with the `value` of the option picked. */
  onValueChange?: (value: string) => void;
  /** What the trigger says while nothing is picked. */
  placeholder?: string;
  /** `md` wears the Input's look, for forms; `sm` is compact, for a chip, a toolbar or an inline sort. */
  size?: 'md' | 'sm';
  disabled?: boolean;
  required?: boolean;
  /** Marks the value wrong; inside a Field the Field's `error` does it. */
  invalid?: boolean;
};

/**
 * One choice out of a list, in the product's own list rather than the browser's picker; its keyboard,
 * dismissal, roles and form post are Base UI's Select. Inside a Field it takes its id, its description
 * and its error from it.
 */
export function Select({ label, options, name, value, defaultValue, onValueChange, placeholder, size = 'md', disabled = false, required = false, invalid = false }: SelectProps) {
  const field = useFieldControl();
  const isInvalid = invalid || field?.invalid === true;
  const first = options[0]?.value;
  const initial = defaultValue ?? (value === undefined && placeholder === undefined ? first : undefined);
  return (
    <Base.Root
      items={options}
      name={name}
      value={value}
      defaultValue={initial}
      onValueChange={(picked: string | null) => { if (picked !== null) onValueChange?.(picked); }}
      disabled={disabled}
      required={required || field?.required === true}
    >
      <Base.Trigger
        className={`omni-input omni-select__trigger omni-select__trigger--${size}`}
        id={field?.id}
        aria-label={field === null ? label : undefined}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid ? true : undefined}
      >
        <Base.Value className="omni-select__value" placeholder={placeholder} />
        <Base.Icon className="omni-select__chevron"><Icon name="chevron-down" /></Base.Icon>
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner className="omni-select-positioner" align="start" sideOffset={4} alignItemWithTrigger={false}>
          <Base.Popup className="omni-menu omni-select__popup">
            <Base.List className="omni-select__list">
              {options.map((option) => (
                <Base.Item key={option.value} value={option.value} className="omni-menu__item omni-menu__item--neutral omni-select__item">
                  <Base.ItemIndicator className="omni-select__check"><Icon name="check" /></Base.ItemIndicator>
                  <Base.ItemText>{option.label}</Base.ItemText>
                </Base.Item>
              ))}
            </Base.List>
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  );
}
