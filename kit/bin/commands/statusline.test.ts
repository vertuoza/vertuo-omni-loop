// `omni statusline` under `OMNI_TOKEN` (PRD 1628): line 1 shows `token ··<last four>` where it says
// how the session is signed in, from the variable alone (the status line never fetches), and no line
// holds the token past its last four. Through `main()` on a fixture repository.
import { describe, expect, it } from 'vitest';
import { writeMode } from '../../lib/ask/local-state.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
const NOW = Date.parse('2026-09-28T12:00:00Z');

function payload(dir: string): string {
  return JSON.stringify({
    session_id: 'abc',
    cwd: dir,
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: { current_dir: dir, project_dir: dir },
  });
}

async function statusline(stdin: (root: string) => string, env: Record<string, string>) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\n' } });
  writeMode(root, { host: 'ask.example.test' });
  const out: string[] = [];
  const err: string[] = [];
  const spawn = () => ({ unref() {}, on() { return this; } });
  const fetch = () => Promise.reject(new Error('the status line never fetches'));
  const code = await main(['statusline'], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env: { NO_COLOR: '1', ...env },
    now: () => NOW,
    stdin: stdin(root),
    spawn,
    fetch,
  });
  return { code, lines: out.join('').split('\n'), err: err.join('') };
}

describe('omni statusline under OMNI_TOKEN', () => {
  it('shows the token\'s last four at the end of line 1, after ask on', async () => {
    const run = await statusline(payload, { OMNI_TOKEN: TOKEN });
    expect(run.code).toBe(0);
    expect(run.err).toBe('');
    expect(run.lines[0]).toBe('Opus 5.5 · context — · ask on · token ··9wQv');
    const text = run.lines.join('\n');
    for (let at = 0; at + 5 <= TOKEN.length; at += 1) expect(text).not.toContain(TOKEN.slice(at, at + 5));
  });

  it('shows it even when the session\'s JSON cannot be read', async () => {
    expect((await statusline(() => '{ not json', { OMNI_TOKEN: TOKEN })).lines[0]).toBe('omni · token ··9wQv');
  });

  it('shows nothing of the kind when OMNI_TOKEN is unset', async () => {
    expect((await statusline(payload, {})).lines[0]).toBe('Opus 5.5 · context — · ask on');
  });
});
