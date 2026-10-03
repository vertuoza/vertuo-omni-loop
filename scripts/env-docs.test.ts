// The docs check (PRD 1059, s4; ADR-0057): every list of environment variables a person reads names
// exactly the variables the runtime's env module reads, both ways. A variable read but not listed
// fails, and so does one listed but not read.
//
// - `apps/galaxy/.env.example`: every `NAME=` line.
// - A README: the backticked names (`SUPABASE_URL`) between `<!-- omni:env-variables -->` and
//   `<!-- /omni:env-variables -->`. One marked section per README; names outside it are prose.
//
// What a module reads beyond its groups is named there, never here: the values the platform sets
// (`PLATFORM_VARIABLES`: NODE_ENV, VERCEL_ENV, COLUMNS…) are listed nowhere, and the ones an SDK reads
// itself (`SDK_VARIABLES`: INNGEST_*) are set by a person, so the README lists them too.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as galaxy from '../apps/galaxy/src/env.ts';
import * as omniApp from '../apps/omni-app/src/env.ts';
import * as kit from '../kit/lib/env/read.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const text = (path: string): string => readFileSync(join(repoRoot, path), 'utf8');

describe('the docs check, on fixtures', () => {
  it('reads every NAME= line of an .env.example, comments aside', () => {
    expect(envExampleNames('# NOT_THIS=1\nSUPABASE_URL=\n\nGITHUB_APP_ID=12\n# Optional: OTHER\nnpm_x=\n')).toEqual(['SUPABASE_URL', 'GITHUB_APP_ID', 'npm_x']);
  });

  it('reads the backticked names in a README\'s marked section only', () => {
    const readme = [
      'Set `OUTSIDE_NAME` first.',
      '<!-- omni:env-variables -->',
      '- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: the pair, read with `pnpm game:score`',
      '- `OPENROUTER_API_KEY`, optional (`VERCEL_ENV=production` is not a name)',
      '<!-- /omni:env-variables -->',
      'And `AFTER_NAME`.',
    ].join('\n');
    expect(readmeNames(readme)).toEqual(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY']);
  });

  it('refuses a README with no marked section, or with two', () => {
    expect(() => readmeNames('# Title\n`SUPABASE_URL`\n')).toThrow(/one <!-- omni:env-variables --> section/);
    const twice = '<!-- omni:env-variables -->\n`A_B`\n<!-- /omni:env-variables -->\n<!-- omni:env-variables -->\n<!-- /omni:env-variables -->\n';
    expect(() => readmeNames(twice)).toThrow(/one <!-- omni:env-variables --> section/);
  });

  it('names a variable read but not listed, and one listed but not read', () => {
    expect(difference(['A_KEY', 'B_URL'], ['B_URL', 'C_SECRET'])).toEqual({ unlisted: ['A_KEY'], unread: ['C_SECRET'] });
    expect(difference(['A_KEY'], ['A_KEY'])).toEqual({ unlisted: [], unread: [] });
  });
});

describe('the docs check, on the repository', () => {
  it('keeps each module\'s platform and SDK variables apart from the ones its groups read', () => {
    for (const [variables, others] of [
      [kit.VARIABLES, kit.PLATFORM_VARIABLES],
      [omniApp.VARIABLES, [...omniApp.PLATFORM_VARIABLES, ...omniApp.SDK_VARIABLES]],
      [galaxy.VARIABLES, galaxy.PLATFORM_VARIABLES],
    ] as const) {
      expect(variables.filter((name) => others.includes(name))).toEqual([]);
    }
    expect(kit.GAME_VARIABLES.filter((name) => !kit.VARIABLES.includes(name))).toEqual([]);
  });

  it.each([
    ['README.md', kit.VARIABLES],
    ['game/README.md', kit.GAME_VARIABLES],
    ['apps/omni-app/README.md', [...omniApp.VARIABLES, ...omniApp.SDK_VARIABLES]],
    ['apps/galaxy/README.md', galaxy.VARIABLES],
  ])('%s lists exactly the variables its runtime reads', (path, read) => {
    expect(difference(read, readmeNames(text(path)))).toEqual({ unlisted: [], unread: [] });
  });

  it('apps/galaxy/.env.example lists exactly the variables the arcade reads', () => {
    expect(difference(galaxy.VARIABLES, envExampleNames(text('apps/galaxy/.env.example')))).toEqual({ unlisted: [], unread: [] });
  });
});

const OPEN = '<!-- omni:env-variables -->';
const CLOSE = '<!-- /omni:env-variables -->';

/** An environment variable's name, as a list writes it between backticks. */
const NAME = /`([A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]+)`/g;

/** Every variable an `.env.example` sets: a `NAME=` line, comments and blank lines aside. */
function envExampleNames(file: string): string[] {
  return file.split('\n').flatMap((line) => /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1] ?? []);
}

/** The backticked names in a README's one marked section; a README without exactly one throws. */
function readmeNames(file: string): string[] {
  const sections = file.split(OPEN).slice(1);
  const [section] = sections;
  if (sections.length !== 1 || section === undefined || !section.includes(CLOSE)) {
    throw new Error(`a README holds one ${OPEN} section, closed by ${CLOSE}`);
  }
  const body = section.slice(0, section.indexOf(CLOSE));
  return [...new Set([...body.matchAll(NAME)].flatMap((match) => match[1] ?? []))];
}

/** What a list misses (`unlisted`: read, not listed) and what it names wrongly (`unread`: listed, not read). */
function difference(read: readonly string[], listed: readonly string[]): { unlisted: string[]; unread: string[] } {
  return { unlisted: read.filter((name) => !listed.includes(name)), unread: listed.filter((name) => !read.includes(name)) };
}
