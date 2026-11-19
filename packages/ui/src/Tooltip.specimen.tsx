import { Tooltip } from './Tooltip.tsx';
import { TOOLTIP_SIDES } from './Tooltip.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const label = 'Search the PRDs';

/**
 * The Tooltip's button, which shows the real hint on hover and focus, and on the side it shows a still
 * of the hint: an open tooltip floats over the page and goes when the pointer does, so /design and its
 * screenshot show the hint drawn in place, inert, with the classes the open tooltip draws
 * (Tooltip.dom.test.ts holds them equal).
 */
export const tooltipSpecimen: Specimen = (_prop, value) => {
  const side = one(TOOLTIP_SIDES, value);
  return (
    <div className={`omni-tooltip-specimen omni-tooltip-specimen--${side}`}>
      <Tooltip icon="search" label={label} side={side} />
      <div className="omni-tooltip-still" inert>
        <div className={`omni-tooltip omni-tooltip--${side}`}>{label}</div>
      </div>
    </div>
  );
};
