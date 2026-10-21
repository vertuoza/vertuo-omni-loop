import { describe, expect, it } from 'vitest';
import type { Board, Runner } from '../runners.contract';
import { jobHref, queuedWords, sendable, sendOptions } from './targets';

// Send to terminal's targets (PRD 1830 s4): which runners the viewer may send a line to, as the picker
// lists them — Any runner, then each fleet with a runner, then each runner by name with its state —
// each only when the viewer may send there, and only runners that hold the line's repository.

const REPO = 'demo-org/app';
let n = 0;
const runner = (name: string, more: Partial<Runner> = {}): Runner => {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-0000018304${String(n).padStart(2, '0')}`, name, owner: '00000000-0000-4000-8000-0000018300a1', fleet: null,
    slots: 2, used: 0, repos: [REPO], version: '0.0.389', lastSeenAt: '2026-10-13T12:00:00.000Z', state: 'online', ...more,
  };
};
const member = { id: '00000000-0000-4000-8000-0000018300b1', owner: false, fleet: 'cyan' };
const board = (runners: Runner[], viewer: Board['viewer'] = member): Pick<Board, 'runners' | 'viewer'> => ({ runners, viewer });
const labels = (b: Pick<Board, 'runners' | 'viewer'>, repo = REPO) =>
  sendOptions(b, repo).map((o) => `${o.group} ${o.label}${o.state ? ` (${o.state})` : ''}`);

describe('Send to terminal\'s targets', () => {
  it('lists Any runner, then each fleet with a runner, then each runner by name with its state', () => {
    const b = board([runner('nimbus-agents', { fleet: 'cyan', state: 'busy', used: 2 }), runner('mac-mini'), runner('lap', { state: 'offline' })]);
    expect(labels(b)).toEqual(['any Any runner', 'fleet cyan (1 online)', 'runner lap (Offline)', 'runner mac-mini (Online)', 'runner nimbus-agents (Busy)']);
  });

  it('gives each option the target the route takes', () => {
    const shared = runner('mac-mini');
    const fleeted = runner('box', { fleet: 'cyan' });
    const options = sendOptions(board([shared, fleeted]), REPO);
    expect(options.map((o) => o.target)).toEqual([
      { kind: 'any' }, { kind: 'fleet', fleet: 'cyan' }, { kind: 'runner', runner: fleeted.id }, { kind: 'runner', runner: shared.id },
    ]);
    expect(new Set(options.map((o) => o.key)).size).toBe(options.length);
  });

  it('leaves out a fleet and its runners the viewer is not in, unless they own the workspace', () => {
    const b = board([runner('red-box', { fleet: 'red' }), runner('mac-mini')]);
    expect(labels(b)).toEqual(['any Any runner', 'runner mac-mini (Online)']);
    expect(labels(board(b.runners, { ...member, owner: true, fleet: null })))
      .toEqual(['any Any runner', 'fleet red (1 online)', 'runner mac-mini (Online)', 'runner red-box (Online)']);
  });

  it('offers Any runner only when a runner with no fleet would take it', () => {
    expect(labels(board([runner('box', { fleet: 'cyan' })]))).toEqual(['fleet cyan (1 online)', 'runner box (Online)']);
  });

  it('says a fleet whose runners are all silent is offline', () => {
    expect(labels(board([runner('box', { fleet: 'cyan', state: 'offline' })]))).toEqual(['fleet cyan (Offline)', 'runner box (Offline)']);
  });

  it('lists only runners that hold the line\'s repository, whatever its case', () => {
    const b = board([runner('other', { repos: ['demo-org/site'] }), runner('mac-mini', { repos: ['Demo-Org/App'] })]);
    expect(labels(b)).toEqual(['any Any runner', 'runner mac-mini (Online)']);
    expect(labels(b, 'demo-org/nothing')).toEqual([]);
  });

  it('lists nothing with no runner', () => {
    expect(sendOptions(board([]), REPO)).toEqual([]);
  });

  it('sends only a line a runner runs', () => {
    expect(sendable('/omni:yolo 1717')).toBe(true);
    expect(sendable('/omni:pr-care 1801')).toBe(true);
    expect(sendable('/omni:pitch 859 --for customers')).toBe(true);
    expect(sendable('/omni:brainstorm --rework 1717')).toBe(false);
    expect(sendable('/omni:drive')).toBe(false);
    expect(sendable('/omni:yolo 1; rm -rf /')).toBe(false);
  });

  it('words the queued line and links the job on the Runners page', () => {
    const [any, fleet] = sendOptions(board([runner('mac-mini'), runner('box', { fleet: 'cyan' })]), REPO);
    expect(any && queuedWords(any)).toBe('Queued for any runner');
    expect(fleet && queuedWords(fleet)).toBe('Queued for cyan');
    expect(jobHref('00000000-0000-4000-8000-000001830201')).toBe('/app/runners#job-00000000-0000-4000-8000-000001830201');
  });
});
