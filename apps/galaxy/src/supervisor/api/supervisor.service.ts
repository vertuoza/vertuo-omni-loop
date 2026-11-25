import { maskSecrets } from '../../server-event/app-errors';
import type { Message as Notice, Recipient } from '../../notify/notify';
import {
  SUPERVISOR_LINES_PAGE, SUPERVISOR_NEXT_HOLD_MS, SUPERVISOR_NEXT_POLL_MS,
  type AnswerRequest, type Finding, type Message, type NextReply, type Note, type NoteRequest, type Proposal, type RaiseReply, type RaiseRequest,
  type Seat, type Signal, type Snapshot, type SupervisorRefusal,
} from './supervisor.contract';
import type { Acted, FindingRow, MessageRow, NoteRow, ProposalRow, SeatRow, SignalRow, SupervisorActs, SupervisorStore } from './supervisor.repository';

// The Supervisor API's rules (PRD omni-loop-34 s3; ADR-0095), over the service role's store and an owner's acts:
//
// - Who: the seat is the owner of the runner that holds the workspace's seat, by the kit's sign-in. That runner's
//   workspace is the only one the seat reads or writes (BR-PRODUCT-63): a runner that holds no seat, or another
//   person's runner, is refused on every route, and an id of another workspace reads as none. A person reads a
//   workspace they are a member of; an owner's acts go through the owner-checked functions as that owner, which refuse
//   anyone else (supabase/migrations/20270129160000_supervisor.sql).
// - `next` counts as the seat's look, then holds up to 40 s and answers at once on a signal opened, an owner's message
//   or a suggestion pressed since `since`, else nothing.
// - A finding is written with the check that fired and its figures first: raised from signals, it takes the first
//   signal's check line, figures and evidence digest; raised alone, it has no check line ("Raised by the Supervisor, no
//   check fired"). One open finding per fingerprint: a second raise adds its signals to the open one, and gives a finding
//   the check wrote alone its first look. A fingerprint an owner dismissed as Not a problem is never raised again with
//   the same evidence.
// - A high finding sends one push and one email to each owner, by their alert switches, once (notified_at); a medium
//   one sends none.
// - The seat's tokens count by UTC day; past the daily limit the seat is answered `thinking: false`.
// - Evidence and log lines are masked before they are written or read out (L-GDPR-2). The stored AI key is never read
//   (BR-PRODUCT-59).

export type Served<T> = { ok: true; value: T } | { ok: false; kind: SupervisorRefusal; error: string };

/** Who reads: the seat, by its runner, or a person of the workspace. */
export type Viewer = { kind: 'seat'; workspace: string; seat: SeatRow } | { kind: 'person'; workspace: string; user: string; owner: boolean };

export type Clock = { now: () => Date; sleep: (ms: number) => Promise<void> };

/** Reaches the owners: notify.ts's fan-out over this deployment's channels, the page's address for the links. */
export type Alert = (recipients: readonly Recipient[], message: Notice, origin: string) => Promise<void>;

export type SupervisorServiceDeps = { store: SupervisorStore; clock: Clock; alert: Alert };

const ok = <T>(value: T): Served<T> => ({ ok: true, value });
const no = (kind: SupervisorRefusal, error: string): Served<never> => ({ ok: false, kind, error });

const NOT_YOUR_RUNNER = 'This runner is not yours.';
const NO_RUNNER = 'No such runner.';
const NO_SEAT = 'This runner holds no Supervisor seat: an owner places it on the Runners page.';
const NOT_MEMBER = 'You are not a member of this workspace.';
const NO_FINDING = 'No such finding.';
const NO_JOB = 'No such job.';
const NO_MESSAGE = 'No such message.';
export const DISMISSED_SAME = 'An owner said Not a problem to this, with the same evidence: it is not raised again.';
const SIGNALS_UNKNOWN = 'A signal named is not an open signal of this workspace.';
const SIGNALS_TWO_FINGERPRINTS = 'The signals of one finding share one fingerprint.';
const NO_CHECK = 'Raised by the Supervisor, no check fired';

