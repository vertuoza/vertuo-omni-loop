// The Supervisor's nine checks (PRD omni-loop-34 s2, spec "2. The checks", "Test seams"): a table test per check over
// realistic rows, each with a case that fires, one that stays quiet, and one where the cause is gone, so the watch
// closes its signal (./watch.test.ts proves the closing itself).
import { describe, expect, it } from 'vitest';
import {
  CHECKS, evidenceKey, fullIn, lateSchedule, missionNotMoving, queueStuck, resumeLoop, routeFailing, runChecks, runnerHealth,
  sameFailure, silentJob, skillOf, waitingTooLong, type Check, type WatchJob, type WatchMission, type WatchRunner, type WatchSnapshot,
} from './checks.ts';

const NOW = Date.parse('2027-01-15T12:00:00.000Z');
const MIN = 60_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const RUNNER: WatchRunner = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'atlas-01', fleet: null, repos: ['acme/widgets'], lastSeenAt: ago(10_000),
  paused: null, accounts: null, disk: [],
};
const JOB: WatchJob = {
  id: 'bbbbbbbb-0000-4000-8000-000000000001', repo: 'acme/widgets', line: '/omni:wave 7', status: 'running', outcome: null, reason: null,
  runnerId: RUNNER.id, toRunner: null, toFleet: null, queuedAt: ago(90 * MIN), runningAt: ago(80 * MIN), endedAt: null, resumeAfter: null,
  attempt: 1, lastLineAt: ago(52 * MIN), lastLine: null, continued: false,
};
const MISSION: WatchMission = {
  id: 'cccccccc-0000-4000-8000-000000000001', number: 4, title: 'Ship the quotes', status: 'running', lastEventAt: ago(10 * MIN),
  updatedAt: ago(10 * MIN), runFailed: false, repairs: {},
};

function snap(over: Partial<WatchSnapshot> = {}): WatchSnapshot {
  return { now: NOW, jobs: [], runners: [RUNNER], missions: [], errors: [], ledger: { late: 0, scheduledLate: 0, failing: [] }, baselines: {}, ...over };
}

const job = (over: Partial<WatchJob>): WatchJob => ({ ...JOB, ...over });
const lines = (check: Check, snapshot: WatchSnapshot) => check(snapshot).map((fire) => fire.checkLine);
const prints = (check: Check, snapshot: WatchSnapshot) => check(snapshot).map((fire) => fire.fingerprint);

describe('silent-job — running, its runner seen, no line for 3× the usual and at least 20 min', () => {
  it('fires with its figures first: "Silent job: no line for 52 min, 3× the 2.5 min usual"', () => {
    const [fire] = silentJob(snap({ jobs: [JOB], baselines: { wave: 2.5 } }));
    expect(fire?.fingerprint).toBe(`stuck:silent:${JOB.id}`);
    expect(fire?.checkLine).toBe('Silent job: no line for 52 min, 3× the 2.5 min usual');
    expect(fire?.figures).toEqual({ silentMin: 52, usualMin: 2.5, step: 'wave' });
    expect(fire?.suggestions?.map((s) => s.label)).toEqual(['Stop and resume the job', 'Open its Terminal']);
  });

  it.each([
    ['a line 10 min ago, under the 20 min floor', { lastLineAt: ago(10 * MIN) }, { wave: 2.5 }],
    ['a step whose usual time is 30 min, under 3×', { lastLineAt: ago(52 * MIN) }, { wave: 30 }],
    ['a job that is not running', { status: 'queued' as const }, { wave: 2.5 }],
    ['a job whose runner is offline', { runnerId: 'aaaaaaaa-0000-4000-8000-000000000009' }, { wave: 2.5 }],
  ])('stays quiet on %s', (_, over, baselines) => {
    expect(silentJob(snap({ jobs: [job(over)], baselines }))).toEqual([]);
  });

  it('with no baseline uses 20 min, and says so', () => {
    expect(lines(silentJob, snap({ jobs: [JOB] }))).toEqual([]);
    expect(lines(silentJob, snap({ jobs: [job({ lastLineAt: ago(61 * MIN) })] }))).toEqual(['Silent job: no line for 61 min, 3× the 20 min default (no usual time kept yet)']);
  });

  it('closes once a new line comes: the check fires nothing more', () => {
    expect(silentJob(snap({ jobs: [job({ lastLineAt: ago(MIN) })], baselines: { wave: 2.5 } }))).toEqual([]);
  });

  it('counts from its start when it wrote no line', () => {
    expect(lines(silentJob, snap({ jobs: [job({ lastLineAt: null })], baselines: { wave: 2.5 } }))).toEqual(['Silent job: no line for 80 min, 3× the 2.5 min usual']);
  });
});

