// @ts-nocheck
// The Vercel ignore step of both projects (PRD 675): a phase-0 branch, in the `branches.phase0` shape
// this checkout's `omni config` prints, answers 0 (skip the build); any other branch, an empty branch
// name, or a config the script cannot read answers 1 (build). Each run is on a fixture repository whose
// `omni` is a shim onto the live kit source: a git repository, as Vercel's clone is.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'vercel-ignore.sh');
const CLI = join(here, '..', 'kit', 'bin', 'omni.ts');
const SHIM = `import { main } from ${JSON.stringify(CLI)};\nmain(process.argv.slice(2)).then((code) => process.exit(code));\n`;
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const dirs = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
  dirs.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  return root;
}

function ignore(root, branch) {
  const env = { PATH: process.env.PATH };
  if (branch !== undefined) env.VERCEL_GIT_COMMIT_REF = branch;
  return spawnSync('bash', [script], { cwd: root, encoding: 'utf8', env });
}

const repo = (config = CONFIG) => fixture({ '.omni-loop/config.yml': config, '.omni-loop/bin/omni.mjs': SHIM });

describe('vercel-ignore.sh', () => {
  it('skips the build (exit 0) for a phase-0 branch', () => {
    const run = ignore(repo(), 'docs/phase-0-anything');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^vercel-ignore: .*skipping/m);
  });

  it.each(['feat/x', 'main', 'docs/phase-0-', 'x/docs/phase-0-anything'])('builds (exit 1) for %s', (branch) => {
    expect(ignore(repo(), branch).status).toBe(1);
  });

  it('builds for an empty or missing branch name', () => {
    expect(ignore(repo(), '').status).toBe(1);
    expect(ignore(repo(), undefined).status).toBe(1);
  });

  it('builds when it cannot read the config', () => {
    expect(ignore(repo('kit: [broken\n'), 'docs/phase-0-anything').status).toBe(1);
    expect(ignore(fixture({}), 'docs/phase-0-anything').status).toBe(1);
  });

  it('reads the shape the config sets', () => {
    const root = repo(`${CONFIG}branches:\n  phase0: prd/{topic}/review\n`);
    expect(ignore(root, 'prd/inbox/review').status).toBe(0);
    expect(ignore(root, 'docs/phase-0-inbox').status).toBe(1);
  });

  it.each(['apps/galaxy', 'apps/omni-app'])('%s/vercel.json runs it from the repository root', (app) => {
    const { ignoreCommand } = JSON.parse(readFileSync(join(here, '..', app, 'vercel.json'), 'utf8'));
    expect(ignoreCommand).toBe('cd ../.. && bash scripts/vercel-ignore.sh');
    const run = (branch) => spawnSync('sh', ['-c', ignoreCommand], {
      cwd: join(here, '..', app),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, VERCEL_GIT_COMMIT_REF: branch },
    }).status;
    expect(run('docs/phase-0-anything')).toBe(0);
    expect(run('feat/anything')).toBe(1);
  });

  it('falls back to the kit bundle when the checkout\'s omni cannot run', () => {
    const root = fixture({
      '.omni-loop/config.yml': CONFIG,
      '.omni-loop/bin/omni.mjs': 'process.exit(1);\n',
      'kit/dist/omni.mjs': SHIM,
    });
    expect(ignore(root, 'docs/phase-0-anything').status).toBe(0);
  });
});
