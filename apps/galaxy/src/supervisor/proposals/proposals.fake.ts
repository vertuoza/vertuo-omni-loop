import type { ProposalRow as StoredProposal } from '../api/supervisor.repository';
import type { World } from '../api/supervisor.fake';
import type { Acted, JobRow, LedgerJob, ProposalActs, ProposalRow, ProposalsStore } from './proposals.repository';

// An in-memory store and owner's acts for the press and dismissal tests (PRD omni-loop-34 s7), over the Supervisor's
// fake world (../api/supervisor.fake.ts), with the database's own keeps a rule leans on: a press only by an owner and
// once per suggestion, never on a closed finding; a result once per press; a dismissal once, closing its finding with
// the evidence it dismissed (supervisor_proposal_approve(), supervisor_finding_dismiss()).

export type Jobs = (JobRow & { workspace_id: string; resumes: string | null })[];
export type Rest = { jobs: Jobs; missions: { id: string; workspace_id: string }[]; ledger: LedgerJob[] };

let next = 0;
const id = () => `00000000-0000-4000-8000-1${(++next).toString(16).padStart(11, '0')}`;

const workspaceOf = (w: World, finding: string) => w.findings.find((f) => f.id === finding)?.workspace_id ?? '';
const rowOf = (w: World, row: StoredProposal): ProposalRow => ({
  id: row.id, workspace_id: workspaceOf(w, row.finding_id), finding_id: row.finding_id, kind: row.kind, action: row.action, label: row.label,
  target: row.target, reply_to: row.reply_to, author_login: row.author_login, outcome: row.outcome, note: row.note, created_at: row.created_at,
});
const stored = (row: Partial<StoredProposal> & Pick<StoredProposal, 'finding_id' | 'kind'>, at: string): StoredProposal => ({
  id: id(), action: null, label: null, target: null, reply_to: null, author_login: null, outcome: null, note: null, evidence_key: null, created_at: at, ...row,
});

export function fakeProposalsStore(w: World, rest: Rest, now: () => string): ProposalsStore {
  return {
    role: (workspace, user) => Promise.resolve(w.members.find((m) => m.workspace === workspace && m.user === user)?.role ?? null),
    proposal: (workspace, proposal) => {
      const row = w.proposals.find((p) => p.id === proposal && workspaceOf(w, p.finding_id) === workspace);
      return Promise.resolve(row ? rowOf(w, row) : null);
    },
    replyOf: (proposal) => {
      const row = w.proposals.find((p) => p.reply_to === proposal);
      return Promise.resolve(row ? rowOf(w, row) : null);
    },
    findingState: (workspace, finding) => Promise.resolve(w.findings.find((f) => f.id === finding && f.workspace_id === workspace)?.state ?? null),
    job: (workspace, job) => Promise.resolve(rest.jobs.find((j) => j.id === job && j.workspace_id === workspace) ?? null),
    resumeOf: (job) => Promise.resolve(rest.jobs.find((j) => j.resumes === job)?.id ?? null),
    missionIn: (workspace, mission) => Promise.resolve(rest.missions.some((m) => m.id === mission && m.workspace_id === workspace)),
    runnerName: (workspace, runner) => Promise.resolve(w.runners.find((r) => r.id === runner && r.workspace_id === workspace)?.name ?? null),
    insertResult: (row) => {
      if (w.proposals.some((p) => p.reply_to === row.reply_to)) return Promise.reject(new Error('a press has one result'));
      const made = stored({ finding_id: row.finding_id, kind: 'result', reply_to: row.reply_to, outcome: row.outcome, note: row.note }, now());
      w.proposals.push(made);
      return Promise.resolve(rowOf(w, made));
    },
    close: (finding, state, at) => {
      const row = w.findings.find((f) => f.id === finding && f.state === 'open');
      if (row) Object.assign(row, { state, closed_at: at });
      return Promise.resolve();
    },
    postResult: (row) => {
      w.messages.push({ id: id(), workspace_id: row.workspace_id, finding_id: row.finding_id, kind: 'result', author_login: null, body: row.body, reply_to: null, remembered: null, created_at: now() });
      return Promise.resolve();
    },
    addLedgerJob: (job) => {
      if (rest.ledger.some((j) => j.key === job.key)) return Promise.resolve(false);
      rest.ledger.push(job);
      return Promise.resolve(true);
    },
  };
}

const FORBIDDEN: Acted = { ok: false, refusal: 'forbidden', error: 'Only an owner of the workspace acts on its Supervisor.' };

/** The owner-checked functions, as `caller` with `login`. */
export function fakeActs(w: World, caller: string, login: string, now: () => string): ProposalActs {
  const isOwner = (workspace: string) => w.members.some((m) => m.workspace === workspace && m.user === caller && m.role === 'owner');
  return {
    approve: (proposal) => {
      const s = w.proposals.find((p) => p.id === proposal);
      if (!s) return Promise.resolve({ ok: false, refusal: 'refused', error: 'Suggestion: not found.' });
      if (!isOwner(workspaceOf(w, s.finding_id))) return Promise.resolve(FORBIDDEN);
      const made = w.proposals.find((p) => p.reply_to === s.id);
      if (made) return Promise.resolve({ ok: true, value: rowOf(w, made) });
      if (w.findings.find((f) => f.id === s.finding_id)?.state !== 'open') return Promise.resolve({ ok: false, refusal: 'refused', error: 'Suggestion: its finding is closed.' });
      const press = stored({ finding_id: s.finding_id, kind: 'press', reply_to: s.id, author_login: login }, now());
      w.proposals.push(press);
      return Promise.resolve({ ok: true, value: rowOf(w, press) });
    },
    dismiss: (finding, reason) => {
      const f = w.findings.find((x) => x.id === finding);
      if (!f) return Promise.resolve({ ok: false, refusal: 'refused', error: 'Finding: not found.' });
      if (!isOwner(f.workspace_id)) return Promise.resolve(FORBIDDEN);
      const made = w.proposals.find((p) => p.finding_id === f.id && p.kind === 'dismiss');
      if (made) return Promise.resolve({ ok: true, value: rowOf(w, made) });
      if (f.state !== 'open') return Promise.resolve({ ok: false, refusal: 'refused', error: 'Finding: already closed.' });
      const row = stored({ finding_id: f.id, kind: 'dismiss', author_login: login, note: reason, evidence_key: f.evidence_key }, now());
      w.proposals.push(row);
      Object.assign(f, { state: 'dismissed', closed_at: now() });
      return Promise.resolve({ ok: true, value: rowOf(w, row) });
    },
  };
}
