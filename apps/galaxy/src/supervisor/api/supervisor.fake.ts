import type { FindingRow, MessageRow, NoteRow, OwnerReach, ProposalRow, RunnerRow, SeatRow, SignalRow, SupervisorStore } from './supervisor.repository';

// An in-memory Supervisor store for the tests (PRD omni-loop-34 s3): the service role's reads and writes over plain
// rows, with the database's own keeps where a rule of the service leans on them (one row per id, a finding's thread of
// its workspace). Two workspaces: Acme, whose seat sits on Olga's atlas-01, and Globex, whose seat sits on Eve's box.

export const T0 = '2026-11-25T10:00:00.000Z';
export const ACME = '00000000-0000-4000-8000-00000000a001';
export const GLOBEX = '00000000-0000-4000-8000-00000000b001';
export const OLGA = '00000000-0000-4000-8000-0000000000a1';
export const MO = '00000000-0000-4000-8000-0000000000a2';
export const EVE = '00000000-0000-4000-8000-0000000000b1';
export const ATLAS = '00000000-0000-4000-8000-0000000000c1';
export const SPARE = '00000000-0000-4000-8000-0000000000c2';
export const EVE_BOX = '00000000-0000-4000-8000-0000000000c3';
export const JOB = '00000000-0000-4000-8000-0000000000d1';
export const EVE_JOB = '00000000-0000-4000-8000-0000000000d2';

const runner = (id: string, workspace: string, owner: string, name: string): RunnerRow => ({
  id, workspace_id: workspace, owner, name, slots: 4, version: '0.0.710', last_seen_at: T0, health: null,
});

const seatRow = (workspace: string, runnerId: string, change: Partial<SeatRow> = {}): SeatRow => ({
  workspace_id: workspace, runner_id: runnerId, placed_login: 'olga', paused: false, daily_tokens: 5_000_000, tokens_day: null, tokens_used: 0,
  last_look_at: null, missed_looks: 0, ...change,
});

let next = 0;
const id = () => `00000000-0000-4000-8000-${(++next).toString(16).padStart(12, '0')}`;

export const signalRow = (change: Partial<SignalRow> = {}): SignalRow => ({
  id: id(), workspace_id: ACME, fingerprint: `stuck:silent:${JOB}`, check_name: 'silent-job', kind: 'stuck',
  check_line: 'Silent job: no line for 52 min, 3× the 2.5 min usual', figures: { minutes: 52, usual: 2.5 }, evidence: [{ job: JOB }],
  evidence_key: 'k1', finding_id: null, opened_at: T0, seen_at: T0, closed_at: null, ...change,
});

export type World = {
  runners: RunnerRow[]; seats: SeatRow[]; members: { workspace: string; user: string; role: string }[]; signals: SignalRow[]; findings: FindingRow[];
  proposals: ProposalRow[]; notes: NoteRow[]; messages: MessageRow[]; lines: { job: string; seq: number; text: string; at: string }[];
  jobs: { id: string; workspace_id: string }[]; owners: Record<string, OwnerReach[]>;
};

export function world(change: Partial<World> = {}): World {
  return {
    runners: [runner(ATLAS, ACME, OLGA, 'atlas-01'), runner(SPARE, ACME, OLGA, 'spare'), runner(EVE_BOX, GLOBEX, EVE, 'eve-box')],
    seats: [seatRow(ACME, ATLAS), seatRow(GLOBEX, EVE_BOX)],
    members: [{ workspace: ACME, user: OLGA, role: 'owner' }, { workspace: ACME, user: MO, role: 'member' }, { workspace: GLOBEX, user: EVE, role: 'owner' }],
    signals: [], findings: [], proposals: [], notes: [], messages: [], lines: [],
    jobs: [{ id: JOB, workspace_id: ACME }, { id: EVE_JOB, workspace_id: GLOBEX }],
    owners: { [ACME]: [{ user: OLGA, email: 'olga@example.test', devices: [{ id: 'dev-1', endpoint: 'https://push.example.test/1', p256dh: 'p', auth: 'a' }] }] },
    ...change,
  };
}

