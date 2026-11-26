import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The Supervisor's storage (PRD omni-loop-34 s3; ADR-0095), over supabase/migrations/20270129180000_supervisor.sql. Two
// sides:
//
// - `supervisorRepository(db)`, on the service role's client: the seat's reads and writes, and the reads a member's
//   page makes once the service has checked their workspace. Every answer is parsed where it comes in; a refusal of
//   the database, or an answer out of shape, throws, naming the call: the controller answers 500 and records it.
// - `supervisorActsRepository(db)`, on the signed-in person's client: an owner's acts, through the owner-checked
//   functions of the migration (supervisor_seat_place, supervisor_seat_set, supervisor_say, supervisor_memory_delete,
//   supervisor_memory_clear). Their refusals are rules of the database, answered by their code: 42501 is not an owner,
//   22023 a value it refused, with its words.
//
// It holds no rule.

/** What the reads and writes need: the tables, the functions and, for the owners' addresses, the Auth admin. */
export type SupervisorDb = Pick<SupabaseClient, 'from' | 'rpc' | 'auth'>;
/** What an owner's acts need: the functions, called as that person. */
export type ActsDb = Pick<SupabaseClient, 'rpc'>;

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** Reads one answer of the database: its value parsed, a refusal or a shape it does not expect thrown, naming `what`. */
function readOf<T>(what: string, schema: z.ZodType<T>): (raw: Raw) => T {
  return (raw) => {
    if (raw.error !== null) throw new Error(`supervisor ${what}: ${raw.error.message ?? raw.error.code ?? 'the database refused'}`);
    const read = schema.safeParse(raw.data);
    if (read.success) return read.data;
    throw new Error(`supervisor ${what} answered out of shape`);
  };
}

const parsed = <T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T> => Promise.resolve(call).then(readOf(what, schema));

const JsonObject = z.record(z.string(), z.unknown()).catch({});
const JsonArray = z.array(z.unknown()).catch([]);

const SeatRow = z.object({
  workspace_id: z.string(), runner_id: z.string(), placed_login: z.string(), paused: z.boolean(), daily_tokens: z.number(),
  tokens_day: z.string().nullable(), tokens_used: z.number(), last_look_at: z.string().nullable(), missed_looks: z.number(),
});
export type SeatRow = z.infer<typeof SeatRow>;

const RunnerRow = z.object({ id: z.string(), workspace_id: z.string(), owner: z.string(), name: z.string(), slots: z.number(), version: z.string(), last_seen_at: z.string(), health: z.unknown() });
export type RunnerRow = z.infer<typeof RunnerRow>;

const SignalRow = z.object({
  id: z.string(), workspace_id: z.string(), fingerprint: z.string(), check_name: z.string(), kind: z.enum(['stuck', 'bug', 'health']), check_line: z.string(),
  figures: JsonObject, evidence: JsonArray, evidence_key: z.string(), finding_id: z.string().nullable(), opened_at: z.string(), seen_at: z.string(), closed_at: z.string().nullable(),
});
export type SignalRow = z.infer<typeof SignalRow>;

const FindingRow = z.object({
  id: z.string(), workspace_id: z.string(), fingerprint: z.string().nullable(), kind: z.enum(['stuck', 'bug', 'health']), severity: z.enum(['high', 'medium']),
  title: z.string(), check_line: z.string().nullable(), figures: JsonObject, evidence: JsonArray, evidence_key: z.string().nullable(),
  explanation: z.string().nullable(), raised_by: z.enum(['check', 'supervisor']), looked_at: z.string().nullable(),
  state: z.enum(['open', 'acted', 'dismissed', 'resolved']), notified_at: z.string().nullable(), created_at: z.string(), closed_at: z.string().nullable(),
});
export type FindingRow = z.infer<typeof FindingRow>;
type NewFinding = Pick<FindingRow, 'workspace_id' | 'fingerprint' | 'kind' | 'severity' | 'title' | 'check_line' | 'figures' | 'evidence' | 'evidence_key' | 'explanation' | 'raised_by' | 'looked_at'>;

