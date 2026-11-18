import { Combobox } from './Combobox.tsx';
import type { ComboboxOption } from './Combobox.tsx';
import { Field } from './Field.tsx';
import type { Specimen } from './meta.ts';

const options: readonly ComboboxOption[] = [
  { value: 'omni-loop', label: 'omni-loop' },
  { value: 'omni-app', label: 'omni-app' },
  { value: 'galaxy', label: 'galaxy' },
];

/**
 * A Combobox in a Field, which opens the real list, and under it a still of the open list with its
 * first option highlighted: an open list would float over the page and take its focus, so /design
 * and its screenshot show it drawn in place, inert, with the classes the open combobox draws
 * (Combobox.dom.test.ts holds them equal). A disabled Combobox never opens: it has no still.
 */
export const comboboxSpecimen: Specimen = (prop, value) => {
  const on = value === 'true';
  const disabled = prop === 'disabled' && on;
  return (
    <div className="omni-combobox-specimen">
      <Field label="Repository" hint="Type to find one." {...(prop === 'invalid' && on ? { error: 'Pick a repository.' } : {})}>
        <Combobox options={options} placeholder="omni" disabled={disabled} />
      </Field>
      {disabled ? null : (
        <div className="omni-combobox-still" inert>
          <div className="omni-menu omni-combobox">
            <div className="omni-combobox__empty" />
            <div className="omni-combobox__list">
              {options.map((option, index) => (
                <div key={option.value} className="omni-menu__item omni-menu__item--neutral omni-combobox__item" {...(index === 0 ? { 'data-highlighted': '' } : {})}>{option.label}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
