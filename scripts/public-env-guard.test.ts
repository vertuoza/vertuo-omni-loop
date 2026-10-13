// The public-name guard: no secret reaches the browser by its name. Next inlines every variable whose
// name starts with `NEXT_PUBLIC_` into the code it ships to the browser, so a secret given that prefix
// is published, whatever module reads it. The arcade has exactly two public values, the Supabase URL
// and its publishable (anon) key; any other `NEXT_PUBLIC_` name in a file git tracks under `apps/` or
// `packages/` fails here, naming the file and the name. Tests and Markdown are exempt: they quote
// names, they ship nothing. The rule is proven on fixtures first, then run on every tracked file.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** The only values a browser may be given: the Supabase URL and its publishable key. */
const PUBLIC = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);

const SHIPPED = /^(apps|packages)\//;
const EXEMPT = /(\.test\.[cm]?[jt]sx?|\.md|\.mdx)$/;

type Found = { path: string; name: string };

function publicNames(files: readonly { path: string; text: string }[]): Found[] {
  return files
    .filter(({ path }) => SHIPPED.test(path) && !EXEMPT.test(path))
    .flatMap(({ path, text }) => [...new Set(text.match(/\bNEXT_PUBLIC_[A-Z0-9_]+/g) ?? [])].map((name) => ({ path, name })))
    .filter(({ name }) => !PUBLIC.has(name));
}

describe('the public-name guard, on fixtures', () => {
  it('refuses a secret given a public name, in code and in .env.example', () => {
    expect(publicNames([
      { path: 'apps/galaxy/src/env.ts', text: "const key = source.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;\n" },
      { path: 'apps/galaxy/.env.example', text: 'NEXT_PUBLIC_STAGES_SYNC_SECRET=\n' },
    ])).toEqual([
      { path: 'apps/galaxy/src/env.ts', name: 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY' },
      { path: 'apps/galaxy/.env.example', name: 'NEXT_PUBLIC_STAGES_SYNC_SECRET' },
    ]);
  });

  it('lets the two public Supabase values through, and ignores tests, Markdown and files outside apps/ and packages/', () => {
    expect(publicNames([
      { path: 'apps/galaxy/src/env.client.ts', text: 'process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;' },
      { path: 'apps/galaxy/src/env.test.ts', text: 'NEXT_PUBLIC_SECRET' },
      { path: 'apps/galaxy/README.md', text: 'never NEXT_PUBLIC_SECRET' },
      { path: 'scripts/a.ts', text: 'NEXT_PUBLIC_SECRET' },
    ])).toEqual([]);
  });
});

describe('the public-name guard, on the repository', () => {
  it('finds no NEXT_PUBLIC_ name but the two public Supabase values in any file git tracks under apps/ or packages/', () => {
    const paths = execFileSync('git', ['ls-files', '-z', 'apps', 'packages'], { cwd: repoRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
    const files = paths.filter((path) => SHIPPED.test(path) && !EXEMPT.test(path)).map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));
    expect(publicNames(files)).toEqual([]);
  });
});
