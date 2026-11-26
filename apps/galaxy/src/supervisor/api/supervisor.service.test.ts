import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { RaiseRequest } from './supervisor.contract';
import type { FindingRow } from './supervisor.repository';
import { DISMISSED_SAME, supervisorService, type Viewer } from './supervisor.service';
import { ACME, ATLAS, fakeStore, signalRow, T0, world, type World } from './supervisor.fake';

// The seat's group raise (PRD omni-loop-35 s2): a raise that names a group fingerprint may hold signals of different
// fingerprints. The finding's fingerprint is the group's, its evidence key the digest of the sorted signal fingerprints;
// a second raise of the open group adds its signals' evidence (50 at most); Not a problem on the group refuses the same
// set and lets a changed set through. On the store's test double.

const GROUP = 'stuck:queue-repo:acme/widgets';
const JOB_A = '00000000-0000-4000-8000-0000000000e1';
const JOB_B = '00000000-0000-4000-8000-0000000000e2';
const JOB_C = '00000000-0000-4000-8000-0000000000e3';

const queued = (job: string, minutes: number) => signalRow({
  fingerprint: `stuck:queue:${job}`, check_name: 'queue-stuck', check_line: `Queue nobody can take: queued ${String(minutes)} min`,
  figures: { minutes }, evidence: [{ job }], evidence_key: `key-${job}`,
});

const digest = (parts: readonly unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);

function setup(w: World) {
  const clock = { now: () => new Date(T0), sleep: () => Promise.resolve() };
  const service = supervisorService({ store: fakeStore(w), clock, alert: () => Promise.resolve() });
  const seat = w.seats.find((s) => s.runner_id === ATLAS);
  if (!seat) throw new Error('no seat');
  const viewer: Viewer & { kind: 'seat' } = { kind: 'seat', workspace: ACME, seat };
  return { service, viewer };
}

const raise = (signals: string[], change: Partial<RaiseRequest> = {}): RaiseRequest => ({
  kind: 'stuck', severity: 'medium', title: 'Nobody can take the jobs of acme/widgets', signals, fingerprint: GROUP, evidence: [],
  explanation: 'No online runner serves acme/widgets.', suggestions: [], ...change,
});

const dismiss = (row: FindingRow) => { Object.assign(row, { state: 'dismissed', closed_at: T0 }); };

