import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Auth once per request (PRD 657 s2): the app's pages under /app and /prd, and the gates they read
// the person through, never call auth.getUser() (a call to Supabase Auth each time); they read the
// person through viewer() (src/data/viewer.ts), once per request. Read as text.

const GALAXY = join(import.meta.dirname, '..', '..');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(GALAXY, path), 'utf8');

describe('who is looking, read once', () => {
  const files = [
    ...filesUnder(join(GALAXY, 'app', 'app')),
    ...filesUnder(join(GALAXY, 'app', 'prd')),
    ...['src/nav/viewer.ts', 'src/data/member-session.ts', 'src/dossier/page/route-gate.tsx', 'src/dashboard/load.ts'].map((p) => join(GALAXY, p)),
  ];

  it.each(files.map((f) => [f.slice(GALAXY.length + 1), f]))('%s never calls auth.getUser()', (_name, file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/\bgetUser\s*\(/);
  });

  it.each([
    'app/app/layout.tsx', 'app/prd/layout.tsx', 'app/app/page.tsx', 'app/app/workspace/page.tsx', 'app/app/fleet/page.tsx',
    'app/app/settings/fleets/page.tsx', 'app/prd/at/[owner]/[repo]/[n]/page.tsx',
  ])('%s reads the person through viewer()', (path) => {
    expect(read(path)).toMatch(/\bviewer(Live)?\(\)/);
  });

  it.each([
    ['app/app/engineering/page.tsx', 'memberSession'], ['app/app/settings/repositories/page.tsx', 'memberSession'],
    ['app/app/settings/business/page.tsx', 'memberSession'], ['app/prd/page.tsx', 'dossierSession'],
  ])('%s reads the person through %s, itself read through viewer()', (path, gate) => {
    expect(read(path)).toMatch(new RegExp(`\\b${gate}\\(`));
  });

  it.each(['src/nav/viewer.ts', 'src/data/member-session.ts', 'src/dossier/page/route-gate.tsx'])('%s reads through viewer()', (path) => {
    expect(read(path)).toMatch(/\bviewer\(\)/);
  });
});