describe('queue-stuck — one finding per repository whose queued jobs no online runner can take for 15 min', () => {
  const queued = job({ status: 'queued', runnerId: null, runningAt: null, queuedAt: ago(16 * MIN), lastLineAt: null });
  const DAY = 24 * 60 * MIN;
  const queuedFor = (n: number, waited: number, repo = 'acme/widgets') =>
    job({ id: `bbbbbbbb-0000-4000-8000-00000000020${String(n)}`, repo, status: 'queued', runnerId: null, runningAt: null, queuedAt: ago(waited), lastLineAt: null });

  it('AC-6: 8 jobs queued for days for a repository no online runner can take make one stuck:queue-repo:<repo> finding listing the 8 jobs', () => {
    const jobs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => queuedFor(n, (2 + n) * DAY));
    const fires = queueStuck(snap({ jobs, runners: [{ ...RUNNER, lastSeenAt: ago(3 * DAY) }] }));
    expect(fires).toHaveLength(1);
    const [fire] = fires;
    expect(fire?.fingerprint).toBe('stuck:queue-repo:acme/widgets');
    expect(fire?.checkLine).toBe('Queue nobody can take: 8 jobs queued up to 10 days, no online runner can take acme/widgets');
    expect(fire?.figures).toEqual({ jobs: 8, oldestDays: 10, oldestMin: 10 * 24 * 60, runners: 1 });
    expect(fire?.evidence.map((e) => [e.of, e.id])).toEqual([...jobs].reverse().map((j) => ['job', j.id]));
    expect(fire?.evidenceKey).toBe(evidenceKey(jobs.map((j) => j.id).sort()));
  });

  it('fires when the only runner holding the repository is offline', () => {
    expect(lines(queueStuck, snap({ jobs: [queued], runners: [{ ...RUNNER, lastSeenAt: ago(5 * MIN) }] }))).toEqual(['Queue nobody can take: 1 jobs queued up to 0 days, no online runner can take acme/widgets']);
  });

  it.each([
    ['paused', { paused: 'disk under 5 GB' }],
    ['not holding the repository', { repos: ['acme/other'] }],
  ])('fires when the online runner is %s', (_, over) => {
    expect(prints(queueStuck, snap({ jobs: [queued], runners: [{ ...RUNNER, ...over }] }))).toEqual(['stuck:queue-repo:acme/widgets']);
  });

  it('fires when the job is sent to another runner', () => {
    expect(prints(queueStuck, snap({ jobs: [{ ...queued, toRunner: 'aaaaaaaa-0000-4000-8000-000000000002' }] }))).toEqual(['stuck:queue-repo:acme/widgets']);
  });

  it('raises one finding per repository, its repository written the same whatever its case', () => {
    const jobs = [queuedFor(1, DAY), queuedFor(2, DAY, 'Acme/Widgets'), queuedFor(3, DAY, 'acme/gadgets')];
    const fires = queueStuck(snap({ jobs, runners: [] }));
    expect(fires.map((fire) => [fire.fingerprint, fire.figures.jobs])).toEqual([['stuck:queue-repo:acme/widgets', 2], ['stuck:queue-repo:acme/gadgets', 1]]);
  });

  it('lists 50 jobs at most, the oldest first, and keys them all', () => {
    const jobs = Array.from({ length: 60 }, (_, n) => job({ ...queuedFor(0, DAY + n * MIN), id: `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}` }));
    const [fire] = queueStuck(snap({ jobs, runners: [] }));
    expect(fire?.evidence).toHaveLength(50);
    expect(fire?.evidence[0]?.id).toBe(jobs[59]?.id);
    expect(fire?.figures.jobs).toBe(60);
    expect(fire?.evidenceKey).toBe(evidenceKey(jobs.map((j) => j.id).sort()));
  });

  it('keys the same jobs the same, however long they waited, and a changed set otherwise', () => {
    const one = queueStuck(snap({ jobs: [queuedFor(1, DAY), queuedFor(2, DAY)], runners: [] }));
    const later = queueStuck({ ...snap({ jobs: [queuedFor(1, DAY), queuedFor(2, DAY)], runners: [] }), now: NOW + 60 * MIN });
    const more = queueStuck(snap({ jobs: [queuedFor(1, DAY), queuedFor(2, DAY), queuedFor(3, DAY)], runners: [] }));
    expect(later[0]?.evidenceKey).toBe(one[0]?.evidenceKey);
    expect(more[0]?.evidenceKey).not.toBe(one[0]?.evidenceKey);
  });

  it('stays quiet under 15 min, and while an online runner can take it', () => {
    expect(queueStuck(snap({ jobs: [{ ...queued, queuedAt: ago(14 * MIN) }], runners: [] }))).toEqual([]);
    expect(queueStuck(snap({ jobs: [queued] }))).toEqual([]);
  });

  it('counts a resume from its resume time', () => {
    expect(queueStuck(snap({ jobs: [{ ...queued, resumeAfter: ago(5 * MIN) }], runners: [] }))).toEqual([]);
  });

  it('closes once the job is claimed', () => {
    expect(queueStuck(snap({ jobs: [{ ...queued, status: 'claimed' }], runners: [] }))).toEqual([]);
  });
});

