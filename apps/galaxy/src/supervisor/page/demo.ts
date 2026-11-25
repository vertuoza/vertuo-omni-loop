import type { Finding, Message, Seat } from '../api/supervisor.contract';
import type { SupervisorData } from './model';

// The Supervisor page's demo (PRD omni-loop-34 s5), in development (or OMNI_LOOP_DEMO=1) and in its tests: the
// before/after page's own rows (2.A to 2.G), timed from `now`. Fictional: atlas-01 and box-3 are no one's machines.

const ago = (now: string, minutes: number) => new Date(Date.parse(now) - minutes * 60_000).toISOString();

export const demoSeat = (now: string, change: Partial<Seat> = {}): Seat => ({
  workspace: 'demo-workspace', runner: 'demo-runner', placedBy: 'demo', paused: false, dailyTokens: 5_000_000, tokensToday: 412_000, thinking: true,
  lastLookAt: new Date(Date.parse(now) - 40_000).toISOString(), missedLooks: 0, ...change,
});

export const demoFinding = (now: string, change: Partial<Finding> = {}): Finding => ({
  id: 'f-silent', fingerprint: 'stuck:silent:job-1', kind: 'stuck', severity: 'high', title: 'PRD 3232’s job silent for 52 min',
  checkLine: 'Silent job: no line for 52 min, 3× the 2.5 min usual', figures: { minutes: 52, usual: 2.5 },
  evidence: ['Heartbeat fine, log silent since 13:18.', 'vitest at 0% CPU for 40 min.', 's4’s sub-PR pushed: nothing lost.'],
  explanation: 'Alive, but not moving.\nThis step usually takes under 3 min.\nA long test would use CPU.',
  raisedBy: 'supervisor', lookedAt: ago(now, 32), state: 'open', createdAt: ago(now, 52), closedAt: null,
  proposals: [
    { id: 'p1', kind: 'suggestion', action: 'stop-resume-job', label: 'Stop and resume the job', target: {}, replyTo: null, by: null, outcome: null, note: null, at: ago(now, 32) },
    { id: 'p2', kind: 'suggestion', action: 'open-terminal', label: 'Open Terminal', target: {}, replyTo: null, by: null, outcome: null, note: null, at: ago(now, 32) },
  ],
  ...change,
});

export const demoOpen = (now: string): Finding[] => [
  demoFinding(now),
  demoFinding(now, { id: 'f-route', kind: 'bug', title: 'runner ask answers 500 since v0.0.705', checkLine: 'App route failing: 3 in 40 min', createdAt: ago(now, 80), evidence: [], proposals: [] }),
  demoFinding(now, { id: 'f-queue', severity: 'medium', title: '4 jobs stuck in the queue', checkLine: 'Queue nobody can take: old kit', createdAt: ago(now, 35), evidence: [], proposals: [] }),
  demoFinding(now, { id: 'f-disk', kind: 'health', severity: 'medium', title: 'atlas-01’s disk full in about 3 h', checkLine: null, createdAt: ago(now, 12), evidence: [{ runner: 'atlas-01', free: '22 GB' }], proposals: [] }),
];

export const demoDone = (now: string): Finding[] => [
  demoFinding(now, { id: 'f-flaky', title: 'Two flaky-test failures', state: 'dismissed', closedAt: ago(now, 200), createdAt: ago(now, 300), proposals: [] }),
  demoFinding(now, { id: 'f-kit', severity: 'medium', title: 'box-3 runs an old kit', state: 'resolved', closedAt: ago(now, 100), createdAt: ago(now, 400), proposals: [] }),
];

const demoMessage = (now: string, change: Partial<Message> = {}): Message => ({
  id: 'm1', finding: null, kind: 'supervisor', by: null, replyTo: null, remembered: null, at: ago(now, 400),
  body: '41 jobs ended since yesterday. 34 Done, 4 Ready, 3 Failed.\nTwo need you: PRD 3232 looks stuck on atlas-02. runner ask returns 500 since v0.0.705.',
  ...change,
});

export const demoChat = (now: string): Message[] => [
  demoMessage(now),
  demoMessage(now, { id: 'm2', kind: 'owner', by: 'demo', body: 'Anything before this afternoon’s mission?', at: ago(now, 330) }),
  demoMessage(now, { id: 'm3', body: 'atlas-01 will be short on disk. box-3 needs a kit update.\nFix both: 9 free slots.', remembered: 'box-3 kit drift', at: ago(now, 329) }),
];

/** The whole page, as an owner sees it with the seat watching. */
export const demoSupervisor = (now: string, change: Partial<SupervisorData> = {}): SupervisorData => ({
  workspace: 'demo-workspace', owner: true, seat: demoSeat(now), runner: { name: 'atlas-01', slots: 4 }, open: demoOpen(now), done: demoDone(now),
  chat: demoChat(now), thread: [], notes: 9, now, ...change,
});