/** The store over `w`, its clock's time read from `now`. Every call can be made to throw with `fail`. */
export function fakeStore(w: World, now: () => string = () => T0, fail: { error: Error | null } = { error: null }): SupervisorStore {
  const tick = () => Promise.resolve();
  const guard = () => { if (fail.error) throw fail.error; };
  const job = (workspace: string, jobId: string) => {
    const found = w.jobs.find((j) => j.id === jobId && j.workspace_id === workspace);
    return found ? { ...found, line: '/omni:yolo 7', repo: 'acme/widgets', status: 'running', runner_id: ATLAS, attempt: 1, queued_at: T0, running_at: T0, ended_at: null, reason: null, mission_id: null } : null;
  };
  return {
    runner: async (runnerId) => { await tick(); guard(); return w.runners.find((r) => r.id === runnerId) ?? null; },
    runners: (workspace) => Promise.resolve(w.runners.filter((r) => r.workspace_id === workspace)),
    seatOfRunner: async (runnerId) => { await tick(); guard(); return w.seats.find((s) => s.runner_id === runnerId) ?? null; },
    seat: (workspace) => Promise.resolve(w.seats.find((s) => s.workspace_id === workspace) ?? null),
    updateSeat: async (workspace, change) => {
      await tick();
      const at = w.seats.findIndex((s) => s.workspace_id === workspace);
      const seat = w.seats[at];
      if (!seat) throw new Error(`no seat in ${workspace}`);
      const row: SeatRow = { ...seat, ...change };
      w.seats[at] = row;
      return row;
    },
    role: async (workspace, user) => { await tick(); guard(); return w.members.find((m) => m.workspace === workspace && m.user === user)?.role ?? null; },
    wakes: async (workspace, since) => { await tick(); return {
      signals: w.signals.filter((s) => s.workspace_id === workspace && s.closed_at === null && s.opened_at > since).length,
      messages: w.messages.filter((m) => m.workspace_id === workspace && m.kind === 'owner' && m.created_at > since).length,
      presses: w.proposals.filter((p) => w.findings.some((f) => f.id === p.finding_id && f.workspace_id === workspace) && p.kind === 'press' && p.created_at > since).length,
    }; },
    openSignals: (workspace) => Promise.resolve(w.signals.filter((s) => s.workspace_id === workspace && s.closed_at === null)),
    signals: (workspace, ids) => Promise.resolve(w.signals.filter((s) => s.workspace_id === workspace && ids.includes(s.id))),
    attachSignals: async (ids, finding) => { await tick(); for (const s of w.signals) if (ids.includes(s.id)) s.finding_id = finding; },
    signalsOfFinding: (workspace, finding) => Promise.resolve(w.signals.filter((s) => s.workspace_id === workspace && s.finding_id === finding)),
    findings: (workspace, open) => Promise.resolve(w.findings.filter((f) => f.workspace_id === workspace && (f.state === 'open') === open)),
    finding: (workspace, findingId) => Promise.resolve(w.findings.find((f) => f.workspace_id === workspace && f.id === findingId) ?? null),
    lastOfFingerprint: (workspace, fingerprint) => Promise.resolve(w.findings.filter((f) => f.workspace_id === workspace && f.fingerprint === fingerprint).at(-1) ?? null),
    insertFinding: async (row) => {
      await tick();
      const made: FindingRow = { ...row, id: id(), state: 'open', notified_at: null, created_at: now(), closed_at: null };
      w.findings.push(made);
      return made;
    },
    lookAt: async (findingId, explanation, at) => {
      await tick();
      const row = w.findings.find((f) => f.id === findingId);
      if (!row) throw new Error(`no finding ${findingId}`);
      Object.assign(row, { explanation, looked_at: at });
      return { ...row };
    },
    extendFinding: async (findingId, change) => {
      await tick();
      const row = w.findings.find((f) => f.id === findingId);
      if (!row) throw new Error(`no finding ${findingId}`);
      Object.assign(row, change);
      return { ...row };
    },
    markNotified: async (findingId, at) => {
      await tick();
      const row = w.findings.find((f) => f.id === findingId);
      if (!row || row.notified_at !== null) return false;
      row.notified_at = at;
      return true;
    },
    proposals: (findings) => Promise.resolve(w.proposals.filter((p) => findings.includes(p.finding_id))),
    insertSuggestions: async (rows) => {
      await tick();
      for (const row of rows) {
        w.proposals.push({ id: id(), finding_id: row.finding_id, kind: 'suggestion', action: row.action, label: row.label, target: row.target, reply_to: null, author_login: null, outcome: null, note: null, evidence_key: null, created_at: now() });
      }
    },
    notes: (workspace, scope) => Promise.resolve(w.notes.filter((n) => n.workspace_id === workspace && (scope === null || n.scope === scope))),
    insertNote: async (row) => {
      await tick();
      const made: NoteRow = { ...row, id: id(), created_at: now(), expires_at: row.scope === 'short' ? '2026-11-26T10:00:00.000Z' : null };
      w.notes.push(made);
      return made;
    },
    messages: (workspace, finding, after) => Promise.resolve(w.messages.filter((m) => m.workspace_id === workspace && m.finding_id === finding && (after === null || m.created_at > after))),
    message: (workspace, messageId) => Promise.resolve(w.messages.find((m) => m.workspace_id === workspace && m.id === messageId) ?? null),
    insertAnswer: async (row) => {
      await tick();
      const made: MessageRow = { id: id(), workspace_id: row.workspace_id, finding_id: row.finding_id, kind: 'supervisor', author_login: null, body: row.body, reply_to: row.reply_to, remembered: row.remembered, created_at: now() };
      w.messages.push(made);
      return made;
    },
    job: (workspace, jobId) => Promise.resolve(job(workspace, jobId)),
    jobs: (workspace) => Promise.resolve(w.jobs.filter((j) => j.workspace_id === workspace).map((j) => job(workspace, j.id)).filter((j) => j !== null)),
    lines: (jobId, after, limit) => Promise.resolve(w.lines.filter((l) => l.job === jobId && l.seq > after).slice(0, limit).map(({ seq, text, at }) => ({ seq, text, at }))),
    missions: () => Promise.resolve([]),
    owners: (workspace) => Promise.resolve(w.owners[workspace] ?? []),
    forgetDevice: () => Promise.resolve(undefined),
  };
}
