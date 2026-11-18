import { SegmentedControl } from './SegmentedControl.tsx';
import { SEGMENTED_SIZES } from './SegmentedControl.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

const options = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

/** How many specimens were drawn: /design shows one per variant and theme, and each group needs its own name. */
let drawn = 0;

/** A SegmentedControl at each size, the second option chosen. */
export const segmentedControlSpecimen: Specimen = (_prop, value) => {
  drawn += 1;
  return <SegmentedControl label={`Show ${String(drawn)}`} options={options} value="open" onChange={() => undefined} size={one(SEGMENTED_SIZES, value)} />;
};
