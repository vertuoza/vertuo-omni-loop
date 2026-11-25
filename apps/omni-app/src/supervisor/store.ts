// The watch's store (PRD omni-loop-34 s2, ./watch.ts), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
// the App has no person's session. Every read and write names one workspace (BR-PRODUCT-63): its seat, runners, jobs,
// missions and App errors, and its Supervisor rows (supabase/migrations/20270129180000_supervisor.sql). The ledger's
// health is the App's own, read for every workspace alike. No AI key is read (BR-PRODUCT-59). A job's last line is
// masked where it is read (L-GDPR-2), and the table masks again. Throws when the database refuses or answers out of
// shape: the job's run fails, and the next slot runs again.
import { z } from 'zod';
import type { Json } from '../../../../supabase/database.types.ts';
import { maskSecrets } from 'omni-loop/kit/lib/openrouter.ts';
import type { Connection } from '../approved-check/record.ts';
import { jobLedger } from '../jobs/ledger.ts';
import { SCHEDULES } from '../jobs/schedule.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import { baselinesOf } from './baselines.ts';
import type { Evidence, Fire, WatchJob, WatchMission, WatchRunner, WatchSnapshot } from './checks.ts';
import type { Seat } from './seat.ts';
import type { LinkedFinding, OpenSignal, WatchStore } from './watch.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The columns each read selects, shared with ./store.boundary.ts. */
export const SEAT_LANES = 'workspace_id';
export const SEAT = 'workspace_id, runner_id, paused, daily_tokens, tokens_day, tokens_used, last_look_at, placed_at, runners(name)';
export const WATCH_RUNNER = 'id, name, fleet, repos, last_seen_at, health';
export const SAMPLE = 'runner_id, at, disk_free';
export const WATCH_JOB = 'id, repo, line, status, outcome, reason, runner_id, to_runner, to_fleet, queued_at, running_at, ended_at, resume_after, attempt';
export const FAILED_JOB = `${WATCH_JOB}, log_tail`;
export const WATCH_MISSION = 'id, number, title, status, updated_at';
export const SIGNAL = 'id, fingerprint, opened_at, finding_id';
export const FINDING = 'id, state, raised_by, looked_at';
export const DISMISSAL = 'evidence_key, supervisor_findings!inner(fingerprint)';

export const LaneRowSchema = z.object({ workspace_id: z.uuid() });
export const SeatRowSchema = z.object({
  workspace_id: z.uuid(), runner_id: z.uuid(), paused: z.boolean(), daily_tokens: z.coerce.number(), tokens_day: z.string().nullable(),
  tokens_used: z.coerce.number(), last_look_at: z.string().nullable(), placed_at: z.string(), runners: z.object({ name: z.string() }).nullable(),
});
const AccountSchema = z.object({ state: z.enum(['ready', 'active', 'out']) });
const HealthSchema = z.object({ paused: z.string().nullable().optional(), accounts: z.array(AccountSchema).optional() }).nullable().catch(null);
export const WatchRunnerRowSchema = z.object({
  id: z.uuid(), name: z.string(), fleet: z.string().nullable(), repos: z.array(z.string()), last_seen_at: z.string(), health: z.unknown(),
});
export const SampleRowSchema = z.object({ runner_id: z.uuid(), at: z.string(), disk_free: z.coerce.number().nullable() });
export const WatchJobRowSchema = z.object({
  id: z.uuid(), repo: z.string(), line: z.string(), status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  outcome: z.string().nullable(), reason: z.string().nullable(), runner_id: z.uuid().nullable(), to_runner: z.uuid().nullable(),
  to_fleet: z.string().nullable(), queued_at: z.string(), running_at: z.string().nullable(), ended_at: z.string().nullable(),
  resume_after: z.string().nullable(), attempt: z.number().int(),
});
export const FailedJobRowSchema = WatchJobRowSchema.extend({ log_tail: z.string() });
export const LineAtRowSchema = z.object({ at: z.string() });
export const ContinuesRowSchema = z.object({ continues: z.uuid().nullable() });
export const WatchMissionRowSchema = z.object({ id: z.uuid(), number: z.number().int(), title: z.string(), status: z.string(), updated_at: z.string() });
export const EventAtRowSchema = z.object({ at: z.string() });
export const LedgerRowSchema = z.object({ kind: z.string(), state: z.string() });
export const WatchRepairRowSchema = z.object({ fingerprint: z.string() });
export const ErrorRowSchema = z.object({ route: z.string(), status: z.number().int(), created_at: z.string() });
export const NoteRowSchema = z.object({ line: z.string() });
export const SignalRowSchema = z.object({ id: z.uuid(), fingerprint: z.string(), opened_at: z.string(), finding_id: z.uuid().nullable() });
export const FindingRowSchema = z.object({
  id: z.uuid(), state: z.enum(['open', 'acted', 'dismissed', 'resolved']), raised_by: z.enum(['check', 'supervisor']), looked_at: z.string().nullable(),
});
export const DismissalRowSchema = z.object({ evidence_key: z.string().nullable(), supervisor_findings: z.object({ fingerprint: z.string().nullable() }) });
const IdRowSchema = z.object({ id: z.uuid() });