describe('resume-loop — a job lost on its third attempt', () => {
  const lost = job({ status: 'failed', reason: 'runner lost', attempt: 3, endedAt: ago(30 * MIN) });

  it('fires on the third loss', () => {
    expect(lines(resumeLoop, snap({ jobs: [lost] }))).toEqual(['Resume loop: lost 3 times, nothing resumes it now']);
  });

  it.each([
    ['a second loss (its resume is queued)', { attempt: 2 }],
    ['a third attempt failed by the skill itself', { reason: 'exit 1' }],
    ['a third attempt still running', { status: 'running' as const, reason: null, endedAt: null }],
  ])('stays quiet on %s', (_, over) => {
    expect(resumeLoop(snap({ jobs: [{ ...lost, ...over }] }))).toEqual([]);
  });

  it('closes a day after the loss', () => {
    expect(resumeLoop(snap({ jobs: [{ ...lost, endedAt: ago(25 * 60 * MIN) }] }))).toEqual([]);
  });
});

describe('mission-not-moving — no event for 2 h, its run failing, or the same repair 3 times', () => {
  it('AC-10: a running mission that sent the same /omni:repair 3 times opens a "Mission not moving" signal, with Pause and Open', () => {
    const [fire] = missionNotMoving(snap({ missions: [{ ...MISSION, repairs: { 'kit:wave:abc': 3, 'kit:plan:def': 1 } }] }));
    expect(fire?.fingerprint).toBe(`stuck:mission:${MISSION.id}`);
    expect(fire?.checkLine).toBe('Mission not moving: the same /omni:repair sent 3 times');
    expect(fire?.suggestions?.map((s) => s.label)).toEqual(['Pause the mission', 'Open the mission']);
  });

  it.each([
    ['no event for 2.5 h', { lastEventAt: ago(150 * MIN) }, 'Mission not moving: no mission event for 2.5 h'],
    ['its run on the App failing', { runFailed: true }, 'Mission not moving: its run on the App failed'],
    ['a waiting mission with no event ever, changed 3 h ago', { status: 'waiting', lastEventAt: null, updatedAt: ago(180 * MIN) }, 'Mission not moving: no mission event for 3 h'],
  ])('fires on %s', (_, over, line) => {
    expect(lines(missionNotMoving, snap({ missions: [{ ...MISSION, ...over }] }))).toEqual([line]);
  });

  it.each([
    ['a moving mission', {}],
    ['a repair sent twice', { repairs: { 'kit:wave:abc': 2 } }],
    ['a paused mission', { status: 'paused', lastEventAt: ago(300 * MIN) }],
  ])('stays quiet on %s', (_, over) => {
    expect(missionNotMoving(snap({ missions: [{ ...MISSION, ...over }] }))).toEqual([]);
  });

  it('closes once a new event comes', () => {
    expect(missionNotMoving(snap({ missions: [{ ...MISSION, lastEventAt: ago(MIN) }] }))).toEqual([]);
  });
});

