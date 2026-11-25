// A job given its runner's accounts (PRD 2537), whose session ends waiting on its own background work
// (bug 3288): it is resumed on the same account, in the same part, as a job with no accounts is; the
// resumes never count as a turnover. A fake `claude` on the PATH stands in for the real one.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountBook, accountsStateFile } from './accounts.ts';
import type { Account } from './accounts.ts';
import { claudeAgent } from './agents/claude.ts';
import { runJobProcess } from './job.ts';
import { partsPath, readParts } from './turnover.ts';
import type { Turnover } from './turnover.ts';

const SESSION = 'c7e2d3f5-3288-4000-8000-000000000002';
const NOW = Date.parse('2026-11-25T09:22:42.000Z');
const claude = claudeAgent({ projects: join(tmpdir(), 'omni-wake-no-projects') });
const direct = (id: string): Account => ({ id, agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null });

const jsonl = (events: readonly object[]): string => `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
const WAITING = jsonl([
  { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-opus-5-5' },
  { type: 'user', session_id: SESSION, message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'Command did not complete within its 600s timeout and was moved to the background (ID: b9q1). You will be notified when it completes.' }] } },
  { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, num_turns: 11, total_cost_usd: 1.05, duration_ms: 129_000, result: "Slice s1 is building. I'll wait for its result before starting wave 2." },
]);
const FINISHED = jsonl([
  { type: 'system', subtype: 'init', session_id: SESSION, model: 'claude-opus-5-5' },
  { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, num_turns: 4, total_cost_usd: 0.4, duration_ms: 60_000, result: 'Wave 2 merged.\n\nOutcome: ready' },
]);

describe('runJobProcess with a turnover, a session that ends waiting on its background work (bug 3288)', () => {
  it('resumes it on the same account, in one part, and ends done', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-wake-turnover-'));
    const bin = join(root, 'bin');
    const cwd = join(root, 'wt');
    for (const dir of [bin, cwd]) mkdirSync(dir);
    writeFileSync(join(root, 'waiting.jsonl'), WAITING);
    writeFileSync(join(root, 'finished.jsonl'), FINISHED);
    writeFileSync(join(bin, 'claude'), [
      '#!/bin/sh',
      'cat > /dev/null',
      `if [ -e "${root}/ran" ]; then printf '%s\\n' "$@" > "${root}/resumed.args"; cat "${root}/finished.jsonl"; else touch "${root}/ran"; cat "${root}/waiting.jsonl"; fi`,
      '',
    ].join('\n'));
    chmodSync(join(bin, 'claude'), 0o755);
    execFileSync('git', ['-C', cwd, 'init', '-q', '-b', 'main']);
    execFileSync('git', ['-C', cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '-q', '--allow-empty', '-m', 'start']);
    const files = { line: join(root, 'job-9.line'), log: join(root, 'job-9.log'), exit: join(root, 'job-9.exit') };
    writeFileSync(files.line, '/omni:wave 2809\n');
    writeFileSync(files.log, '');
    const accounts = [direct('claude-1'), direct('claude-2')];
    const turnover: Turnover = {
      accounts,
      book: accountBook({ file: accountsStateFile(root), now: () => NOW }),
      agentOf: () => ({ ...claude, check: () => null }),
      seenAs: (account) => ({ id: account.id, model: account.model, secret: null }),
      git: (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }),
      now: () => NOW,
      pressureEveryMs: 10,
    };
    const out = { write: () => undefined };
    const code = await runJobProcess({ cwd, files, out, env: { PATH: `${bin}:${String(process.env.PATH)}` }, agent: claude, account: { id: 'claude-1', model: null, secret: null }, turnover });

    expect(code).toBe(0);
    expect(existsSync(join(root, 'resumed.args'))).toBe(true);
    expect(readFileSync(join(root, 'resumed.args'), 'utf8').trim().split('\n')).toEqual(expect.arrayContaining(['--resume', SESSION]));
    const record = readParts(partsPath(files.log));
    expect(record?.reason).toBeNull();
    expect(record?.parts.map((part) => [part.account, part.ended])).toEqual([['claude-1', 'done']]);
    expect(readFileSync(files.log, 'utf8')).toMatch(/^↻ the session ended waiting on its background work: resumed, 1 of 3$/m);
  });
});
