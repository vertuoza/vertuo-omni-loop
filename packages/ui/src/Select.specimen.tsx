import { Icon } from './Icon.tsx';
import { Select } from './Select.tsx';
import type { Specimen } from './meta.ts';

const options = [
  { value: 'dev', label: 'Developer' },
  { value: 'pm', label: 'Product' },
  { value: 'design', label: 'Design' },
];

/**
 * A Select with one closed prop at the given value, the rest at their defaults, and under it a still
 * of the open list (Product picked, Design highlighted): an open list would float over the page and
 * take its focus, so /design and its screenshot show it drawn in place, inert, with the classes the
 * open list draws. A disabled Select never opens: it has no still.
 */
export const selectSpecimen: Specimen = (prop, value) => {
  const on = value === 'true';
  const disabled = prop === 'disabled' && on;
  return (
    <div className="omni-select-specimen">
      <Select
        label="Example"
        options={options}
        defaultValue="pm"
        size={prop === 'size' && value === 'sm' ? 'sm' : 'md'}
        invalid={prop === 'invalid' && on}
        disabled={disabled}
      />
      {disabled ? null : (
        <div className="omni-select-still" inert>
          <div className="omni-menu omni-select__popup">
            <div className="omni-select__list" role="presentation">
              {options.map((option) => (
                <div
                  key={option.value}
                  className="omni-menu__item omni-menu__item--neutral omni-select__item"
                  {...(option.value === 'design' ? { 'data-highlighted': '' } : {})}
                  {...(option.value === 'pm' ? { 'data-selected': '' } : {})}
                >
                  <span className="omni-select__check">{option.value === 'pm' ? <Icon name="check" /> : null}</span>
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
