import type { SupabaseClient } from '@supabase/supabase-js';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { territoryOf } from 'omni-loop/kit/lib/mission/drop.ts';
import type { DecisionEvent } from 'omni-loop/kit/lib/mission/overturn.ts';
import { z } from 'zod';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import { ItemAnswerSchema, MissionLevelSchema, RetroReadSchema, MissionStatusSchema, StopAnswerSchema, type ItemAnswer, type MissionStatus, type RetroRead, type StopAnswer } from './missions.contract';

// The missions' reads and writes (PRD 2842 s5), on the clients they are given. A signed-in person reads
// through their own session, so row-level security shows a mission to the members of its workspace and to
// nobody else; only the service role writes (supabase/migrations/20270122093000_missions.sql): it moves a
// mission, records its event and adds or refreshes its job on the App's ledger (`background_job_refresh`).
// Each answer is parsed where it comes in; a failed read or write throws. No rule lives here.

export type MissionsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'missions/missions.repository';
const MISSION = 'id, workspace_id, repo, status, number, title, mandate, paused_by, waiting_on';

const MissionRow = z.object({
  id: z.uuid(), workspace_id: z.uuid(), repo: z.string().min(1), status: MissionStatusSchema,
  number: z.number().int().positive(), title: z.string(),
  // `stuck` while the supervisor holds the mission paused by stuck (PRD 3065); absent from a row an older read returns.
  paused_by: z.enum(['stuck']).nullable().default(null),
  // What it waits on (a goal-only mission's PM that wrote no PRD is resumed from it, #3203); absent from a row an older read returns.
  waiting_on: z.string().nullable().default(null),
  // A mission made before PRD 2896 holds no level: it reads `with-you`.
  mandate: z.object({ level: MissionLevelSchema.optional(), tokens: z.number().int().positive().optional() }).loose(),
});
const StopRow = z.object({
  id: z.uuid(), answer: StopAnswerSchema, raised_to: z.number().int().positive().nullable(), mission_id: z.uuid().nullable(), missions: z.array(z.uuid()),
});
/** A budget stop as its answer left it: who it paused, and what the answer was (PRD 3040). */
type AnsweredStopRow = { id: string; answer: StopAnswer; raisedTo: number | null; mission: string | null; missions: string[] };
/** A mission as the repository reads it: its workspace, its repository, where it stands and the level it runs at. */
export type MissionRecord = { id: string; workspace: string; repo: string; status: MissionStatus; number: number; title: string; level: MissionLevel; pausedBy: 'stuck' | null; waitingOn: string | null };

const toRecord = (row: z.infer<typeof MissionRow>): MissionRecord =>
  ({ id: row.id, workspace: row.workspace_id, repo: row.repo, status: row.status, number: row.number, title: row.title, level: row.mandate.level ?? 'with-you', pausedBy: row.paused_by, waitingOn: row.waiting_on });

const ItemRow = z.object({ id: z.uuid(), mission_id: z.uuid(), target: z.string(), answer: ItemAnswerSchema.nullable() });
/** A mission item as its answer left it: its mission, what it proposes to change and the answer (PRD 3065). */
type AnsweredItemRow = { id: string; mission: string; target: string; answer: ItemAnswer };

/** The job a mission keeps on the App's ledger: its kind, key, subject and lane, due at once (mirrors apps/omni-app/src/missions/job.ts). */
export type MissionJob = { kind: 'mission'; key: string; subject: string; payload: { mission: string }; lane: string; delaySeconds: 0 };

/** The job of mission `id` in repository `repo`: `background_job_refresh` adds it, brings a queued one forward or queues a finished one again. */
export const missionJob = (id: string, repo: string): MissionJob =>
  ({ kind: 'mission', key: `mission:${id}`, subject: repo.toLowerCase(), payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 });

