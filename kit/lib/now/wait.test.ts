// PRD #1322, slice s5: the approval wait `omni now` adds to its answer, read from the waiting file
// `omni wait approval` keeps at `.omni-loop/local/approval-wait/<n>.json` — the waiting line while it
// waits or is held, the approved or voided line as a toast for 10 seconds from when it was written,
// then the waiting line again after a void and nothing after an approval.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { readNow } from './read.ts';
import { readWait } from './wait.ts';

const AT = Date.parse('2026-10-09T12:00:00.000Z');
const WAITING = '◌ PRD 1322 · waiting for Irisa or Paul';
const APPROVED = '✓ PRD 1322 approved by irisa · 2026-10-09T12:00:00.000Z · 3 files pinned';
const VOIDED = "✗ approval voided by paul's push 1234567→89abcde · asked again";

let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'omni-now-wait-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(prd: number, file: unknown, where = root): void {
  const dir = join(where, '.omni-loop/local/approval-wait');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${prd}.json`), typeof file === 'string' ? file : JSON.stringify(file));
}

const state = (prd: number, kind: string, line: string, at = AT, waiting: string | null = WAITING) => ({ prd, state: kind, line, waiting, at: new Date(at).toISOString() });

describe('the approval wait omni now reads', () => {
  it('is the waiting line while the wait waits, long after it was written', () => {
    write(1322, state(1322, 'waiting', WAITING));
    expect(readWait(root, 1322, AT + 3_600_000)).toEqual({ prd: 1322, line: WAITING, toast: false, until: null });
  });

  it('stays the waiting line while the server is unreachable, or the held line before anyone was asked', () => {
    write(1322, state(1322, 'held', 'server unreachable · held, not failed'));
    expect(readWait(root, 1322, AT)).toEqual({ prd: 1322, line: WAITING, toast: false, until: null });
    write(1322, state(1322, 'held', 'server unreachable · held, not failed', AT, null));
    expect(readWait(root, 1322, AT)).toEqual({ prd: 1322, line: 'server unreachable · held, not failed', toast: false, until: null });
  });

  it('is the approved line as a toast for 10 seconds from when it was written, then nothing', () => {
    write(1322, state(1322, 'approved', APPROVED));
    expect(readWait(root, 1322, AT)).toEqual({ prd: 1322, line: APPROVED, toast: true, until: AT + 10_000 });
    expect(readWait(root, 1322, AT + 9_999)).toEqual({ prd: 1322, line: APPROVED, toast: true, until: AT + 10_000 });
    expect(readWait(root, 1322, AT + 10_000)).toBeNull();
  });

  it('is the voided line as a toast for 10 seconds, then the waiting line again', () => {
    write(1322, state(1322, 'voided', VOIDED));
    expect(readWait(root, 1322, AT + 5_000)).toEqual({ prd: 1322, line: VOIDED, toast: true, until: AT + 10_000 });
    expect(readWait(root, 1322, AT + 10_000)).toEqual({ prd: 1322, line: WAITING, toast: false, until: null });
  });

  it('is nothing once the wait ended signed out, timed out or refused', () => {
    for (const ended of ['signed-out', 'timeout', 'refused']) {
      write(1322, state(1322, ended, 'held: still waiting for Irisa or Paul after 60 min'));
      expect(readWait(root, 1322, AT), ended).toBeNull();
    }
  });

  it("prefers the work's PRD, else the latest wait that shows something", () => {
    write(1322, state(1322, 'waiting', WAITING, AT));
    write(1400, state(1400, 'waiting', '◌ PRD 1400 · waiting for Paul', AT + 1_000, '◌ PRD 1400 · waiting for Paul'));
    write(1500, state(1500, 'approved', APPROVED, AT - 60_000));
    expect(readWait(root, 1322, AT + 2_000)?.prd).toBe(1322);
    expect(readWait(root, null, AT + 2_000)?.prd).toBe(1400);
    expect(readWait(root, 1500, AT + 2_000)?.prd).toBe(1400);
  });

  it('is nothing with no folder, and skips a file half-written, of another shape or with no time', () => {
    expect(readWait(root, 1322, AT)).toBeNull();
    write(1322, '{"prd": 1322, "state": ');
    write(1400, { prd: 1400, state: 'waiting' });
    write(1500, state(1500, 'unknown', WAITING));
    write(1600, { ...state(1600, 'approved', APPROVED), at: 'yesterday' });
    expect(readWait(root, 1322, AT)).toBeNull();
    mkdirSync(join(root, '.omni-loop/local/approval-wait/1700.json'));
    write(1800, state(1800, 'waiting', WAITING));
    expect(readWait(root, 1322, AT)?.prd).toBe(1800);
  });
});

describe('omni now with an approval wait', () => {
  it("adds the work's PRD's wait to the answer, else the latest one, and nothing without one", () => {
    const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\n', '.omni-loop/delivery/inbox/0007-bravo/spec.md': '# bravo\n' } });
    try {
      const read = () => readNow({ cwd: repo.root, folder: null, sessionId: null, exec: realExec, now: AT });
      expect(read()).toEqual({ headline: null, work: null, doing: null });
      write(9, state(9, 'waiting', '◌ PRD 9 · waiting for Paul', AT, '◌ PRD 9 · waiting for Paul'), repo.root);
      expect(read()).toEqual({ headline: null, work: null, doing: null, wait: { prd: 9, line: '◌ PRD 9 · waiting for Paul', toast: false, until: null } });
      write(7, state(7, 'approved', APPROVED, AT - 1_000), repo.root);
      execFileSync('git', ['checkout', '-q', '-b', 'feat/bravo'], { cwd: repo.root, stdio: 'ignore' });
      expect(read()).toMatchObject({ work: { kind: 'prd', number: 7 }, wait: { prd: 7, line: APPROVED, toast: true, until: AT + 9_000 } });
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });
});