/** The last line of a log tail, masked. */
export function lastLineOf(tail: string): string | null {
  const line = tail.split('\n').map((text) => text.trim()).filter((text) => text !== '').at(-1);
  return line === undefined ? null : maskSecrets(line).slice(0, 600);
}

/** The scheduled kinds whose last 3 finished runs all failed, from finished runs given newest first. */
export function failingKinds(rows: readonly { kind: string; state: string }[]): string[] {
  const runs = new Map<string, string[]>();
  for (const row of rows) runs.set(row.kind, [...(runs.get(row.kind) ?? []), row.state]);
  return [...runs.entries()].filter(([, states]) => states.length >= 3 && states.slice(0, 3).every((state) => state === 'failed')).map(([kind]) => kind);
}

const jobOf = (row: z.infer<typeof WatchJobRowSchema>, more: Partial<WatchJob> = {}): WatchJob => ({
  id: row.id, repo: row.repo, line: row.line, status: row.status, outcome: row.outcome, reason: row.reason, runnerId: row.runner_id,
  toRunner: row.to_runner, toFleet: row.to_fleet, queuedAt: row.queued_at, runningAt: row.running_at, endedAt: row.ended_at,
  resumeAfter: row.resume_after, attempt: row.attempt, lastLineAt: null, lastLine: null, continued: false, ...more,
});

const evidenceJson = (evidence: readonly Evidence[]): Json =>
  evidence.map((e) => (e.text === undefined ? { of: e.of, id: e.id } : { of: e.of, id: e.id, text: maskSecrets(e.text) }));

/** The workspaces with a Supervisor seat: the watch's lanes (../jobs/schedule.ts). */
export function seatLanes(connection: Connection): () => Promise<string[]> {
  const db = serviceDb(connection);
  return async () => rowsOf(LaneRowSchema, await db.from('supervisor_seats').select(SEAT_LANES).order('workspace_id').limit(1000)).map((row) => row.workspace_id);
}

