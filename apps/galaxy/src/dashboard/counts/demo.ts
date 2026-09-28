import type { PartDemo } from '../part';
import { ASK } from './counts';
import type { CountsValue } from './load';

// The four counts in the demo (PRD 328, slice s5): made up and fixed, as the spec tells them (fourteen
// questions answered, three outbox items settled, two PRDs created, and one question waiting, which
// lands on /ask). The demo world holds no ask tables and no contributions to count from.

export const demoCounts: PartDemo<CountsValue> = () => ({ answered: 14, settled: 3, prds: 2, waiting: { count: 1, href: ASK } });
