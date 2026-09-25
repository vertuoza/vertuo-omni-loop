// Vercel's Ignored Build Step (vercel.json › ignoreCommand): exit 0 skips the deployment, exit 1
// builds. The game workflow commits game/ledger and game/season up to every 15 minutes; the site
// reads the ledger from Supabase, not from the build, so a change made only of those never
// redeploys. Anything else builds, and so does any doubt.
// Runs before install, from apps/galaxy: node built-ins only.
import { execFileSync } from 'node:child_process';

const DATA_ONLY = ['game/ledger/', 'game/season/'];

const build = (why) => { console.log(`build: ${why}`); process.exit(1); };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

// The last successful deployment of this branch, not HEAD^: a push can carry several commits, and a
// skipped or cancelled build must not hide the commits before it.
const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
if (!base) build('no previous deployment on this branch');
let changed;
try {
  changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
} catch {
  build(`previous deployment ${base.slice(0, 7)} is not in the clone`);
}
if (changed.length === 0) build('nothing changed since the previous deployment (a redeploy)');
const code = changed.filter((f) => !DATA_ONLY.some((dir) => f.startsWith(dir)));
if (code.length > 0) build(`${code.length} file(s) outside the ledger changed, e.g. ${code[0]}`);
console.log(`skip: only the ledger changed since ${base.slice(0, 7)} (${changed.length} file(s)); the site reads it from Supabase`);
process.exit(0);
