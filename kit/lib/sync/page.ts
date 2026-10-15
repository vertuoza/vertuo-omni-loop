// The page check's facts (PRD 1990, spec section 5): the sign-in to the Omni page, and how old its
// constituents copy is. Not gathered yet: the check reads `n/a · not checked yet`, green, until this
// file gathers them.
import { NOT_CHECKED_YET } from './facts.ts';
import type { Gatherer, PageFacts } from './facts.ts';

export const pageFacts: Gatherer<PageFacts> = () => Promise.resolve({ na: NOT_CHECKED_YET });
