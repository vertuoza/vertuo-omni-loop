import { describe, expect, it, vi } from 'vitest';
import type { Priority } from '@omni/github';
import type { FixSummary } from '../github/fix';
import { UNREAD } from '../github/summary';
import { fixFacts, type FixFactsDeps } from './fix-facts';

// A fix's page renders from fix_facts (PRD 902, s2): stored facts at once, refreshed after the response
// while not final; none stored, one interactive read, stored after.

const OPEN: FixSummary = { issue: null, pull: null, approvals: [], release: null };
const SHIPPED: FixSummary = { ...OPEN, release: { tag: 'v1.2.0', url: 'https://github.com/acme/widgets/releases/v1.2.0', at: '2026-10-01T09:00:00Z' } };

function depsWith(stored: FixSummary | null | Error, read: FixSummary | null) {
  const reads: Priority[] = [];
  const kept: FixSummary[] = [];
  const later: (() => Promise<void>)[] = [];
  const deps: FixFactsDeps = {
    stored: () => (stored instanceof Error ? Promise.reject(stored) : Promise.resolve(stored)),
    read: (priority) => { reads.push(priority); return Promise.resolve(read); },
    keep: (value) => { kept.push(value); return Promise.resolve(); },
    later: (task) => { later.push(task); },
    log: vi.fn(),
  };
  const runLater = async () => { for (const task of later.splice(0)) await task(); };
  return { deps, reads, kept, runLater };
}

describe('a fix page\'s facts', () => {
  it('renders the stored facts without waiting on GitHub, and refreshes them after, in the background', async () => {
    const fresh = { ...OPEN, approvals: [{ login: 'bob', at: '2026-10-05T09:00:00Z' }] };
    const { deps, reads, kept, runLater } = depsWith(OPEN, fresh);
    expect(await fixFacts(deps)).toEqual(OPEN);
    expect(reads).toEqual([]);
    await runLater();
    expect(reads).toEqual(['background']);
    expect(kept).toEqual([fresh]);
  });

  it('reads nothing for a fix whose stored facts are final', async () => {
    const { deps, reads, runLater } = depsWith(SHIPPED, OPEN);
    expect(await fixFacts(deps)).toEqual(SHIPPED);
    await runLater();
    expect(reads).toEqual([]);
  });

  it('with none stored, reads GitHub once, interactively, and stores it after', async () => {
    const { deps, reads, kept, runLater } = depsWith(null, OPEN);
    expect(await fixFacts(deps)).toEqual(OPEN);
    expect(reads).toEqual(['interactive']);
    await runLater();
    expect(kept).toEqual([OPEN]);
  });

  it('keeps nothing when GitHub could not be read, and keeps the stored facts when a refresh fails', async () => {
    const none = depsWith(null, null);
    expect(await fixFacts(none.deps)).toBeNull();
    await none.runLater();
    expect(none.kept).toEqual([]);
    const failed = depsWith({ ...OPEN, pull: UNREAD }, null);
    expect(await fixFacts(failed.deps)).toEqual({ ...OPEN, pull: UNREAD });
    await failed.runLater();
    expect(failed.kept).toEqual([]);
  });

  it('reads GitHub when the stored facts cannot be read', async () => {
    const { deps, reads } = depsWith(new Error('down'), OPEN);
    expect(await fixFacts(deps)).toEqual(OPEN);
    expect(reads).toEqual(['interactive']);
    expect(deps.log).toHaveBeenCalledTimes(1);
  });
});
