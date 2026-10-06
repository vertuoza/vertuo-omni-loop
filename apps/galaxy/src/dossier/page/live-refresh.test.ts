import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DossierPulse } from '../store';
import { signature, type LivePulse } from './live';
import { newWorkKey, readGithubReadAt, watchNewWork, withGithubReadAt, type WatchedPulse } from './live-refresh-watch';

// Calmer polling (PRD 657, s10): the PRD page re-renders from the server only when a new version or a
// new round appears, not on any other move of its signature (an answer, the stage, the outbox count).

const PULSE: DossierPulse = { asked: 2, answered: 1, latest: { spec: 3, 'before-after': 1 } };
const GITHUB = { stage: 'building', open: 1, answers: '0@' } as const;

/** A watcher over a list of reads, one per tick. */
function watching(initial: LivePulse | null, reads: (WatchedPulse | LivePulse | null | Error)[]) {
  const onChange = vi.fn();
  const onProblem = vi.fn();
  const queue = [...reads];
  const tick = watchNewWork({
    initial: initial === null ? null : signature(initial),
    read: () => {
      const next = queue.shift();
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next ?? null);
    },
    onChange,
    onProblem,
  });
  return { tick, onChange, onProblem };
}

describe('the new-work key', () => {
  it('keeps the rounds asked and every kind\'s version count, and drops the answers and GitHub', () => {
    expect(newWorkKey(signature({ ...PULSE, github: GITHUB }))).toBe(newWorkKey(signature({ ...PULSE, answered: 2 })));
    expect(newWorkKey(signature({ ...PULSE, asked: 3 }))).not.toBe(newWorkKey(signature(PULSE)));
    expect(newWorkKey(signature({ ...PULSE, latest: { ...PULSE.latest, plan: 1 } }))).not.toBe(newWorkKey(signature(PULSE)));
    expect(newWorkKey('gone')).toBe('gone');
    expect(newWorkKey(null)).toBeNull();
  });
});

describe('the PRD page\'s refresh', () => {
  it('does not refresh on a signature change with no new version and no new round', async () => {
    const { tick, onChange } = watching({ ...PULSE, github: GITHUB }, [
      { ...PULSE, answered: 2, github: GITHUB },
      { ...PULSE, answered: 2, github: { stage: 'outbox', open: 3, answers: '1@2026-09-29T09:00:00Z' } },
      { ...PULSE, answered: 2 },
    ]);
    await tick();
    await tick();
    await tick();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes on a new version', async () => {
    const { tick, onChange } = watching(PULSE, [{ ...PULSE, latest: { ...PULSE.latest, spec: 4 } }]);
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('refreshes on a new round, once', async () => {
    const next = { ...PULSE, asked: 3 };
    const { tick, onChange } = watching(PULSE, [next, next]);
    await tick();
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the dossier is gone', async () => {
    const { tick, onChange } = watching(PULSE, [null]);
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('takes the first read as the baseline when the page was rendered without a signature', async () => {
    const { tick, onChange } = watching(null, [PULSE, { ...PULSE, asked: 3 }]);
    await tick();
    expect(onChange).not.toHaveBeenCalled();
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('still says so after three failed reads in a row', async () => {
    const { tick, onProblem } = watching(PULSE, [new Error('x'), new Error('x'), new Error('x')]);
    await tick();
    await tick();
    expect(onProblem).not.toHaveBeenCalled();
    await tick();
    expect(onProblem).toHaveBeenLastCalledWith(expect.any(String));
  });

  it('is what LiveRefresh watches with, reading the pulse and no GitHub', () => {
    const source = readFileSync(join(__dirname, 'live-refresh.tsx'), 'utf8');
    expect(source).toMatch(/watchNewWork\(/);
    expect(source).not.toMatch(/readLiveGithub|watchChanges\(/);
  });

  it('refreshes once when the GitHub snapshot is read again, its first read the baseline (PRD 902, s2)', async () => {
    const at = (githubReadAt: string): WatchedPulse => ({ ...PULSE, githubReadAt });
    const { tick, onChange } = watching(PULSE, [at('none'), at('none'), at('2026-10-05T09:30:00Z'), PULSE, at('2026-10-05T09:30:00Z'), at('2026-10-05T09:31:00Z')]);
    await tick();
    await tick();
    expect(onChange).not.toHaveBeenCalled();
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
    await tick();
    await tick();
    expect(onChange).toHaveBeenCalledTimes(1);
    await tick();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

});

describe('when the GitHub snapshot was read', () => {
  /** A client answering dossier_github's read with `answer`, recording the calls. */
  const client = (answer: { data: unknown; error: { message: string } | null }) => {
    const calls: unknown[][] = [];
    const chain = {
      select: (...args: unknown[]) => { calls.push(['select', ...args]); return chain; },
      eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return chain; },
      maybeSingle: () => Promise.resolve(answer),
    };
    return { calls, db: { from: (table: string) => { calls.push(['from', table]); return chain; } } as never };
  };

  it('reads read_at as the member, and none without a snapshot', async () => {
    const { calls, db } = client({ data: { read_at: '2026-10-05T09:30:00Z' }, error: null });
    expect(await readGithubReadAt(db, 'd1')).toBe('2026-10-05T09:30:00Z');
    expect(calls).toEqual([['from', 'dossier_github'], ['select', 'read_at'], ['eq', 'dossier_id', 'd1']]);
    expect(await readGithubReadAt(client({ data: null, error: null }).db, 'd1')).toBe('none');
  });

  it('throws on a refusal or a row that does not parse', async () => {
    await expect(readGithubReadAt(client({ data: null, error: { message: 'down' } }).db, 'd1')).rejects.toThrow('down');
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(readGithubReadAt(client({ data: { read_at: 1 }, error: null }).db, 'd1')).rejects.toThrow();
    quiet.mockRestore();
  });

  it('joins the pulse, and is left out when its read fails', async () => {
    expect(await withGithubReadAt(() => Promise.resolve(PULSE), () => Promise.resolve('none'))()).toEqual({ ...PULSE, githubReadAt: 'none' });
    expect(await withGithubReadAt(() => Promise.resolve(PULSE), () => Promise.reject(new Error('x')))()).toEqual(PULSE);
    expect(await withGithubReadAt(() => Promise.resolve(null), () => Promise.resolve('none'))()).toBeNull();
  });
});
