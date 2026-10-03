// The repositories' saved row (PRD 1030), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): the whole public.repositories row add_repository() and the others
// answer, read here with a plain select of every column (the script only reads), parsed with the
// schema the store parses it with.
import type { Boundary } from '../data/parse-rows';
import { SavedRepository } from './model';

export const boundaries: Boundary[] = [
  { name: 'repositories/store: the row a function answers', read: (db) => db.from('repositories').select('*'), schema: SavedRepository, shape: 'rows' },
];
