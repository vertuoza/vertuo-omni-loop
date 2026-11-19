import { Popover } from './Popover.tsx';
import { POPOVER_SIDES } from './Popover.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const words = {
  trigger: 'Who answers?',
  title: 'Who answers',
  body: 'The PRD\'s two approvers, then whoever merges it.',
};

/**
 * The Popover's button, which opens the real popover, and on the side it opens a still of the open
 * panel: an open popover would float over the page and move with it, so /design and its screenshot
 * show the panel drawn in place, inert, with the classes the open popover draws (Popover.dom.test.ts
 * holds them equal).
 */
export const popoverSpecimen: Specimen = (_prop, value) => {
  const side = one(POPOVER_SIDES, value);
  return (
    <div className={`omni-popover-specimen omni-popover-specimen--${side}`}>
      <Popover trigger={words.trigger} title={words.title} side={side}>{words.body}</Popover>
      <div className="omni-popover-still" inert>
        <div className={`omni-popover omni-popover--${side}`}>
          <p className="omni-popover__title">{words.title}</p>
          <div className="omni-popover__body">{words.body}</div>
        </div>
      </div>
    </div>
  );
};
