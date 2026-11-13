// The Eval view's reads (PRD omni-loop-8 s5), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts): the
// runs, the set's questions and their answers, each parsed with the module's schema. The reads themselves live in
// the repository, the one place that calls the database (ADR-0095).
import type { Boundary } from '../../../data/parse-rows';
import { boundaryReads } from './eval.repository';

export const boundaries: Boundary[] = boundaryReads.map((b) => ({ ...b, shape: 'rows' }));