const ProposalRow = z.object({
  id: z.string(), finding_id: z.string(), kind: z.enum(['suggestion', 'press', 'result', 'dismiss']),
  action: z.enum(['stop-resume-job', 'open-terminal', 'open-bug-fix', 'pause-mission', 'resume-mission', 'wake-mission', 'open-mission', 'clean-worktrees', 'copy-kit-update']).nullable(),
  label: z.string().nullable(), target: z.record(z.string(), z.unknown()).nullable(), reply_to: z.string().nullable(), author_login: z.string().nullable(),
  outcome: z.enum(['done', 'refused', 'failed']).nullable(), note: z.string().nullable(), evidence_key: z.string().nullable(), created_at: z.string(),
});
export type ProposalRow = z.infer<typeof ProposalRow>;
type NewSuggestion = { workspace_id: string; finding_id: string; action: NonNullable<ProposalRow['action']>; label: string; target: Record<string, unknown> };

const NoteRow = z.object({ id: z.string(), workspace_id: z.string(), scope: z.enum(['short', 'long']), line: z.string(), cites: z.array(z.string()), created_at: z.string(), expires_at: z.string().nullable() });
export type NoteRow = z.infer<typeof NoteRow>;

const MessageRow = z.object({
  id: z.string(), workspace_id: z.string(), finding_id: z.string().nullable(), kind: z.enum(['owner', 'supervisor', 'result']), author_login: z.string().nullable(),
  body: z.string(), reply_to: z.string().nullable(), remembered: z.string().nullable(), created_at: z.string(),
});
export type MessageRow = z.infer<typeof MessageRow>;
type NewAnswer = { workspace_id: string; finding_id: string | null; body: string; reply_to: string | null; remembered: string | null; tokens: number };

const JobRow = z.object({
  id: z.string(), workspace_id: z.string(), line: z.string(), repo: z.string(), status: z.string(), runner_id: z.string().nullable(), attempt: z.number(),
  queued_at: z.string(), running_at: z.string().nullable(), ended_at: z.string().nullable(), reason: z.string().nullable(), mission_id: z.string().nullable(),
});
type JobRow = z.infer<typeof JobRow>;
const LineRow = z.object({ seq: z.number(), text: z.string(), at: z.string() });
type LineRow = z.infer<typeof LineRow>;
const MissionRow = z.object({ id: z.string(), title: z.string(), status: z.string(), updated_at: z.string(), next_wake_at: z.string().nullable(), waiting_on: z.string().nullable() });
type MissionRow = z.infer<typeof MissionRow>;

/** One person to reach, in notify.ts's shape. */
export type OwnerReach = { user: string; email: string | null; devices: { id: string; endpoint: string; p256dh: string; auth: string }[] };

const SEAT = 'workspace_id, runner_id, placed_login, paused, daily_tokens, tokens_day, tokens_used, last_look_at, missed_looks';
const FINDING = 'id, workspace_id, fingerprint, kind, severity, title, check_line, figures, evidence, evidence_key, explanation, raised_by, looked_at, state, notified_at, created_at, closed_at';
const SIGNAL = 'id, workspace_id, fingerprint, check_name, kind, check_line, figures, evidence, evidence_key, finding_id, opened_at, seen_at, closed_at';
const PROPOSAL = 'id, finding_id, kind, action, label, target, reply_to, author_login, outcome, note, evidence_key, created_at';
const NOTE = 'id, workspace_id, scope, line, cites, created_at, expires_at';
const MESSAGE = 'id, workspace_id, finding_id, kind, author_login, body, reply_to, remembered, created_at';
const JOB = 'id, workspace_id, line, repo, status, runner_id, attempt, queued_at, running_at, ended_at, reason, mission_id';
const ACTIVE_JOBS = ['queued', 'claimed', 'running'];
const Count = z.number().nullable().transform((n) => n ?? 0);

/** Reads a head count: `{ count }`, as PostgREST answers it. */
async function counted(call: PromiseLike<{ count: number | null; error: Raw['error'] }>, what: string): Promise<number> {
  const { count, error } = await call;
  if (error) throw new Error(`supervisor ${what}: ${error.message ?? error.code ?? 'the database refused'}`);
  return Count.parse(count);
}

