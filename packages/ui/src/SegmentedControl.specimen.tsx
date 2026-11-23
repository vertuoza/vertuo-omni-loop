import { SegmentedControl } from './SegmentedControl.tsx';
import { SEGMENTED_SIZES, SEGMENTED_VARIANTS } from './SegmentedControl.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A filter: a choice the control keeps itself. */
const filter = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

/** A tab's sub-views, each its own address: a set of links. */
const views = [
  { id: 'before-after', label: 'Before/after', href: '#before-after' },
  { id: 'spec', label: 'Spec', href: '#spec' },
  { id: 'plan', label: 'Plan', href: '#plan' },
];

/** A filter with a count on each option, as the pills draw it. */
const counted = [
  { id: 'all', label: 'All', count: '12' },
  { id: 'questions', label: 'Questions', count: '3' },
  { id: 'reviews', label: 'Reviews', count: '3' },
];

/** How many specimens were drawn: /design shows one per variant and theme, and each group needs its own name. */
let drawn = 0;

/** A SegmentedControl at each size: at md a filter, the second option chosen; at sm a tab's sub-views as links, Spec current. */
export const segmentedControlSpecimen: Specimen = (prop, value) => {
  drawn += 1;
  if (prop === 'variant') {
    const variant = one(SEGMENTED_VARIANTS, value);
    return <SegmentedControl label={`Kind ${String(drawn)}`} options={counted} defaultValue="questions" variant={variant} />;
  }
  const size = one(SEGMENTED_SIZES, value);
  return size === 'sm'
    ? <SegmentedControl label={`Specifications ${String(drawn)}`} options={views} value="spec" size="sm" />
    : <SegmentedControl label={`Show ${String(drawn)}`} options={filter} defaultValue="open" size="md" />;
};