describe('waiting-too-long — one finding per kind of wait: Need human, Waiting on answers or Held for more than 4 h', () => {
  const waiting = (n: number, outcome: string, hoursAgo: number, over: Partial<WatchJob> = {}) =>
    job({ id: `bbbbbbbb-0000-4000-8000-00000000030${String(n)}`, status: 'done', outcome, endedAt: ago(hoursAgo * 60 * MIN), ...over });

  it.each([
    ['human', 'Need human'],
    ['answers', 'Waiting on answers'],
    ['held', 'Held'],
  ])('fires on %s past 4 h, as stuck:waiting:<state>', (outcome, label) => {
    const fires = waitingTooLong(snap({ jobs: [waiting(1, outcome, 5)] }));
    expect(fires.map((fire) => [fire.fingerprint, fire.checkLine])).toEqual([[`stuck:waiting:${outcome}`, `Waiting too long: 1 jobs ${label} for up to 5 h`]]);
  });

  it('raises one finding per kind of wait, each listing its jobs, the oldest first, keyed on their sorted ids', () => {
    const [a, b, c, d] = [waiting(1, 'held', 5), waiting(2, 'held', 30), waiting(3, 'human', 6), waiting(4, 'held', 10)];
    const fires = waitingTooLong(snap({ jobs: [a, b, c, d] }));
    expect(fires.map((fire) => [fire.fingerprint, fire.checkLine, fire.evidence.map((e) => e.id)])).toEqual([
      ['stuck:waiting:held', 'Waiting too long: 3 jobs Held for up to 30 h', [b.id, d.id, a.id]],
      ['stuck:waiting:human', 'Waiting too long: 1 jobs Need human for up to 6 h', [c.id]],
    ]);
    expect(fires[0]?.figures).toEqual({ jobs: 3, waitedHours: 30, state: 'Held' });
    expect(fires[0]?.evidenceKey).toBe(evidenceKey([a.id, b.id, d.id].sort()));
  });

  it.each([
    ['under 4 h', { endedAt: ago(3 * 60 * MIN) }],
    ['a job that ended ready', { outcome: 'ready' }],
    ['a job that expired', { outcome: 'expired', reason: 'Expired: nobody continued it in 48 h' }],
  ])('stays quiet %s', (_, over) => {
    expect(waitingTooLong(snap({ jobs: [waiting(1, 'answers', 5, over)] }))).toEqual([]);
  });

  it('closes once a job continues it', () => {
    expect(waitingTooLong(snap({ jobs: [waiting(1, 'answers', 5, { continued: true })] }))).toEqual([]);
  });
});

