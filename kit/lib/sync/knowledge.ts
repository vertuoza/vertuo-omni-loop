// The knowledge check's facts (PRD 1990, spec section 5): the playbook's stale evidence, a plan
// repository's target copies, and the knowledge files changed here. Not gathered yet: the check
// reads `n/a · not checked yet`, green, until this file gathers them.
import { NOT_CHECKED_YET } from './facts.ts';
import type { Gatherer, KnowledgeFacts } from './facts.ts';

export const knowledgeFacts: Gatherer<KnowledgeFacts> = () => Promise.resolve({ na: NOT_CHECKED_YET });