/** The store, as the service role on `connection`. */
export function watchStore(connection: Connection): WatchStore {
  const db = serviceDb(connection);
  const ledger = jobLedger(connection);

  async function runners(workspace: string, now: number): Promise<WatchRunner[]> {
    const rows = rowsOf(WatchRunnerRowSchema, await db.from('runners').select(WATCH_RUNNER).eq('workspace_id', workspace).limit(200));
    const samples = rowsOf(SampleRowSchema, await db.from('runner_samples').select(SAMPLE).eq('workspace_id', workspace)
      .gte('at', new Date(now - HOUR).toISOString()).order('at', { ascending: true }).limit(5000));
    return rows.map((row) => {
      const health = HealthSchema.parse(row.health);
      return {
        id: row.id, name: row.name, fleet: row.fleet, repos: row.repos, lastSeenAt: row.last_seen_at, paused: health?.paused ?? null,
        accounts: health?.accounts ? health.accounts.map((account) => account.state) : null,
        disk: samples.flatMap((s) => (s.runner_id === row.id && s.disk_free !== null ? [{ at: s.at, free: s.disk_free }] : [])),
      };
    });
  }

  async function jobs(workspace: string, now: number): Promise<WatchJob[]> {
    const active = rowsOf(WatchJobRowSchema, await db.from('runner_jobs').select(WATCH_JOB).eq('workspace_id', workspace).in('status', ['queued', 'claimed', 'running']).limit(500));
    const failed = rowsOf(FailedJobRowSchema, await db.from('runner_jobs').select(FAILED_JOB).eq('workspace_id', workspace).eq('status', 'failed')
      .gte('ended_at', new Date(now - 24 * HOUR).toISOString()).order('ended_at', { ascending: false }).limit(300));
    const waiting = rowsOf(WatchJobRowSchema, await db.from('runner_jobs').select(WATCH_JOB).eq('workspace_id', workspace).eq('status', 'done')
      .in('outcome', ['human', 'answers', 'held']).gte('ended_at', new Date(now - 14 * 24 * HOUR).toISOString())
      .lte('ended_at', new Date(now - 4 * HOUR).toISOString()).limit(300));
    const continued = waiting.length === 0 ? new Set<string>() : new Set(rowsOf(ContinuesRowSchema, await db.from('runner_jobs').select('continues')
      .eq('workspace_id', workspace).in('continues', waiting.map((job) => job.id))).flatMap((row) => (row.continues === null ? [] : [row.continues])));
    const running = await Promise.all(active.filter((job) => job.status === 'running').slice(0, 100).map(async (job) => {
      const [line] = rowsOf(LineAtRowSchema, await db.from('runner_job_lines').select('at').eq('job_id', job.id).order('seq', { ascending: false }).limit(1));
      return jobOf(job, { lastLineAt: line?.at ?? null });
    }));
    return [
      ...running,
      ...active.filter((job) => job.status !== 'running').map((job) => jobOf(job)),
      ...failed.map((job) => jobOf(job, { lastLine: lastLineOf(job.log_tail) })),
      ...waiting.map((job) => jobOf(job, { continued: continued.has(job.id) })),
    ];
  }

  async function missions(workspace: string): Promise<WatchMission[]> {
    const rows = rowsOf(WatchMissionRowSchema, await db.from('missions').select(WATCH_MISSION).eq('workspace_id', workspace).in('status', ['running', 'waiting']).limit(100));
    return Promise.all(rows.map(async (row) => {
      const [event] = rowsOf(EventAtRowSchema, await db.from('mission_events').select('at').eq('mission_id', row.id).order('at', { ascending: false }).limit(1));
      const [run] = rowsOf(LedgerRowSchema, await db.from('background_jobs').select('kind, state').eq('kind', 'mission').eq('key', `mission:${row.id}`).limit(1));
      const repairs: Record<string, number> = {};
      for (const repair of rowsOf(WatchRepairRowSchema, await db.from('mission_repairs').select('fingerprint').eq('mission_id', row.id).limit(500))) {
        repairs[repair.fingerprint] = (repairs[repair.fingerprint] ?? 0) + 1;
      }
      return { id: row.id, number: row.number, title: row.title, status: row.status, lastEventAt: event?.at ?? null, updatedAt: row.updated_at, runFailed: run?.state === 'failed', repairs };
    }));
  }

  async function openSignals(workspace: string): Promise<OpenSignal[]> {
    return rowsOf(SignalRowSchema, await db.from('supervisor_signals').select(SIGNAL).eq('workspace_id', workspace).is('closed_at', null).limit(1000))
      .map((row) => ({ id: row.id, fingerprint: row.fingerprint, openedAt: row.opened_at, findingId: row.finding_id }));
  }

  const done = (answer: { error: { message: string; code?: string } | null }): void => {
    if (answer.error) throw new Error(`the database refused: ${answer.error.message}${answer.error.code ? ` (${answer.error.code})` : ''}`);
  };

  return {
    async seat(workspace) {
      const [row] = rowsOf(SeatRowSchema, await db.from('supervisor_seats').select(SEAT).eq('workspace_id', workspace).limit(1));
      if (!row) return null;
      const seat: Seat = {
        workspace: row.workspace_id, runnerId: row.runner_id, runnerName: row.runners?.name ?? 'its runner', paused: row.paused, dailyTokens: row.daily_tokens,
        tokensDay: row.tokens_day, tokensUsed: row.tokens_used, lastLookAt: row.last_look_at, placedAt: row.placed_at,
      };
      return seat;
    },

    async snapshot(workspace, now): Promise<WatchSnapshot> {
      const errors = rowsOf(ErrorRowSchema, await db.from('app_errors').select('route, status, created_at').eq('workspace_id', workspace)
        .gte('created_at', new Date(now - HOUR).toISOString()).limit(1000));
      const health = await ledger.health();
      const finished = rowsOf(LedgerRowSchema, await db.from('background_jobs').select('kind, state').in('kind', SCHEDULES.map((s) => s.kind))
        .in('state', ['done', 'failed']).gte('finished_at', new Date(now - 7 * 24 * HOUR).toISOString()).order('finished_at', { ascending: false }).limit(500));
      const notes = rowsOf(NoteRowSchema, await db.from('supervisor_memory').select('line').eq('workspace_id', workspace).eq('scope', 'long')
        .order('created_at', { ascending: false }).limit(200));
      return {
        now, jobs: await jobs(workspace, now), runners: await runners(workspace, now), missions: await missions(workspace),
        errors: errors.map((row) => ({ route: row.route, status: row.status, at: row.created_at })),
        ledger: { late: health.late, scheduledLate: health.scheduled ?? 0, failing: failingKinds(finished) },
        baselines: baselinesOf(notes.map((note) => note.line)),
      };
    },

    openSignals,

    async findings(ids): Promise<LinkedFinding[]> {
      return rowsOf(FindingRowSchema, await db.from('supervisor_findings').select(FINDING).in('id', [...ids]))
        .map((row) => ({ id: row.id, state: row.state, raisedBy: row.raised_by, lookedAt: row.looked_at }));
    },

    async dismissals(workspace, fingerprints) {
      return rowsOf(DismissalRowSchema, await db.from('supervisor_proposals').select(DISMISSAL).eq('workspace_id', workspace).eq('kind', 'dismiss')
        .in('supervisor_findings.fingerprint', [...fingerprints]).limit(1000))
        .flatMap((row) => (row.supervisor_findings.fingerprint === null ? [] : [{ fingerprint: row.supervisor_findings.fingerprint, evidenceKey: row.evidence_key }]));
    },

    async setMissed(workspace, missed) {
      done(await db.from('supervisor_seats').update({ missed_looks: missed }).eq('workspace_id', workspace));
    },

    async upsertSignals(workspace, fires: readonly Fire[], at) {
      const open = new Map((await openSignals(workspace)).map((signal) => [signal.fingerprint, signal]));
      for (const fire of fires) {
        const row = { check_line: fire.checkLine, figures: fire.figures, evidence: evidenceJson(fire.evidence), evidence_key: fire.evidenceKey, seen_at: at };
        const known = open.get(fire.fingerprint);
        if (known) {
          done(await db.from('supervisor_signals').update(row).eq('id', known.id));
          continue;
        }
        const answer = await db.from('supervisor_signals').insert({ ...row, workspace_id: workspace, fingerprint: fire.fingerprint, check_name: fire.check, kind: fire.kind, opened_at: at });
        // Another run opened it meanwhile (the open index, 23505): it stands, and is read below.
        if (answer.error?.code !== '23505') done(answer);
      }
      const fired = new Set(fires.map((fire) => fire.fingerprint));
      return (await openSignals(workspace)).filter((signal) => fired.has(signal.fingerprint));
    },

    async closeSignals(ids, at) {
      done(await db.from('supervisor_signals').update({ closed_at: at }).in('id', [...ids]).is('closed_at', null));
    },

    async resolveFindings(ids, at) {
      done(await db.from('supervisor_findings').update({ state: 'resolved', closed_at: at }).in('id', [...ids]).eq('state', 'open'));
    },

    async raise(finding, at) {
      const [made] = rowsOf(IdRowSchema, await db.from('supervisor_findings').insert({
        workspace_id: finding.workspace, fingerprint: finding.fingerprint, kind: finding.kind, severity: finding.severity, title: finding.title,
        check_line: finding.checkLine, figures: finding.figures, evidence: evidenceJson(finding.evidence), evidence_key: finding.evidenceKey,
        raised_by: 'check', created_at: at,
      }).select('id'));
      if (!made) throw new Error('the database wrote no finding');
      for (const suggestion of (finding.suggestions ?? []).slice(0, 2)) {
        done(await db.from('supervisor_proposals').insert({
          workspace_id: finding.workspace, finding_id: made.id, kind: 'suggestion', action: suggestion.action, label: suggestion.label, target: suggestion.target,
        }));
      }
      done(await db.from('supervisor_signals').update({ finding_id: made.id }).eq('id', finding.signalId));
      return made.id;
    },

    async notified(findingId, at) {
      done(await db.from('supervisor_findings').update({ notified_at: at }).eq('id', findingId));
    },
  };
}
