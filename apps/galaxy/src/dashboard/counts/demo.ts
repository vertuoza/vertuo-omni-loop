import type { PartDemo } from '../part';
import { ASK, type Waiting } from './counts';

// Waiting for you in the demo (PRD 328): made up and fixed, one question waiting, which lands on /ask.
// The demo world holds no ask tables to count from.

export const demoWaiting: PartDemo<Waiting> = () => ({ count: 1, href: ASK });