/** A raise's fingerprint: its first signal's, else the one it names, else none. */
const fingerprintOf = (signals: readonly SignalRow[], request: RaiseRequest): string | null => signals[0]?.fingerprint ?? request.fingerprint ?? null;

/** Whether the newest finding of the fingerprint was dismissed with the evidence the signals carry now. */
const dismissedAlike = (last: FindingRow | null, signals: readonly SignalRow[]): boolean =>
  last?.state === 'dismissed' && signals.length > 0 && last.evidence_key === signals[0]?.evidence_key;

/** The UTC day of `at`. */
const dayOf = (at: Date) => at.toISOString().slice(0, 10);

/** Masks every string in a value of the evidence. */
function maskEvidence(value: unknown): unknown {
  if (typeof value === 'string') return maskSecrets(value);
  if (Array.isArray(value)) return value.map(maskEvidence);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, maskEvidence(inner)]));
  return value;
}

function seatOf(row: SeatRow, now: Date): Seat {
  const today = row.tokens_day === dayOf(now) ? row.tokens_used : 0;
  return {
    workspace: row.workspace_id, runner: row.runner_id, placedBy: row.placed_login, paused: row.paused, dailyTokens: row.daily_tokens,
    tokensToday: today, thinking: today < row.daily_tokens, lastLookAt: row.last_look_at, missedLooks: row.missed_looks,
  };
}

const signalOf = (row: SignalRow): Signal => ({
  id: row.id, fingerprint: row.fingerprint, check: row.check_name, kind: row.kind, checkLine: row.check_line, figures: row.figures,
  evidence: row.evidence, finding: row.finding_id, openedAt: row.opened_at, seenAt: row.seen_at,
});

const proposalOf = (row: ProposalRow): Proposal => ({
  id: row.id, kind: row.kind, action: row.action, label: row.label, target: row.target, replyTo: row.reply_to, by: row.author_login,
  outcome: row.outcome, note: row.note, at: row.created_at,
});

const findingOf = (row: FindingRow, proposals: readonly ProposalRow[]): Finding => ({
  id: row.id, fingerprint: row.fingerprint, kind: row.kind, severity: row.severity, title: row.title, checkLine: row.check_line, figures: row.figures,
  evidence: row.evidence, explanation: row.explanation, raisedBy: row.raised_by, lookedAt: row.looked_at, state: row.state, createdAt: row.created_at,
  closedAt: row.closed_at, proposals: proposals.filter((p) => p.finding_id === row.id).map(proposalOf),
});

const noteOf = (row: NoteRow): Note => ({ id: row.id, scope: row.scope, line: row.line, cites: row.cites, createdAt: row.created_at, expiresAt: row.expires_at });

const messageOf = (row: MessageRow): Message => ({
  id: row.id, finding: row.finding_id, kind: row.kind, by: row.author_login, body: row.body, replyTo: row.reply_to, remembered: row.remembered, at: row.created_at,
});

const actedServed = <T, U>(acted: Acted<T>, map: (value: T) => U): Served<U> =>
  acted.ok ? ok(map(acted.value)) : no(acted.refusal === 'forbidden' ? 'forbidden' : 'malformed', acted.error);

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

/** What reaches each owner for a high finding: the check first, then the title, and the page. */
function alertOf(finding: FindingRow, origin: string): Notice {
  const path = `/app/supervisor?finding=${finding.id}`;
  const check = finding.check_line ?? NO_CHECK;
  const heading = `Supervisor · ${finding.title}`;
  const url = `${origin}${path}`;
  return {
    push: JSON.stringify({ title: heading, body: check, url: path }),
    email: {
      subject: heading,
      text: [heading, '', check, '', `Open it: ${url}`, '', 'Sent by the Supervisor, an agent.'].join('\n'),
      html: [`<h1>${escape(heading)}</h1>`, `<p>${escape(check)}</p>`, `<p><a href="${escape(url)}">Open it on the Supervisor page</a></p>`, '<p>Sent by the Supervisor, an agent.</p>'].join('\n'),
    },
  };
}