const JoinRow = z.object({ kind: z.enum(['prd-joined', 'prd-dropped', 'landed', 'prd-merged']), prd: PrdNumberSchema });
const DecisionRow = z.object({ kind: z.string(), prd: PrdNumberSchema.nullable(), sentence: z.string(), link: z.string().nullable(), actor: z.string() });
const BugsRow = z.object({ kind: z.string(), job_id: z.uuid().nullable(), actor: z.string(), sentence: z.string() });
const PageRow = z.object({ id: z.uuid(), prd: PrdNumberSchema.nullable() });
const PlanRow = z.object({ content: z.string() });
const PageIdRow = z.object({ id: z.uuid() });
const VersionRow = z.object({ kind: z.enum(['mission-record', 'brief']), content: z.string() });
const RetroRow = z.object({ id: z.uuid(), milestone: z.string(), retro: RetroReadSchema.shape.retro, skipped: z.string().nullable() });
const RetroItemRow = z.object({
  retro_id: z.uuid().nullable(), number: z.number().int().positive(), target: z.string(), wording: z.string(),
  evidence: z.array(z.string()), answer: ItemAnswerSchema.nullable(), note: z.string().nullable(),
});
const NumberRow = z.object({ number: z.number().int().positive() });
const ProductRow = z.object({ plan_repository: z.string().nullable() });
const Refreshed = z.enum(['added', 'updated', 'again', 'requeued']);

