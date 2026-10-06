// The canon gate's reads (./live.ts), for `pnpm schemas:verify` (PRD 1030): the business and the
// constituents of a repository, as the service role reads them, parsed with the schemas the gate
// parses them with. Each asks for this repository, whose business production holds; a database
// without it answers the empty business and no constituents, which parse all the same.
import type { Boundary } from '../boundary.ts';
import { BusinessSchema, ConstituentsSchema } from './schema.ts';

const REPO = 'vertuoza/vertuo-omni-loop';

export const boundaries: Boundary[] = [
  {
    name: 'canon/live: business_for_repo_app',
    read: (db) => db.rpc('business_for_repo_app', { p_repo: REPO }, { get: true }),
    schema: BusinessSchema,
    shape: 'row',
  },
  {
    name: 'canon/live: constituents_for_repo_app',
    read: (db) => db.rpc('constituents_for_repo_app', { p_repo: REPO }, { get: true }),
    schema: ConstituentsSchema,
    shape: 'row',
  },
];
