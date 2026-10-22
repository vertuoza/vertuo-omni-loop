import { Suspense } from 'react';
import { serverTiming, type Timings } from './timing';

// The page's own say of its timings (./timing.ts): a hidden template at the end of the document, once
// every read it names has settled. It never holds the page: it streams in its own Suspense boundary.

async function Mark({ timings, settle }: { timings: Timings; settle: readonly PromiseLike<unknown>[] }) {
  await Promise.allSettled(settle);
  return <template id="server-timing" data-value={serverTiming(timings.entries())} />;
}

/** Says the timings in the page once every read in `settle` is over; shows nothing until then and never holds the page. */
export function ServerTimingMark({ timings, settle = [] }: { timings: Timings; settle?: readonly PromiseLike<unknown>[] }) {
  return <Suspense fallback={null}><Mark timings={timings} settle={settle} /></Suspense>;
}