async function readOne(db: MissionsDb, id: string): Promise<MissionRecord | null> {
  const { data, error } = await db.from('missions').select(MISSION).eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase: could not read the mission (${error.message})`);
  return data === null ? null : toRecord(orThrow(parseRow(MissionRow, data, `${WHERE}: missions`)));
}

/** What a signed-in person reads: the missions their workspace membership shows. */
export function missionsReader(db: MissionsDb) {
  async function onBranch(id: string): Promise<PrdNumber[]> {
    const { data, error } = await db.from('mission_events').select('kind, prd').eq('mission_id', id).in('kind', ['prd-joined', 'prd-dropped', 'landed', 'prd-merged']).not('prd', 'is', null).order('at', { ascending: true });
    if (error) throw new Error(`Supabase: could not read the mission's events (${error.message})`);
    const on = new Set<PrdNumber>();
    for (const row of orThrow(parseRows(JoinRow, data, `${WHERE}: mission_events`))) {
      if (row.kind === 'prd-joined') on.add(row.prd);
      else on.delete(row.prd);
    }
    return [...on];
  }
  return {
    /** The mission, or null when it is none or the person may not see it. */
    mission: (id: string): Promise<MissionRecord | null> => readOne(db, id),

    /** Whether the mission's repository is the plan repository of a live product of its workspace (PRD 2896 s14). */
    async inPlan(mission: MissionRecord): Promise<boolean> {
      const { data, error } = await db.from('products').select('plan_repository').eq('workspace_id', mission.workspace).is('archived_at', null);
      if (error) throw new Error(`Supabase: could not read the products (${error.message})`);
      return orThrow(parseRows(ProductRow, data, `${WHERE}: products`)).some((row) => row.plan_repository?.toLowerCase() === mission.repo.toLowerCase());
    },

    /** The PRDs on the mission's branch, in the order they joined: those whose latest join event is not followed by a drop or a landing. */
    onBranch,

    /** The fleet's decisions and the overturns of them, oldest first, as the mission's events say them (PRD 2896 s11). */
    async decisionEvents(id: string): Promise<DecisionEvent[]> {
      const { data, error } = await db.from('mission_events').select('kind, prd, sentence, link, actor').eq('mission_id', id).in('kind', ['decided', 'overturned']).order('at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the mission's decisions (${error.message})`);
      return orThrow(parseRows(DecisionRow, data, `${WHERE}: mission_events`));
    },

    /**
     * What a PRD waits on at `Decide the bugs` (PRD 3001): QA's round-2 job whose verdict still named bugs, and the person's pick on it
     * when one was made (a `resumed` or `stopped` event of the PRD naming that job). Null when QA's latest verdict of the PRD is no such round.
     */
    async bugsToDecide(id: string, prd: PrdNumber): Promise<{ job: string; picked: { pick: 'review' | 'stop'; actor: string } | null } | null> {
      const { data, error } = await db.from('mission_events').select('kind, job_id, actor, sentence').eq('mission_id', id).eq('prd', prd).in('kind', ['checked', 'resumed', 'stopped']).not('job_id', 'is', null).order('at', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the mission's events (${error.message})`);
      const rows = orThrow(parseRows(BugsRow, data, `${WHERE}: mission_events`));
      const checked = rows.findLast((row) => row.kind === 'checked');
      if (checked?.job_id == null || !/Round 2 of 2/.test(checked.sentence) || /^pass/.test(checked.sentence)) return null;
      const pick = rows.find((row) => row.job_id === checked.job_id && row.kind !== 'checked');
      return { job: checked.job_id, picked: pick === undefined ? null : { pick: pick.kind === 'resumed' ? 'review' : 'stop', actor: pick.actor } };
    },

    /** How many PRDs sit on the mission's branch. */
    async joined(id: string): Promise<number> {
      return (await onBranch(id)).length;
    },

    /** Mission `number` of repository `repo`, or null when it is none or the person may not see it. */
    async byNumber(repo: string, number: number): Promise<MissionRecord | null> {
      const { data, error } = await db.from('missions').select(MISSION).eq('repo', repo.toLowerCase()).eq('number', number).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the mission (${error.message})`);
      return data === null ? null : toRecord(orThrow(parseRow(MissionRow, data, `${WHERE}: missions`)));
    },

    /** The mission's latest mission.md and mission.html as pushed (PRD 3194), or null when its page holds none. */
    async page(mission: MissionRecord): Promise<{ record: string; brief: string } | null> {
      const pages = await db.from('dossiers').select('id').eq('workspace_id', mission.workspace).eq('home_repo', mission.repo).eq('kind', 'mission').eq('prd', mission.number).maybeSingle();
      if (pages.error) throw new Error(`Supabase: could not read the mission's page (${pages.error.message})`);
      if (pages.data === null) return null;
      const page = orThrow(parseRow(PageIdRow, pages.data, `${WHERE}: dossiers`));
      const versions = await db.from('dossier_versions').select('kind, content').eq('dossier_id', page.id).in('kind', ['mission-record', 'brief']).order('created_at', { ascending: false });
      if (versions.error) throw new Error(`Supabase: could not read the mission's brief (${versions.error.message})`);
      const rows = orThrow(parseRows(VersionRow, versions.data, `${WHERE}: dossier_versions`));
      const record = rows.find((row) => row.kind === 'mission-record');
      const brief = rows.find((row) => row.kind === 'brief');
      return record === undefined || brief === undefined ? null : { record: record.content, brief: brief.content };
    },

    /** Each retro of the mission, oldest first, with the items it raised (PRD 3194). */
    async retros(id: string): Promise<RetroRead[]> {
      const retros = await db.from('mission_retros').select('id, milestone, retro, skipped').eq('mission_id', id).order('created_at', { ascending: true });
      if (retros.error) throw new Error(`Supabase: could not read the mission's retros (${retros.error.message})`);
      const items = await db.from('mission_items').select('retro_id, number, target, wording, evidence, answer, note').eq('mission_id', id).not('retro_id', 'is', null).order('number', { ascending: true });
      if (items.error) throw new Error(`Supabase: could not read the mission's items (${items.error.message})`);
      const raised = orThrow(parseRows(RetroItemRow, items.data, `${WHERE}: mission_items`));
      return orThrow(parseRows(RetroRow, retros.data, `${WHERE}: mission_retros`)).map((row) => ({
        milestone: row.milestone, retro: row.retro, skipped: row.skipped,
        items: raised.filter((item) => item.retro_id === row.id).map((item) => ({ number: item.number, target: item.target, wording: item.wording, evidence: item.evidence, answer: item.answer, note: item.note })),
      }));
    },

    /** The numbers of the repository's missions whose brief names PRD `prd`, in order (PRD 3194). */
    async ofPrd(repo: string, prd: PrdNumber): Promise<number[]> {
      const { data, error } = await db.from('missions').select('number').eq('repo', repo.toLowerCase()).contains('scope', { prds: [prd] }).order('number', { ascending: true });
      if (error) throw new Error(`Supabase: could not read the missions naming PRD ${String(prd)} (${error.message})`);
      return orThrow(parseRows(NumberRow, data, `${WHERE}: missions`)).map((row) => row.number);
    },

    /** Each PRD's territory, every path its latest plan's slices declare; null for one with no plan, or one that cannot be read. */
    async territories(mission: MissionRecord, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, string[] | null>> {
      const found = new Map<PrdNumber, string[] | null>(prds.map((prd) => [prd, null]));
      if (prds.length === 0) return found;
      const pages = await db.from('dossiers').select('id, prd').eq('workspace_id', mission.workspace).eq('home_repo', mission.repo).eq('kind', 'prd').in('prd', [...prds]);
      if (pages.error) throw new Error(`Supabase: could not read the PRDs' pages (${pages.error.message})`);
      for (const page of orThrow(parseRows(PageRow, pages.data, `${WHERE}: dossiers`))) {
        const plans = await db.from('dossier_versions').select('content').eq('dossier_id', page.id).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1);
        if (plans.error) throw new Error(`Supabase: could not read a PRD's plan (${plans.error.message})`);
        const [plan] = orThrow(parseRows(PlanRow, plans.data, `${WHERE}: dossier_versions`));
        if (plan !== undefined && page.prd !== null) found.set(page.prd, territoryOf(plan.content));
      }
      return found;
    },

    /** Sets the mission's token budget (null: none) as the signed-in person, so the database decides who may: the budget, or its refusal in its words (PRD 3040). */
    async setTokens(id: string, tokens: number | null): Promise<{ ok: true; tokens: number | null } | { ok: false; code: string | null; error: string }> {
      const answer: { data: unknown; error: { message: string; code?: string } | null } = await db.rpc('set_mission_tokens', { p_mission: id, p_tokens: tokens });
      if (answer.error) return { ok: false, code: answer.error.code ?? null, error: answer.error.message };
      const done = orThrow(parseRow(MissionRow, answer.data, `${WHERE}: set_mission_tokens`));
      return { ok: true, tokens: done.mandate.tokens ?? null };
    },

    /** Answers a budget stop as the signed-in person, once: the stop as answered, or the database's refusal in its words (PRD 3040). */
    async answerStop(stop: string, answer: StopAnswer, tokens: number | null): Promise<{ ok: true; stop: AnsweredStopRow } | { ok: false; code: string | null; error: string }> {
      const made: { data: unknown; error: { message: string; code?: string } | null } = await db.rpc('answer_mission_budget_stop', { p_stop: stop, p_answer: answer, p_tokens: tokens });
      if (made.error) return { ok: false, code: made.error.code ?? null, error: made.error.message };
      const row = orThrow(parseRow(StopRow, made.data, `${WHERE}: answer_mission_budget_stop`));
      return { ok: true, stop: { id: row.id, answer: row.answer, raisedTo: row.raised_to, mission: row.mission_id, missions: row.missions } };
    },

    /** Answers a mission item as the signed-in person, once (answer_mission_item): the item as answered, or the database's refusal in its words (PRD 3065). */
    async answerItem(item: string, answer: ItemAnswer, note: string | null): Promise<{ ok: true; item: AnsweredItemRow } | { ok: false; code: string | null; error: string }> {
      const made: { data: unknown; error: { message: string; code?: string } | null } = await db.rpc('answer_mission_item', { p_item: item, p_answer: answer, ...(note === null ? {} : { p_note: note }) });
      if (made.error) return { ok: false, code: made.error.code ?? null, error: made.error.message };
      const row = orThrow(parseRow(ItemRow, made.data, `${WHERE}: answer_mission_item`));
      return row.answer === null ? { ok: false, code: null, error: 'The answer was not kept.' } : { ok: true, item: { id: row.id, mission: row.mission_id, target: row.target, answer: row.answer } };
    },

    /** Sets the mission's level as the signed-in person, so the database decides who may raise it: the level, or the database's refusal in its words. */
    async setLevel(id: string, level: MissionLevel): Promise<{ ok: true; level: MissionLevel } | { ok: false; forbidden: boolean; error: string }> {
      const answer: { data: unknown; error: { message: string; code?: string } | null } = await db.rpc('set_mission_level', { p_mission: id, p_level: level });
      if (answer.error) return { ok: false, forbidden: answer.error.code === '42501', error: answer.error.message };
      const done = orThrow(parseRow(MissionRow, answer.data, `${WHERE}: set_mission_level`));
      return { ok: true, level: done.mandate.level ?? 'with-you' };
    },
  };
}
export type MissionsReader = ReturnType<typeof missionsReader>;

