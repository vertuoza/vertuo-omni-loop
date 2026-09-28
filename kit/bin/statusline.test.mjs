// PRD #324, slice s1: `omni statusline` through `main()` — Claude Code's JSON on stdin, the session
// line out, the no-PRD line where the loop is installed, exit 0 and nothing on stderr every time.
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { writeMode } from '../lib/ask/local-state.mjs';
import { makeRepo } from '../test/fixture.mjs';
import { COMMAND_TABLE } from './commands/index.mjs';
import { main } from './omni.mjs';

const CLI = fileURLToPath(new URL('./omni.mjs', import.meta.url));
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\n' };
const NOW = Date.parse('2026-09-28T12:00:00Z');
const MINUTE = 60_000;
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const PLAIN = { NO_COLOR: '1' };
const NO_PRD = 'no PRD · /omni:brainstorm to start';
const BAR = '█████░░░░░';

/** Claude Code's JSON for a session in `dir`: 58.9 % of the context, 25.4 % of the 5-hour window, 90 minutes left. */
function payload(dir, more = {}) {
  return JSON.stringify({
    session_id: 'abc',
    cwd: dir,
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: { current_dir: dir, project_dir: dir },
    context_window: { used_percentage: 58.9 },
    rate_limits: { five_hour: { used_percentage: 25.4, resets_at: (NOW + 90 * MINUTE) / 1000 } },
    ...more,
  });
}

/** `execFileSync`, with every call it runs recorded as `<file> <args…>`. */
function recordingExec() {
  const calls = [];
  const exec = (file, args, options) => {
    calls.push([file, ...args].join(' '));
    return execFileSync(file, args, options);
  };
  return { calls, exec };
}

/** Runs `omni statusline` in `cwd` with `stdin` as its input: `{ code, out, err, calls }`. */
async function statusline(cwd, stdin, options = {}) {
  const out = [];
  const err = [];
  const { calls, exec } = recordingExec();
  const code = await main(['statusline'], {
    cwd,
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    exec,
    env: PLAIN,
    now: () => NOW,
    stdin,
    ...options,
  });
  return { code, out: out.join(''), err: err.join(''), calls };
}

const neverFetches = (calls) => calls.every((call) => !/^git\b.*\bfetch\b/.test(call) && !/^gh\b/.test(call));

describe('omni statusline', () => {
  it('is in the command table', () => {
    expect(Object.keys(COMMAND_TABLE)).toContain('statusline');
    expect(COMMAND_TABLE.statusline.withoutContext).toBe(true);
  });

  it('prints the session line, then the no-PRD line, where the loop is installed', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    const run = await statusline(root, payload(root));
    expect(run).toMatchObject({
      code: 0,
      err: '',
      out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30 · ask on\n${NO_PRD}\n`,
    });
    expect(neverFetches(run.calls)).toBe(true);
  });

  it('colours the context bar and its percentage unless NO_COLOR is set', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const coloured = await statusline(root, payload(root), { env: {} });
    expect(coloured.out).toBe(`Opus 5.5 · context ${YELLOW}${BAR} 58%${RESET} · usage 25%, resets in 1h30\n${NO_PRD}\n`);
    const plain = await statusline(root, payload(root), { env: { NO_COLOR: '1' } });
    expect(plain.out).not.toContain('\x1b');
  });

  it('reads the session folder from the JSON, not from where it runs', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const elsewhere = mkdtempSync(join(tmpdir(), 'omni-elsewhere-'));
    expect((await statusline(elsewhere, payload(root))).out).toContain(`\n${NO_PRD}\n`);
    expect((await statusline(root, payload(elsewhere))).out).not.toContain(NO_PRD);
  });

  it('leaves out the usage once its reset has passed, and `ask on` while ask mode is off', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await statusline(root, payload(root), { now: () => NOW + 91 * MINUTE });
    expect(run.out).toBe(`Opus 5.5 · context ${BAR} 58%\n${NO_PRD}\n`);
  });

  it('prints only line 1 in a repository with no config, and outside any repository', async () => {
    const bare = makeRepo({ git: true });
    const inBare = await statusline(bare.root, payload(bare.root));
    expect(inBare).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
    const outside = mkdtempSync(join(tmpdir(), 'omni-outside-'));
    const nowhere = await statusline(outside, payload(outside));
    expect(nowhere).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
  });

  it('prints `omni` for text that is not JSON, and for no text at all', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    for (const stdin of ['not json at all', '', '[1, 2]']) {
      expect(await statusline(root, stdin)).toMatchObject({ code: 0, err: '', out: 'omni\n' });
    }
  });

  it('prints `context —` early in a session, when Claude Code sends no percentage', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await statusline(root, payload(root, { context_window: { used_percentage: null }, rate_limits: undefined }));
    expect(run.out).toBe(`Opus 5.5 · context —\n${NO_PRD}\n`);
  });

  it('prints line 1 from the JSON alone when its reader throws', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    const readFacts = () => {
      throw new Error('the disk is gone');
    };
    const run = await statusline(root, payload(root), { readFacts });
    expect(run).toMatchObject({ code: 0, err: '', out: `Opus 5.5 · context ${BAR} 58% · usage 25%, resets in 1h30\n` });
  });

  it('exits 0 with nothing on stderr when its output cannot be written', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const err = [];
    const code = await main(['statusline'], {
      cwd: root,
      stdout: { write: () => { throw new Error('EPIPE'); } },
      stderr: { write: (s) => err.push(s) },
      env: PLAIN,
      stdin: payload(root),
    });
    expect({ code, err: err.join('') }).toEqual({ code: 0, err: '' });
  });

  it.each([40, 80, 200])('fits every line within COLUMNS=%i', async (columns) => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeMode(root, { host: 'ask.example.test' });
    for (const env of [{ COLUMNS: String(columns) }, { COLUMNS: String(columns), NO_COLOR: '1' }]) {
      const run = await statusline(root, payload(root), { env });
      const lines = run.out.replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, -1);
      expect(lines).toHaveLength(2);
      for (const line of lines) expect([...line].length).toBeLessThanOrEqual(columns);
      expect(lines[0].endsWith('…')).toBe(columns < 70);
    }
  });

  it('reads COLUMNS as 80 when it is unset or not a number', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const long = payload(root, { model: { display_name: 'A model whose display name is long enough to push the line past eighty' } });
    for (const env of [PLAIN, { ...PLAIN, COLUMNS: 'wide' }]) {
      const [line] = (await statusline(root, long, { env })).out.split('\n');
      expect([...line].length).toBe(80);
      expect(line.endsWith('…')).toBe(true);
    }
  });

  it('reads its stdin from the process when run as a command', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const run = await new Promise((resolve) => {
      const child = execFile(process.execPath, [CLI, 'statusline'], { cwd: root, env: { ...process.env, NO_COLOR: '1', COLUMNS: '200' }, encoding: 'utf8' }, (error, stdout, stderr) => {
        resolve({ code: error ? error.code : 0, stdout, stderr });
      });
      child.stdin.end(payload(root, { rate_limits: undefined }));
    });
    expect(run).toEqual({ code: 0, stderr: '', stdout: `Opus 5.5 · context ${BAR} 58%\n${NO_PRD}\n` });
  });
});
