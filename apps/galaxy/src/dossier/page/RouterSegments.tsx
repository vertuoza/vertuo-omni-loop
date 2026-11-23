'use client';

import Link from 'next/link';
import { SegmentedControl, type SegmentedControlProps } from '@omni/ui';

// A SegmentedControl of links drawn with the app's router link, so a segment switches without a full page
// load. SegmentedControl is a client component: a server component cannot hand it the router link, a function,
// so the link is named here, on the client, and the PRD page's server components render this instead
// (PRD omni-loop-20 s14: the Specifications and Outbox tabs failed to render in the demo for that reason).
export function RouterSegments(props: Omit<SegmentedControlProps, 'link'>) {
  return <SegmentedControl {...props} link={Link} />;
}