describe('same-failure — 3 jobs or more failed the same way within 6 h', () => {
  const failed = (n: number, over: Partial<WatchJob> = {}) =>
    job({ id: `bbbbbbbb-0000-4000-8000-00000000010${String(n)}`, status: 'failed', reason: 'exit 1', endedAt: ago(n * 30 * MIN), lastLine: `step ${String(n)}`, ...over });

  it('fires once on 3 jobs with the same reason, high, each job its evidence', () => {
    const fires = sameFailure(snap({ jobs: [failed(1), failed(2), failed(3)] }));
    expect(fires.map((fire) => fire.checkLine)).toEqual(['Same failure, many jobs: 3 jobs failed with the same reason within 6 h: exit 1']);
    expect(fires[0]?.severity).toBe('high');
    expect(fires[0]?.evidence).toHaveLength(3);
  });

  it('fires on the same last line, masked, when the reasons differ', () => {
    const token = `ghp_${'a'.repeat(36)}`;
    const same = { lastLine: `push refused for ${token}` };
    const fires = sameFailure(snap({ jobs: [failed(1, { reason: 'a', ...same }), failed(2, { reason: 'b', ...same }), failed(3, { reason: 'c', ...same })] }));
    expect(fires.map((fire) => fire.checkLine)).toEqual(['Same failure, many jobs: 3 jobs failed with the same last line within 6 h: push refused for [masked]']);
    expect(JSON.stringify(fires)).not.toContain(token);
  });

  it('stays quiet on jobs the 48 h sweep expired on purpose, whatever their count (#3366)', () => {
    const expired = { reason: 'Expired: no runner took it in 48 h', lastLine: null };
    expect(sameFailure(snap({ jobs: [failed(1, expired), failed(2, expired), failed(3, expired), failed(4, expired)] }))).toEqual([]);
  });

  it('stays quiet on 2 jobs, and on a third failure older than 6 h', () => {
    expect(sameFailure(snap({ jobs: [failed(1), failed(2)] }))).toEqual([]);
    expect(sameFailure(snap({ jobs: [failed(1), failed(2), failed(13)] }))).toEqual([]);
  });

  it('closes as the failures age past 6 h', () => {
    const at = { now: NOW + 6 * 60 * MIN };
    expect(sameFailure({ ...snap({ jobs: [failed(1), failed(2), failed(3)] }), ...at })).toEqual([]);
  });

  it('keeps one fingerprint for one failure, whatever the jobs', () => {
    expect(prints(sameFailure, snap({ jobs: [failed(1), failed(2), failed(3)] }))).toEqual(prints(sameFailure, snap({ jobs: [failed(1), failed(2), failed(3), failed(4)] })));
  });
});

describe('route-failing — 3 or more 5xx on one route within 1 h', () => {
  const err = (route: string, minutesAgo: number, status = 500) => ({ route, status, at: ago(minutesAgo * MIN) });

  it('fires on 3 on one route, high', () => {
    const fires = routeFailing(snap({ errors: [err('/api/runners/next', 1), err('/api/runners/next', 20), err('/api/runners/next', 50, 502)] }));
    expect(fires.map((fire) => [fire.fingerprint, fire.checkLine, fire.severity])).toEqual([['bug:route:/api/runners/next', 'App route failing: 3 × 5xx on /api/runners/next within 1 h', 'high']]);
  });

  it('stays quiet on 2, and on 3 spread over routes', () => {
    expect(routeFailing(snap({ errors: [err('/a', 1), err('/a', 2)] }))).toEqual([]);
    expect(routeFailing(snap({ errors: [err('/a', 1), err('/b', 2), err('/c', 3)] }))).toEqual([]);
  });

  it('closes once the errors are over an hour old', () => {
    expect(routeFailing(snap({ errors: [err('/a', 61), err('/a', 70), err('/a', 80)] }))).toEqual([]);
  });
});

