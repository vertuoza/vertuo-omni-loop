// @ts-nocheck
// pnpm releases:sync — stamp each shipped PRD with its version, once, in public.releases (PRD 262).
// Reads this checkout's shipped folders through the kit and git, reads the table, and adds a row for
// each PRD shipped since, numbered in the order it reached main, then refreshes the title and
// description of rows whose note changed. It never deletes a row. Run on a checkout of main: the
// releases workflow does, after every push that ships a PRD.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (locally, `npx supabase status` prints both).
// Exits 1, having written nothing, when a release note breaks the rules or a variable is missing, and
// exits 1 when Supabase refuses. The rules live in src/releases/, which plain Node loads as TypeScript.
import { fileURLToPath } from 'node:url';
import { releasesSync } from '../src/releases/sync-run.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
process.exit(await releasesSync({ env: process.env, root }));
