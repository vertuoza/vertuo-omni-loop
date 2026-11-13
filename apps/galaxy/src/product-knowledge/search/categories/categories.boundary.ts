// The Categories view's reads (PRD omni-loop-7 s4), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// the searches with their category and group, and the groups' first questions, each parsed with the module's schema.
// The reads themselves live in the repository, the one place that calls the database (ADR-0095).
import type { Boundary } from '../../../data/parse-rows';
import { boundaryReads } from './categories.repository';

export const boundaries: Boundary[] = boundaryReads.map((b) => ({ ...b, shape: 'rows' }));