export function supervisorRepository(db: SupervisorDb) {
  return {
    runner: async (id: string): Promise<RunnerRow | null> =>
      parsed(db.from('runners').select('id, workspace_id, owner, name, slots, version, last_seen_at, health').eq('id', id).maybeSingle(), RunnerRow.nullable(), 'runners'),
    runners: async (workspace: string): Promise<RunnerRow[]> =>
      parsed(db.from('runners').select('id, workspace_id, owner, name, slots, version, last_seen_at, health').eq('workspace_id', workspace).order('name'), z.array(RunnerRow), 'runners'),
    seatOfRunner: async (runner: string): Promise<SeatRow | null> =>
      parsed(db.from('supervisor_seats').select(SEAT).eq('runner_id', runner).maybeSingle(), SeatRow.nullable(), 'supervisor_seats'),
    seat: async (workspace: string): Promise<SeatRow | null> =>
      parsed(db.from('supervisor_seats').select(SEAT).eq('workspace_id', workspace).maybeSingle(), SeatRow.nullable(), 'supervisor_seats'),
    updateSeat: async (workspace: string, change: Partial<Pick<SeatRow, 'last_look_at' | 'missed_looks' | 'tokens_day' | 'tokens_used'>>): Promise<SeatRow> =>
      parsed(db.from('supervisor_seats').update(change).eq('workspace_id', workspace).select(SEAT).single(), SeatRow, 'supervisor_seats'),
    /** The member's role in the workspace, or null. */
    role: async (workspace: string, user: string): Promise<string | null> =>
      (await parsed(db.from('workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', user).maybeSingle(), z.object({ role: z.string() }).nullable(), 'workspace_members'))?.role ?? null,

    /** What woke since `since`: open signals opened, owners' messages written, suggestions pressed. */
    wakes: async (workspace: string, since: string) => {
      const [signals, messages, presses] = await Promise.all([
        counted(db.from('supervisor_signals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace).is('closed_at', null).gt('opened_at', since), 'supervisor_signals'),
        counted(db.from('supervisor_messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('kind', 'owner').gt('created_at', since), 'supervisor_messages'),
        counted(db.from('supervisor_proposals').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace).eq('kind', 'press').gt('created_at', since), 'supervisor_proposals'),
      ]);
      return { signals, messages, presses };
    },

    openSignals: async (workspace: string): Promise<SignalRow[]> =>
      parsed(db.from('supervisor_signals').select(SIGNAL).eq('workspace_id', workspace).is('closed_at', null).order('opened_at').limit(200), z.array(SignalRow), 'supervisor_signals'),
    signals: async (workspace: string, ids: readonly string[]): Promise<SignalRow[]> =>
      parsed(db.from('supervisor_signals').select(SIGNAL).eq('workspace_id', workspace).in('id', [...ids]), z.array(SignalRow), 'supervisor_signals'),
    attachSignals: async (ids: readonly string[], finding: string): Promise<void> => {
      await parsed(db.from('supervisor_signals').update({ finding_id: finding }).in('id', [...ids]), z.unknown(), 'supervisor_signals');
    },
    /** The signals a finding holds, open or closed. */
    signalsOfFinding: async (workspace: string, finding: string): Promise<SignalRow[]> =>
      parsed(db.from('supervisor_signals').select(SIGNAL).eq('workspace_id', workspace).eq('finding_id', finding).order('opened_at').limit(200), z.array(SignalRow), 'supervisor_signals'),

    findings: async (workspace: string, open: boolean): Promise<FindingRow[]> => {
      const query = db.from('supervisor_findings').select(FINDING).eq('workspace_id', workspace);
      return parsed((open ? query.eq('state', 'open') : query.neq('state', 'open')).order('created_at', { ascending: false }).limit(200), z.array(FindingRow), 'supervisor_findings');
    },
    finding: async (workspace: string, id: string): Promise<FindingRow | null> =>
      parsed(db.from('supervisor_findings').select(FINDING).eq('workspace_id', workspace).eq('id', id).maybeSingle(), FindingRow.nullable(), 'supervisor_findings'),
    /** The newest finding of a fingerprint, open or closed. */
    lastOfFingerprint: async (workspace: string, fingerprint: string): Promise<FindingRow | null> =>
      parsed(db.from('supervisor_findings').select(FINDING).eq('workspace_id', workspace).eq('fingerprint', fingerprint).order('created_at', { ascending: false }).limit(1).maybeSingle(), FindingRow.nullable(), 'supervisor_findings'),
    insertFinding: async (row: NewFinding): Promise<FindingRow> =>
      parsed(db.from('supervisor_findings').insert(row).select(FINDING).single(), FindingRow, 'supervisor_findings'),
    /** The seat's look on a finding the check wrote alone. */
    lookAt: async (id: string, explanation: string, at: string): Promise<FindingRow> =>
      parsed(db.from('supervisor_findings').update({ explanation, looked_at: at }).eq('id', id).select(FINDING).single(), FindingRow, 'supervisor_findings'),
    /** A group finding's evidence, figures and evidence key, once a raise added signals to it. */
    extendFinding: async (id: string, change: Pick<FindingRow, 'evidence' | 'figures' | 'evidence_key'>): Promise<FindingRow> =>
      parsed(db.from('supervisor_findings').update(change).eq('id', id).select(FINDING).single(), FindingRow, 'supervisor_findings'),
    /** Marks a finding notified, once: true only for the call that marked it. */
    markNotified: async (id: string, at: string): Promise<boolean> =>
      (await parsed(db.from('supervisor_findings').update({ notified_at: at }).eq('id', id).is('notified_at', null).select('id'), z.array(z.object({ id: z.string() })), 'supervisor_findings')).length === 1,

    proposals: async (findings: readonly string[]): Promise<ProposalRow[]> =>
      findings.length === 0 ? [] : parsed(db.from('supervisor_proposals').select(PROPOSAL).in('finding_id', [...findings]).order('created_at'), z.array(ProposalRow), 'supervisor_proposals'),
    insertSuggestions: async (rows: readonly NewSuggestion[]): Promise<void> => {
      if (rows.length === 0) return;
      await parsed(db.from('supervisor_proposals').insert(rows.map((row) => ({ ...row, kind: 'suggestion' }))), z.unknown(), 'supervisor_proposals');
    },

    notes: async (workspace: string, scope: 'short' | 'long' | null, now: string): Promise<NoteRow[]> => {
      const query = db.from('supervisor_memory').select(NOTE).eq('workspace_id', workspace).or(`expires_at.is.null,expires_at.gt.${now}`);
      return parsed((scope ? query.eq('scope', scope) : query).order('created_at', { ascending: false }).limit(300), z.array(NoteRow), 'supervisor_memory');
    },
    insertNote: async (row: { workspace_id: string; scope: 'short' | 'long'; line: string; cites: string[] }): Promise<NoteRow> =>
      parsed(db.from('supervisor_memory').insert(row).select(NOTE).single(), NoteRow, 'supervisor_memory'),

    messages: async (workspace: string, finding: string | null, after: string | null): Promise<MessageRow[]> => {
      const thread = db.from('supervisor_messages').select(MESSAGE).eq('workspace_id', workspace);
      const scoped = finding === null ? thread.is('finding_id', null) : thread.eq('finding_id', finding);
      return parsed((after === null ? scoped : scoped.gt('created_at', after)).order('created_at').limit(200), z.array(MessageRow), 'supervisor_messages');
    },
    message: async (workspace: string, id: string): Promise<MessageRow | null> =>
      parsed(db.from('supervisor_messages').select(MESSAGE).eq('workspace_id', workspace).eq('id', id).maybeSingle(), MessageRow.nullable(), 'supervisor_messages'),
    insertAnswer: async (row: NewAnswer): Promise<MessageRow> =>
      parsed(db.from('supervisor_messages').insert({ ...row, kind: 'supervisor' }).select(MESSAGE).single(), MessageRow, 'supervisor_messages'),

    job: async (workspace: string, id: string): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').select(JOB).eq('workspace_id', workspace).eq('id', id).maybeSingle(), JobRow.nullable(), 'runner_jobs'),
    /** The jobs queued or running, and those that ended since `since`. */
    jobs: async (workspace: string, since: string): Promise<JobRow[]> => {
      const [active, ended] = await Promise.all([
        parsed(db.from('runner_jobs').select(JOB).eq('workspace_id', workspace).in('status', ACTIVE_JOBS).order('queued_at').limit(200), z.array(JobRow), 'runner_jobs'),
        parsed(db.from('runner_jobs').select(JOB).eq('workspace_id', workspace).gt('ended_at', since).order('ended_at', { ascending: false }).limit(200), z.array(JobRow), 'runner_jobs'),
      ]);
      return [...active, ...ended];
    },
    lines: async (job: string, after: number, limit: number): Promise<LineRow[]> =>
      parsed(db.from('runner_job_lines').select('seq, text, at').eq('job_id', job).gt('seq', after).order('seq').limit(limit), z.array(LineRow), 'runner_job_lines'),
    missions: async (workspace: string): Promise<MissionRow[]> =>
      parsed(db.from('missions').select('id, title, status, updated_at, next_wake_at, waiting_on').eq('workspace_id', workspace).order('updated_at', { ascending: false }).limit(100), z.array(MissionRow), 'missions'),

    /** How each owner of the workspace is reached: email when their Email switch is on (on with no row), devices when Phone alerts is. */
    owners: async (workspace: string): Promise<OwnerReach[]> => {
      const owners = await parsed(db.from('workspace_members').select('user_id').eq('workspace_id', workspace).eq('role', 'owner'), z.array(z.object({ user_id: z.string() })), 'workspace_members');
      const ids = owners.map((o) => o.user_id);
      if (ids.length === 0) return [];
      const [switches, devices] = await Promise.all([
        parsed(db.from('alert_channels').select('user_id, email, push').in('user_id', ids), z.array(z.object({ user_id: z.string(), email: z.boolean(), push: z.boolean() })), 'alert_channels'),
        parsed(db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', ids), z.array(z.object({ id: z.string(), user_id: z.string(), endpoint: z.string(), p256dh: z.string(), auth: z.string() })), 'push_subscriptions'),
      ]);
      return Promise.all(ids.map(async (user) => {
        const switched = switches.find((s) => s.user_id === user);
        const emailOn = switched?.email ?? true;
        const { data } = emailOn ? await db.auth.admin.getUserById(user) : { data: { user: null } };
        return {
          user,
          email: data.user?.email ?? null,
          devices: switched?.push === true ? devices.filter((d) => d.user_id === user).map(({ id, endpoint, p256dh, auth }) => ({ id, endpoint, p256dh, auth })) : [],
        };
      }));
    },
    forgetDevice: async (id: string): Promise<void> => {
      await parsed(db.from('push_subscriptions').delete().eq('id', id), z.unknown(), 'push_subscriptions');
    },
  };
}

export type SupervisorStore = ReturnType<typeof supervisorRepository>;

/** An owner's act: its value, or the database's refusal (`forbidden`: not an owner; `refused`: a value it refused, in its words). */
export type Acted<T> = { ok: true; value: T } | { ok: false; refusal: 'forbidden' | 'refused'; error: string };

/** The refusals of the owner-checked functions, by their code. */
const REFUSALS: Record<string, 'forbidden' | 'refused'> = { '42501': 'forbidden', '22023': 'refused' };

async function acted<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<Acted<T>> {
  const raw = await call;
  const refusal = raw.error?.code === undefined ? undefined : REFUSALS[raw.error.code];
  if (refusal !== undefined) return { ok: false, refusal, error: raw.error?.message ?? 'The database refused this act.' };
  // A function that returns one row may answer it as an object or as a list of one (PostgREST).
  const data: unknown = Array.isArray(raw.data) && raw.data.length === 1 ? raw.data[0] : raw.data;
  return { ok: true, value: readOf(what, schema)({ data, error: raw.error }) };
}

/** An owner's acts, as that owner: the database checks is_owner() in each function. */
export function supervisorActsRepository(db: ActsDb) {
  return {
    place: (workspace: string, runner: string) => acted(db.rpc('supervisor_seat_place', { p_workspace: workspace, p_runner: runner }), SeatRow, 'supervisor_seat_place()'),
    set: (workspace: string, paused: boolean | null, dailyTokens: number | null) =>
      acted(db.rpc('supervisor_seat_set', { p_workspace: workspace, p_paused: paused, p_daily_tokens: dailyTokens }), SeatRow, 'supervisor_seat_set()'),
    say: (workspace: string, finding: string | null, text: string) =>
      acted(db.rpc('supervisor_say', { p_workspace: workspace, p_finding: finding, p_text: text }), MessageRow, 'supervisor_say()'),
    deleteNote: (note: string) => acted(db.rpc('supervisor_memory_delete', { p_note: note }), z.boolean(), 'supervisor_memory_delete()'),
    clear: (workspace: string, scope: 'short' | 'long' | 'all') => acted(db.rpc('supervisor_memory_clear', { p_workspace: workspace, p_scope: scope }), z.number(), 'supervisor_memory_clear()'),
  };
}

export type SupervisorActs = ReturnType<typeof supervisorActsRepository>;