/** What the service role reads and writes for a move and the supervisor's wakes. */
export function missionsWriter(db: MissionsDb) {
  return {
    /** The mission, as the service role reads it, or null. */
    mission: (id: string): Promise<MissionRecord | null> => readOne(db, id),

    /** The missions of a repository that run, wait or are paused: the ones a stage change or an answer may wake. */
    async watching(repo: string): Promise<MissionRecord[]> {
      const { data, error } = await db.from('missions').select(MISSION).eq('repo', repo.toLowerCase()).in('status', ['running', 'waiting', 'paused']);
      if (error) throw new Error(`Supabase: could not read the missions of ${repo} (${error.message})`);
      return orThrow(parseRows(MissionRow, data, `${WHERE}: missions`)).map(toRecord);
    },

    /** Moves the mission from one of `from` to `to`, due at `at`; whether it was still there to move (a Pause landing meanwhile is never overwritten). */
    async move(id: string, from: readonly MissionStatus[], to: MissionStatus, change: { at: string; startedBy: string | null; waitingOn?: string }): Promise<boolean> {
      const patch = { status: to, next_wake_at: change.at, updated_at: change.at, ...(change.startedBy === null ? {} : { started_by: change.startedBy }), ...(change.waitingOn === undefined ? {} : { waiting_on: change.waitingOn }) };
      const { data, error } = await db.from('missions').update(patch).eq('id', id).in('status', [...from]).select('id');
      if (error) throw new Error(`Supabase: could not move the mission (${error.message})`);
      return Array.isArray(data) && data.length > 0;
    },

    /** Records one event of the mission, signed with the member's login. */
    async event(id: string, event: { kind: 'started' | 'paused' | 'resumed' | 'stopped' | 'drop-asked' | 'drop-asked-keep' | 'overturned' | 'budget-answer' | 'stuck-answer' | 'item-answered'; actor: string; sentence: string; at: string; prd?: PrdNumber; job?: string }): Promise<void> {
      const { error } = await db.from('mission_events').insert({ mission_id: id, at: event.at, role: 'supervisor', actor: event.actor, kind: event.kind, sentence: event.sentence, ...(event.prd === undefined ? {} : { prd: event.prd }), ...(event.job === undefined ? {} : { job_id: event.job }) });
      if (error) throw new Error(`Supabase: could not record the mission's event (${error.message})`);
    },

    /** Adds or refreshes the mission's job on the ledger, due at once. */
    async refresh(job: MissionJob): Promise<void> {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('background_job_refresh', {
        p_kind: job.kind, p_key: job.key, p_subject: job.subject, p_payload: job.payload, p_delay_seconds: job.delaySeconds, p_lane: job.lane,
      });
      if (answer.error) throw new Error(`Supabase: could not refresh the mission's job (${answer.error.message})`);
      Refreshed.parse(answer.data);
    },
  };
}
export type MissionsWriter = ReturnType<typeof missionsWriter>;