export function supervisorService({ store, clock, alert }: SupervisorServiceDeps) {
  const iso = () => clock.now().toISOString();

  async function withProposals(rows: readonly FindingRow[]): Promise<Finding[]> {
    const proposals = await store.proposals(rows.map((r) => r.id));
    return rows.map((row) => findingOf(row, proposals));
  }

  /** Sends a high finding's one alert, once. */
  async function notify(finding: FindingRow, origin: string): Promise<boolean> {
    if (finding.severity !== 'high' || finding.notified_at !== null) return false;
    if (!(await store.markNotified(finding.id, iso()))) return false;
    await alert(await store.owners(finding.workspace_id), alertOf(finding, origin), origin);
    return true;
  }

  /** The open signals of the workspace a raise names, all of one fingerprint, or why not. */
  async function signalsOf(workspace: string, ids: readonly string[]): Promise<Served<SignalRow[]>> {
    const signals = ids.length === 0 ? [] : await store.signals(workspace, ids);
    if (signals.length !== new Set(ids).size || signals.some((s) => s.closed_at !== null)) return no('malformed', SIGNALS_UNKNOWN);
    return new Set(signals.map((s) => s.fingerprint)).size > 1 ? no('malformed', SIGNALS_TWO_FINGERPRINTS) : ok(signals);
  }

  /** A raise of an open fingerprint: its signals join the open finding, and a finding the check wrote alone gets its
   * first look and the suggestions it has room for. */
  async function addTo(last: FindingRow, signals: readonly SignalRow[], request: RaiseRequest, origin: string): Promise<RaiseReply> {
    await store.attachSignals(signals.map((s) => s.id), last.id);
    let looked = last;
    if (last.looked_at === null) {
      looked = await store.lookAt(last.id, maskSecrets(request.explanation), iso());
      const standing = (await store.proposals([last.id])).filter((p) => p.kind === 'suggestion').length;
      await store.insertSuggestions(request.suggestions.slice(0, Math.max(0, 2 - standing)).map((s) => ({ workspace_id: last.workspace_id, finding_id: last.id, ...s })));
    }
    const notified = await notify(looked, origin);
    const [finding] = await withProposals([looked]);
    return { finding: finding as Finding, raised: false, notified };
  }

  /** A new finding: the first signal's check line, figures and evidence digest first, then the seat's explanation. */
  async function create(workspace: string, fingerprint: string | null, signals: readonly SignalRow[], request: RaiseRequest, origin: string): Promise<RaiseReply> {
    const [first] = signals;
    const evidence = maskEvidence(request.evidence.length > 0 ? request.evidence : signals.flatMap((s) => s.evidence).slice(0, 50)) as unknown[];
    const row = await store.insertFinding({
      workspace_id: workspace, fingerprint, kind: request.kind, severity: request.severity, title: request.title,
      check_line: first?.check_line ?? null, figures: first?.figures ?? {}, evidence, evidence_key: first?.evidence_key ?? null,
      explanation: maskSecrets(request.explanation), raised_by: 'supervisor', looked_at: iso(),
    });
    await store.attachSignals(signals.map((s) => s.id), row.id);
    await store.insertSuggestions(request.suggestions.map((s) => ({ workspace_id: workspace, finding_id: row.id, ...s })));
    const notified = await notify(row, origin);
    const [finding] = await withProposals([row]);
    return { finding: finding as Finding, raised: true, notified };
  }

  return {
    /** The seat, by its runner: the caller owns the runner and the runner holds its workspace's seat. */
    async seat(caller: string, runnerId: string): Promise<Served<Viewer & { kind: 'seat' }>> {
      const runner = await store.runner(runnerId);
      if (!runner) return no('missing', NO_RUNNER);
      if (runner.owner !== caller) return no('forbidden', NOT_YOUR_RUNNER);
      const seat = await store.seatOfRunner(runnerId);
      if (!seat || seat.workspace_id !== runner.workspace_id) return no('forbidden', NO_SEAT);
      return ok({ kind: 'seat', workspace: seat.workspace_id, seat });
    },

    /** A person of the workspace. */
    async person(caller: string, workspace: string): Promise<Served<Viewer & { kind: 'person' }>> {
      const role = await store.role(workspace, caller);
      return role === null ? no('forbidden', NOT_MEMBER) : ok({ kind: 'person', workspace, user: caller, owner: role === 'owner' });
    },

    /** The seat's look, then up to 40 s for something new since `since` (now when none); null when nothing came. */
    async next(viewer: Viewer & { kind: 'seat' }, since: string | null): Promise<Served<NextReply | null>> {
      const from = since ?? iso();
      const deadline = clock.now().getTime() + SUPERVISOR_NEXT_HOLD_MS;
      const looked = await store.updateSeat(viewer.workspace, { last_look_at: iso(), missed_looks: 0 });
      for (;;) {
        const at = iso();
        const wake = await store.wakes(viewer.workspace, from);
        if (wake.signals + wake.messages + wake.presses > 0) return ok({ at, wake, seat: seatOf(looked, clock.now()) });
        if (clock.now().getTime() + SUPERVISOR_NEXT_POLL_MS > deadline) return ok(null);
        await clock.sleep(SUPERVISOR_NEXT_POLL_MS);
      }
    },

    /** The seat checks in with the tokens it used: they count on today's (UTC) total. */
    async checkIn(viewer: Viewer & { kind: 'seat' }, tokens: number): Promise<Served<Seat>> {
      const now = clock.now();
      const today = dayOf(now);
      const used = (viewer.seat.tokens_day === today ? viewer.seat.tokens_used : 0) + tokens;
      const row = await store.updateSeat(viewer.workspace, { last_look_at: now.toISOString(), missed_looks: 0, tokens_day: today, tokens_used: used });
      return ok(seatOf(row, now));
    },

    async seatRead(viewer: Viewer): Promise<Served<Seat | null>> {
      const row = viewer.kind === 'seat' ? viewer.seat : await store.seat(viewer.workspace);
      return ok(row ? seatOf(row, clock.now()) : null);
    },

    /** What the seat reads on each look: its seat, the open signals and findings, the runners, the jobs, the missions. */
    async snapshot(viewer: Viewer & { kind: 'seat' }): Promise<Served<Snapshot>> {
      const now = clock.now();
      const since = new Date(now.getTime() - 6 * 3600_000).toISOString();
      const [signals, findings, runners, jobs, missions] = await Promise.all([
        store.openSignals(viewer.workspace), store.findings(viewer.workspace, true), store.runners(viewer.workspace),
        store.jobs(viewer.workspace, since), store.missions(viewer.workspace),
      ]);
      return ok({
        at: now.toISOString(),
        seat: seatOf(viewer.seat, now),
        signals: signals.map(signalOf),
        findings: await withProposals(findings),
        runners: runners.map((r) => ({ id: r.id, name: r.name, slots: r.slots, version: r.version, lastSeenAt: r.last_seen_at, health: r.health })),
        jobs: jobs.map((j) => ({
          id: j.id, line: j.line, repo: j.repo, status: j.status, runner: j.runner_id, attempt: j.attempt, queuedAt: j.queued_at,
          runningAt: j.running_at, endedAt: j.ended_at, reason: j.reason === null ? null : maskSecrets(j.reason), mission: j.mission_id,
        })),
        missions: missions.map((m) => ({ id: m.id, title: m.title, status: m.status, updatedAt: m.updated_at, nextWakeAt: m.next_wake_at, waitingOn: m.waiting_on })),
      });
    },

    /** A job's lines after `after`, masked, for the seat of the job's workspace. */
    async lines(viewer: Viewer & { kind: 'seat' }, job: string, after: number) {
      if (!(await store.job(viewer.workspace, job))) return no('missing', NO_JOB);
      const lines = await store.lines(job, after, SUPERVISOR_LINES_PAGE);
      return ok(lines.map((line) => ({ ...line, text: maskSecrets(line.text) })));
    },

    async findings(viewer: Viewer, open: boolean): Promise<Served<Finding[]>> {
      return ok(await withProposals(await store.findings(viewer.workspace, open)));
    },

    /** The seat raises a finding, or adds to the open one of its fingerprint; a high one alerts the owners once. */
    async raise(viewer: Viewer & { kind: 'seat' }, request: RaiseRequest, origin: string): Promise<Served<RaiseReply>> {
      const signals = await signalsOf(viewer.workspace, request.signals);
      if (!signals.ok) return signals;
      const fingerprint = fingerprintOf(signals.value, request);
      const last = fingerprint === null ? null : await store.lastOfFingerprint(viewer.workspace, fingerprint);
      if (last?.state === 'open') return ok(await addTo(last, signals.value, request, origin));
      if (dismissedAlike(last, signals.value)) return no('conflict', DISMISSED_SAME);
      return ok(await create(viewer.workspace, fingerprint, signals.value, request, origin));
    },

    async memory(viewer: Viewer, scope: 'short' | 'long' | null): Promise<Served<Note[]>> {
      return ok((await store.notes(viewer.workspace, scope, iso())).map(noteOf));
    },

    async remember(viewer: Viewer & { kind: 'seat' }, note: NoteRequest): Promise<Served<Note>> {
      return ok(noteOf(await store.insertNote({ workspace_id: viewer.workspace, scope: note.scope, line: maskSecrets(note.line), cites: note.cites })));
    },

    async messages(viewer: Viewer, finding: string | null, after: string | null): Promise<Served<Message[]>> {
      if (finding !== null && !(await store.finding(viewer.workspace, finding))) return no('missing', NO_FINDING);
      return ok((await store.messages(viewer.workspace, finding, after)).map(messageOf));
    },

    /** The seat answers in a thread of its workspace. */
    async answer(viewer: Viewer & { kind: 'seat' }, request: AnswerRequest): Promise<Served<Message>> {
      if (request.finding !== null && !(await store.finding(viewer.workspace, request.finding))) return no('missing', NO_FINDING);
      if (request.replyTo !== undefined && !(await store.message(viewer.workspace, request.replyTo))) return no('missing', NO_MESSAGE);
      const row = await store.insertAnswer({
        workspace_id: viewer.workspace, finding_id: request.finding, body: maskSecrets(request.body), reply_to: request.replyTo ?? null,
        remembered: request.remembered ?? null, tokens: request.tokens,
      });
      return ok(messageOf(row));
    },

    // ── An owner's acts, as that owner: the database refuses anyone else ──

    async say(acts: SupervisorActs, workspace: string, finding: string | null, text: string): Promise<Served<Message>> {
      return actedServed(await acts.say(workspace, finding, text), messageOf);
    },
    async place(acts: SupervisorActs, workspace: string, runner: string): Promise<Served<Seat>> {
      return actedServed(await acts.place(workspace, runner), (row) => seatOf(row, clock.now()));
    },
    async setSeat(acts: SupervisorActs, workspace: string, paused: boolean | null, dailyTokens: number | null): Promise<Served<Seat>> {
      return actedServed(await acts.set(workspace, paused, dailyTokens), (row) => seatOf(row, clock.now()));
    },
    async forget(acts: SupervisorActs, workspace: string, what: { note: string } | { scope: 'short' | 'long' | 'all' }): Promise<Served<number>> {
      if ('note' in what) return actedServed(await acts.deleteNote(what.note), () => 1);
      return actedServed(await acts.clear(workspace, what.scope), (n) => n);
    },
  };
}

export type SupervisorService = ReturnType<typeof supervisorService>;
