import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Install's "Put omni on your PATH" step (PRD 373): the block the page shows, run as it is, writes
// ~/.local/bin/omni and puts ~/.local/bin on the PATH in ~/.zshrc; the script it writes runs the
// checkout's own .omni-loop/bin/omni.mjs from any subfolder, and outside a checkout with the kit it
// prints one line and exits 2. HOME is a scratch folder, so nothing touches the real one.

const INSTALL = fileURLToPath(new URL('../../../../../docs/guide/install.md', import.meta.url));
const NO_KIT = 'omni: no Omni Loop kit here (.omni-loop/bin/omni.mjs). cd into a repository that has it.';

/** The code of the first fenced block under Install's "Put omni on your PATH" heading: the one to
 * paste (the next one is its `omni help` check). */
function pathBlock(markdown: string): string {
  const section = markdown.split(/^### /m).find((part) => part.startsWith('Put omni on your PATH'));
  const block = section?.split(/^## /m)[0].match(/^```[^\n]*\n([\s\S]*?)^```$/m);
  if (!block) throw new Error('install.md has no "Put omni on your PATH" block');
  return block[1];
}

describe('Put omni on your PATH', () => {
  let dir = '';
  let home = '';
  let env: NodeJS.ProcessEnv = {};

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'omni-path-')));
    home = join(dir, 'home');
    mkdirSync(home);
    // No git lookup climbs above the scratch folder, wherever the temp folder sits.
    env = { ...process.env, HOME: home, GIT_CEILING_DIRECTORIES: dir };
    const block = pathBlock(readFileSync(INSTALL, 'utf8'));
    expect(block).toMatch(/^exec zsh$/m);
    // Everything the block does but restart the shell, which a test has no terminal for.
    execFileSync('sh', ['-c', block.replace(/^exec zsh\n?/m, '')], { env, cwd: home, stdio: 'pipe' });
  });
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  const omni = (cwd: string, args: string[]) => spawnSync(join(home, '.local/bin/omni'), args, { cwd, env, encoding: 'utf8' });

  it('puts ~/.local/bin on the PATH in ~/.zshrc', () => {
    expect(readFileSync(join(home, '.zshrc'), 'utf8')).toContain('export PATH="$HOME/.local/bin:$PATH"\n');
  });

  it("runs the checkout's own kit from a subfolder, with every argument", () => {
    const repo = join(dir, 'repo');
    mkdirSync(join(repo, '.omni-loop/bin'), { recursive: true });
    mkdirSync(join(repo, 'src/deep'), { recursive: true });
    writeFileSync(join(repo, '.omni-loop/bin/omni.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
    execFileSync('git', ['init', '-q', repo], { env });
    const run = omni(join(repo, 'src/deep'), ['status', '7', 'two words']);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(['status', '7', 'two words']);
  });

  it('prints one line and exits 2 outside any checkout', () => {
    const run = omni(home, ['help']);
    expect(run.status).toBe(2);
    expect(run.stdout).toBe('');
    expect(run.stderr).toBe(`${NO_KIT}\n`);
  });

  it('prints the same line in a checkout with no kit', () => {
    const repo = join(dir, 'bare');
    execFileSync('git', ['init', '-q', repo], { env });
    const run = omni(repo, ['help']);
    expect(run.status).toBe(2);
    expect(run.stderr).toBe(`${NO_KIT}\n`);
  });
});
