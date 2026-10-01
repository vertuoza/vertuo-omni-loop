// @ts-nocheck
// PRD #45, acceptance criterion 6: the committed `kit/dist/omni.mjs`, copied alone into a fixture
// repository with no `node_modules` and no kit beside it, prints the kit defaults — the very text
// `omni kb show` prints from the kit's source — and lays down the same blank forms.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.ts';
import { FORM_IDS } from '../lib/playbook/forms.ts';
import { makeRepo } from './fixture.ts';

const DIST = fileURLToPath(new URL('../dist/omni.mjs', import.meta.url));
const BIN = '.omni-loop/bin/omni.mjs';
// Every command a kit default names is set, so no default is left holding a placeholder.
const CONFIG = {
  '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\n  preflight: make preflight\n  preflightFull: make preflight-full\n',
};

/** A fixture repository carrying the committed bundle as its `omni`, and nothing else of the kit. */
function repoWithBundle() {
  const repo = makeRepo({ git: true, files: CONFIG });
  mkdirSync(join(repo.root, '.omni-loop/bin'), { recursive: true });
  copyFileSync(DIST, join(repo.root, BIN));
  return repo;
}

/** `omni <argv>` run by the bundle, with plain node. */
function bundled(root, argv) {
  const run = spawnSync(process.execPath, [BIN, ...argv], { cwd: root, encoding: 'utf8' });
  return { code: run.status, out: run.stdout, err: run.stderr };
}

/** `omni <argv>` run from the kit's source. */
async function fromSource(root, argv) {
  const out = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write() {} } });
  return { code, out: out.join('') };
}

describe('the committed bundle, alone in a fixture repository (acceptance criterion 6)', () => {
  it('prints every form’s kit defaults, exactly as the kit’s source does', async () => {
    const { root } = repoWithBundle();
    expect(existsSync(join(root, 'node_modules'))).toBe(false);
    for (const id of FORM_IDS) {
      const bundle = bundled(root, ['kb', 'show', id]);
      expect(bundle.err, id).toBe('');
      expect(bundle.code, id).toBe(0);
      expect(bundle.out, id).toBe((await fromSource(root, ['kb', 'show', id])).out);
    }
    const testing = bundled(root, ['kb', 'show', 'testing']).out;
    expect(testing).toContain('## Commands  [kit default]\n`make check` runs the whole suite.');
    expect(testing).toContain('## Never  [kit default]\n- A test never proves implementation trivia');
  });

  it('lays down the same blank forms as the kit’s source, and grades them the same', async () => {
    const bundle = repoWithBundle();
    const source = makeRepo({ git: true, files: CONFIG });
    const wrote = bundled(bundle.root, ['kb', 'init']);
    expect(wrote.code).toBe(0);
    expect(wrote.out).toBe((await fromSource(source.root, ['kb', 'init'])).out);
    for (const path of wrote.out.match(/^wrote (.+)$/gm).map((line) => line.slice('wrote '.length))) {
      expect(readFileSync(join(bundle.root, path), 'utf8'), path).toBe(source.read(path));
    }
    const checked = bundled(bundle.root, ['check', 'kb']);
    expect(checked.code).toBe(0);
    expect(checked.out).toBe((await fromSource(source.root, ['check', 'kb'])).out);
  });
});