describe('late-schedule — the ledger reads late, or a scheduled kind failed 3 times in a row', () => {
  it('fires on a late health and on each failing kind', () => {
    expect(lines(lateSchedule, snap({ ledger: { late: 2, scheduledLate: 1, failing: ['pr-stats'] } }))).toEqual([
      'Late schedule: 2 jobs late, 1 schedules with no run for 3 periods',
      'Late schedule: pr-stats failed 3 times in a row',
    ]);
  });

  it('stays quiet, and closes, on an ok health with no failing kind', () => {
    expect(lateSchedule(snap())).toEqual([]);
  });
});

describe('runner-health — disk, paused, offline with queued work, every account out', () => {
  const disk = (free: number[]) => free.map((bytes, i) => ({ at: ago((free.length - 1 - i) * 20 * MIN), free: bytes }));

  it('fires when the disk is full within 6 h at the last hour\'s rate', () => {
    const runner = { ...RUNNER, disk: disk([40e9, 30e9, 20e9]) };
    expect(fullIn(runner)).toBe(40 * MIN);
    expect(lines(runnerHealth, snap({ runners: [runner] }))).toEqual(['Runner health: atlas-01\'s disk is full in about 0.7 h at the current rate']);
  });

  it('fires when paused, raised only after 30 min', () => {
    const [fire] = runnerHealth(snap({ runners: [{ ...RUNNER, paused: 'memory over 90%' }] }));
    expect(fire?.checkLine).toBe('Runner health: atlas-01 paused for 30 min or more: memory over 90%');
    expect(fire?.raiseAfterMs).toBe(30 * MIN);
  });

  it('fires when offline with a job queued it could take, high', () => {
    const queued = job({ status: 'queued', runnerId: null });
    const fires = runnerHealth(snap({ runners: [{ ...RUNNER, lastSeenAt: ago(10 * MIN) }], jobs: [queued] }));
    expect(fires.map((fire) => [fire.fingerprint, fire.severity])).toEqual([[`health:offline:${RUNNER.id}`, 'high']]);
  });

  it('fires when every account is out', () => {
    expect(prints(runnerHealth, snap({ runners: [{ ...RUNNER, accounts: ['out', 'out'] }] }))).toEqual([`health:accounts:${RUNNER.id}`]);
  });

  it.each([
    ['a disk filling slowly', { disk: disk([40e9, 39.9e9, 39.8e9]) }],
    ['a disk freed', { disk: disk([20e9, 30e9]) }],
    ['one account left', { accounts: ['out', 'ready'] as const }],
    ['offline with nothing queued', { lastSeenAt: ago(60 * MIN) }],
  ])('stays quiet on %s', (_, over) => {
    expect(runnerHealth(snap({ runners: [{ ...RUNNER, ...over }] }))).toEqual([]);
  });

  it('closes once it runs again', () => {
    expect(runnerHealth(snap({ runners: [RUNNER], jobs: [job({ status: 'queued', runnerId: null })] }))).toEqual([]);
  });
});

describe('runChecks — the nine checks together', () => {
  it('runs the nine checks, in the spec\'s order', () => {
    expect(CHECKS).toHaveLength(9);
  });

  it('never doubles a fingerprint', () => {
    const twice: Check = () => [...silentJob(snap({ jobs: [JOB], baselines: { wave: 2.5 } }))];
    expect(runChecks(snap(), [twice, twice]).map((fire) => fire.fingerprint)).toEqual([`stuck:silent:${JOB.id}`]);
  });

  it('reads a job\'s skill from its line', () => {
    expect([skillOf('/omni:do-work 7 s2'), skillOf('/qa-sweep'), skillOf('nonsense')]).toEqual(['do-work', 'qa-sweep', 'job']);
  });

  it('keys the evidence the same for the same parts', () => {
    expect(evidenceKey(['a', 1])).toBe(evidenceKey(['a', 1]));
    expect(evidenceKey(['a', 1])).not.toBe(evidenceKey(['a', 2]));
  });
});