describe('the group raise', () => {
  it('AC-7: two open signals with different fingerprints raised under one group fingerprint make one finding holding both', async () => {
    const a = queued(JOB_A, 300);
    const b = queued(JOB_B, 200);
    const w = world({ signals: [a, b] });
    const { service, viewer } = setup(w);
    const reply = await service.raise(viewer, raise([a.id, b.id]), 'https://omni.example.test');
    expect(reply).toMatchObject({ ok: true, value: { raised: true, finding: { fingerprint: GROUP, evidence: [{ job: JOB_A }, { job: JOB_B }] } } });
    expect(w.findings).toHaveLength(1);
    const [finding] = w.findings;
    expect(w.signals.map((s) => s.finding_id)).toEqual([finding?.id, finding?.id]);
    expect(finding?.evidence_key).toBe(digest([a.fingerprint, b.fingerprint].sort()));
    expect(finding?.figures).toMatchObject({ signals: 2 });
  });

  it('keys the group on its set of fingerprints, whatever the order the signals are named in', async () => {
    const a = queued(JOB_A, 300);
    const b = queued(JOB_B, 200);
    const w = world({ signals: [a, b] });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise([b.id, a.id]), 'https://omni.example.test');
    expect(w.findings[0]?.evidence_key).toBe(digest([a.fingerprint, b.fingerprint].sort()));
  });

  it('a second raise of the same group adds its signals and their evidence to the open finding', async () => {
    const a = queued(JOB_A, 300);
    const b = queued(JOB_B, 200);
    const c = queued(JOB_C, 100);
    const w = world({ signals: [a, b, c] });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise([a.id, b.id]), 'https://omni.example.test');
    const again = await service.raise(viewer, raise([b.id, c.id]), 'https://omni.example.test');
    expect(again).toMatchObject({ ok: true, value: { raised: false } });
    expect(w.findings).toHaveLength(1);
    const [finding] = w.findings;
    expect(finding?.evidence).toEqual([{ job: JOB_A }, { job: JOB_B }, { job: JOB_C }]);
    expect(finding?.figures).toMatchObject({ signals: 3 });
    expect(finding?.evidence_key).toBe(digest([a.fingerprint, b.fingerprint, c.fingerprint].sort()));
    expect(w.signals.every((s) => s.finding_id === finding?.id)).toBe(true);
  });

  it('keeps a group\'s evidence at 50 entries at most', async () => {
    const many = Array.from({ length: 10 }, (_, n) => signalRow({
      fingerprint: `stuck:queue:job-${String(n)}`, evidence: Array.from({ length: 6 }, (_, k) => ({ job: `job-${String(n)}`, k })), evidence_key: `k-${String(n)}`,
    }));
    const w = world({ signals: many });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise(many.slice(0, 5).map((s) => s.id)), 'https://omni.example.test');
    expect(w.findings[0]?.evidence).toHaveLength(30);
    await service.raise(viewer, raise(many.slice(5).map((s) => s.id)), 'https://omni.example.test');
    expect(w.findings[0]?.evidence).toHaveLength(50);
  });

  it('Not a problem on a group refuses the same set and lets a changed set through', async () => {
    const a = queued(JOB_A, 300);
    const b = queued(JOB_B, 200);
    const c = queued(JOB_C, 100);
    const w = world({ signals: [a, b, c] });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise([a.id, b.id]), 'https://omni.example.test');
    const [first] = w.findings;
    if (!first) throw new Error('not raised');
    dismiss(first);
    for (const s of w.signals) s.finding_id = null;

    expect(await service.raise(viewer, raise([b.id, a.id]), 'https://omni.example.test')).toEqual({ ok: false, kind: 'conflict', error: DISMISSED_SAME });
    expect(w.findings).toHaveLength(1);

    const changed = await service.raise(viewer, raise([a.id, b.id, c.id]), 'https://omni.example.test');
    expect(changed).toMatchObject({ ok: true, value: { raised: true, finding: { fingerprint: GROUP, state: 'open' } } });
    expect(w.findings).toHaveLength(2);
  });

  it('still refuses signals of different fingerprints without a group fingerprint', async () => {
    const a = queued(JOB_A, 300);
    const b = queued(JOB_B, 200);
    const { fingerprint: _none, ...alone } = raise([a.id, b.id]);
    const { service, viewer } = setup(world({ signals: [a, b] }));
    expect(await service.raise(viewer, alone, 'https://omni.example.test'))
      .toEqual({ ok: false, kind: 'malformed', error: 'The signals of one finding share one fingerprint.' });
  });

  it('raises signals of one fingerprint without a group fingerprint as before: the signal\'s fingerprint and evidence key', async () => {
    const a = queued(JOB_A, 300);
    const twin = signalRow({ fingerprint: a.fingerprint, evidence: [{ job: JOB_A, again: true }], evidence_key: 'key-twin' });
    const w = world({ signals: [a, twin] });
    const { service, viewer } = setup(w);
    const { fingerprint: _none, ...alone } = raise([a.id, twin.id]);
    await service.raise(viewer, alone, 'https://omni.example.test');
    expect(w.findings[0]).toMatchObject({ fingerprint: a.fingerprint, evidence_key: a.evidence_key, figures: { minutes: 300 }, check_line: a.check_line });
  });

  it('a group fingerprint that is the signals\' own one raises as before', async () => {
    const a = queued(JOB_A, 300);
    const w = world({ signals: [a] });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise([a.id], { fingerprint: a.fingerprint }), 'https://omni.example.test');
    expect(w.findings[0]).toMatchObject({ fingerprint: a.fingerprint, evidence_key: a.evidence_key, figures: { minutes: 300 } });
  });

  it('a group of one signal under another fingerprint is a group', async () => {
    const a = queued(JOB_A, 300);
    const w = world({ signals: [a] });
    const { service, viewer } = setup(w);
    await service.raise(viewer, raise([a.id]), 'https://omni.example.test');
    expect(w.findings[0]).toMatchObject({ fingerprint: GROUP, evidence_key: digest([a.fingerprint]), figures: { minutes: 300, signals: 1 } });
  });
});
