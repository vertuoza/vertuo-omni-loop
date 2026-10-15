// The kit check's facts (PRD 1990, spec section 5): the repository's kit, the two plugins and the
// target repositories' kits, each against the kit home's latest release. Not gathered yet: the check
// reads `n/a · not checked yet`, green, until this file gathers them.
import { NOT_CHECKED_YET } from './facts.ts';
import type { Gatherer, KitFacts } from './facts.ts';

export const kitFacts: Gatherer<KitFacts> = () => Promise.resolve({ na: NOT_CHECKED_YET });
