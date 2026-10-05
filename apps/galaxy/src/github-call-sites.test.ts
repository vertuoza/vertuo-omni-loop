import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every place galaxy and omni-app call GitHub (PRD 902, acceptance 1): each source file of either app
// that names api.github.com or builds an Octokit is listed below, with why its calls may go out as they
// do. An installation-token call goes through the shared, budget-aware client (`@omni/github`); the
// only other calls are the App's own JWT calls (its token's minting, finding an installation), which
// spend the App's budget, and calls made with a person's token, which spend that person's. A new file
// that calls GitHub, or one that moves, fails here until it is listed; a file listed as `client` that no
// longer reaches the client fails too.

type Kind =
  /** Its installation-token calls go through `@omni/github`. */
  | 'client'
  /** The App's JWT calls; its one installation-token read (`reachedRepositories`) takes its fetch from
   * its callers, the knowledge reader and Settings › Repositories, which hand it the client's. */
  | 'jwt'
  /** A person's token: sign-in, outbox send's comment. */
  | 'person';

const SITES: Record<string, Kind> = {
  'apps/galaxy/src/business/draft/github.ts': 'client',
  'apps/galaxy/src/data/github-orgs.ts': 'person',
  'apps/galaxy/src/dossier/github/reader.ts': 'client',
  'apps/galaxy/src/knowledge/github.ts': 'client',
  'apps/galaxy/src/outbox/send.ts': 'person',
  'apps/galaxy/src/signup/github-app.ts': 'jwt',
  'apps/galaxy/src/stages/sync/github.ts': 'client',
  'apps/omni-app/src/octokit-for.ts': 'client',
};

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const APPS = ['apps/galaxy', 'apps/omni-app'];
/** Folders that hold no source of the apps: dependencies, builds, and the tests' fixtures. */
const SKIPPED = new Set(['node_modules', '.next', '.vercel', 'dist', 'coverage', 'test', 'fixtures']);
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
const TEST = /\.test\.[cm]?[jt]sx?$|\.fixtures\//;
/** Calling GitHub's REST or GraphQL API, or building an Octokit (an App's or an installation's). */
const CALLS_GITHUB = /api\.github\.com|new\s+Octokit\b|Octokit\.defaults\(|new\s+App\(|getInstallationOctokit\(/;
/** Reaching the shared client: its factory, or a bound fetch of it handed in. */
const REACHES_CLIENT = /from '@omni\/github'/;

function sourcesOf(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIPPED.has(entry.name) || entry.name.endsWith('.fixtures') ? [] : sourcesOf(path);
    return SOURCE.test(entry.name) && !TEST.test(path) ? [path] : [];
  });
}

const callers = APPS.flatMap(sourcesOf).filter((path) => CALLS_GITHUB.test(readFileSync(join(ROOT, path), 'utf8'))).sort();

describe('the GitHub call sites of galaxy and omni-app (PRD 902, acceptance 1)', () => {
  it('are exactly the listed ones: a new caller is listed, with why its calls may go out as they do', () => {
    expect(callers).toEqual(Object.keys(SITES).sort());
  });

  it('send every installation-token call of a client site through @omni/github', () => {
    const around = Object.entries(SITES)
      .filter(([path, kind]) => kind === 'client' && !REACHES_CLIENT.test(readFileSync(join(ROOT, path), 'utf8')))
      .map(([path]) => path);
    expect(around).toEqual([]);
  });

  it('reads the files from the repository root', () => {
    expect(relative(ROOT, fileURLToPath(import.meta.url))).toBe('apps/galaxy/src/github-call-sites.test.ts');
  });
});
