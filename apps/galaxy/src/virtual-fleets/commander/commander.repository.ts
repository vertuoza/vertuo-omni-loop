import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import { ReplySchema, type Deleted, type Message, type Reply } from './commander.contract';
import type { EventRow, JobRow, MissionRow, NoteRow } from './commander';

// The Commander's reads and writes (PRD 3107 s1; ADR-0095). The reader runs on the signed-in person's own client, so
// row-level security shows a fleet, its missions, events, jobs and thread to the workspace's members and to nobody else,
// and every read also names the workspace and the fleet: nothing of another is ever read. commander_ask() of
// supabase/migrations/20270128090000_fleet_commander.sql records a question as its asker. The writer runs as the
// service role, the one role that adds the Commander's reply. Each answer is parsed where it comes in; a failed read
// throws, a refused ask answers the database's code, hint and words. No rule lives here: commander.service.ts does.

export type CommanderDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A write: its value, or the database's refusal. */
export type Written<T> = { ok: true; value: T } | { ok: false; code: string | null; hint: string | null; message: string };

const WHERE = 'virtual-fleets/commander/commander.repository';
const MESSAGE_COLUMNS = 'id, kind, author_login, body, reply_to, reply, created_at';

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

const FleetRowSchema = z.object({ name: z.string(), kind: z.string(), daily_tokens: z.number().int().positive().nullable() });
const MissionRowSchema = z.object({
  id: z.uuid(), number: z.number().int().positive(), title: z.string(), status: z.string(), waiting_on: z.string().nullable(), repo: z.string(), updated_at: z.string(),
});
const EventRowSchema = z.object({
  id: z.uuid(), mission_id: z.uuid(), at: z.string(), role: z.string(), kind: z.string(), prd: PrdNumberSchema.nullable(),
  job_id: z.uuid().nullable(), link: z.string().nullable(), sentence: z.string(),
});
const JobRowSchema = z.object({ id: z.uuid(), mission_id: z.uuid().nullable(), queued_at: z.string(), line: z.string(), status: z.string(), outcome: z.string().nullable() });
const MessageRowSchema = z.object({
  id: z.uuid(), kind: z.enum(['question', 'reply']), author_login: z.string().nullable(), body: z.string().nullable(),
  reply_to: z.uuid().nullable(), reply: ReplySchema.nullable(), created_at: z.string(),
});
const FleetMessageRowSchema = z.object({ id: z.uuid(), author_login: z.string().min(1), body: z.string().min(1), created_at: z.string() });
const ReadRowSchema = z.object({ message_id: z.uuid(), role: z.string(), job_id: z.uuid(), read_at: z.string() });
const SpentRowSchema = z.object({ tokens: z.number().int().min(0), oldest_end: z.string().nullable() });
const NoteRowSchema = z.object({
  id: z.uuid(), notebook: z.enum(['mission', 'fleet']), mission_id: z.uuid(), day: z.string(), line: z.string().min(1), events: z.array(z.uuid()).min(1), created_at: z.string(),
});
const DeletedRowSchema = z.object({ id: z.uuid(), deleted_at: z.string(), deleted_login: z.string().min(1) });
/** The most lines of a fleet's notebooks the tab reads. */
const NOTES_READ = 500;

/** A stored message as the thread reads it. */
function messageOf(row: z.infer<typeof MessageRowSchema>): Message {
  if (row.kind === 'reply' && row.reply !== null && row.reply_to !== null) return { kind: 'reply', id: row.id, at: row.created_at, replyTo: row.reply_to, reply: row.reply };
  return { kind: 'question', id: row.id, at: row.created_at, login: row.author_login ?? 'a member', text: row.body ?? '' };
}

/** A message to the fleet as the thread reads it, with the jobs that read it, oldest read first. */
function fleetMessageOf(row: z.infer<typeof FleetMessageRowSchema>, reads: readonly z.infer<typeof ReadRowSchema>[]): Message {
  return {
    kind: 'fleet', id: row.id, at: row.created_at, login: row.author_login, text: row.body,
    reads: reads.filter((r) => r.message_id === row.id).sort((a, b) => a.read_at.localeCompare(b.read_at)).map((r) => ({ role: r.role, job: r.job_id, at: r.read_at })),
  };
}

const refusedBy = (error: NonNullable<Answer['error']>) => ({ ok: false as const, code: error.code || null, hint: error.hint || null, message: error.message });

/** The fleet as the signed-in person reads it: null when it is none of their workspace's. */
export interface FleetOf {
  virtual: boolean;
  cap: number | null;
}

export function commanderReader(db: CommanderDb) {
  return {
    /** The fleet of the workspace, as a member reads it; null for anyone else, or a fleet it does not have. */
    async fleet(workspace: string, fleet: string): Promise<FleetOf | null> {
      const { data, error } = await db.from('teams').select('name, kind, daily_tokens').eq('workspace_id', workspace).eq('name', fleet).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the fleet (${error.message})`);
      if (data === null) return null;
      const row = orThrow(parseRow(FleetRowSchema, data, `${WHERE}: teams`));
      return { virtual: row.kind === 'virtual', cap: row.daily_tokens };
    },

    /** The fleet's missions that started, newest first: at most 50. */
    async missions(workspace: string, fleet: string): Promise<MissionRow[]> {
      const { data, error } = await db.from('missions').select('id, number, title, status, waiting_on, repo, updated_at').eq('workspace_id', workspace).eq('fleet', fleet).neq('status', 'draft').order('updated_at', { ascending: false }).limit(50);
      if (error) throw new Error(`Supabase: could not read the missions (${error.message})`);
      return orThrow(parseRows(MissionRowSchema, data, `${WHERE}: missions`)).map((m) => ({
        id: m.id, number: m.number, title: m.title, status: m.status, waitingOn: m.waiting_on, repo: m.repo, updatedAt: m.updated_at,
      }));
    },

    /** One mission's events, newest first: at most `limit`, those before `before` when it is given. */
    async events(mission: string, limit: number, before: string | null = null): Promise<EventRow[]> {
      const query = db.from('mission_events').select('id, mission_id, at, role, kind, prd, job_id, link, sentence').eq('mission_id', mission);
      const { data, error } = await (before === null ? query : query.lt('at', before)).order('at', { ascending: false }).limit(limit);
      if (error) throw new Error(`Supabase: could not read the mission's events (${error.message})`);
      return orThrow(parseRows(EventRowSchema, data, `${WHERE}: mission_events`)).map((e) => ({
        id: e.id, mission: e.mission_id, at: e.at, role: e.role, kind: e.kind, prd: e.prd, job: e.job_id, link: e.link, sentence: e.sentence,
      }));
    },

    /** The jobs these missions of the workspace sent since `since`, newest first. */
    async jobs(workspace: string, missions: readonly string[], since: Date): Promise<JobRow[]> {
      if (missions.length === 0) return [];
      const { data, error } = await db.from('runner_jobs').select('id, mission_id, queued_at, line, status, outcome').eq('workspace_id', workspace).in('mission_id', [...missions]).gte('queued_at', since.toISOString()).order('queued_at', { ascending: false }).limit(100);
      if (error) throw new Error(`Supabase: could not read the fleet's jobs (${error.message})`);
      return orThrow(parseRows(JobRowSchema, data, `${WHERE}: runner_jobs`)).map((j) => ({ id: j.id, mission: j.mission_id, queuedAt: j.queued_at, line: j.line, status: j.status, outcome: j.outcome }));
    },

    /** The thread's last `limit` messages, oldest first. */
    async thread(workspace: string, fleet: string, limit: number): Promise<Message[]> {
      const { data, error } = await db.from('commander_messages').select(MESSAGE_COLUMNS).eq('workspace_id', workspace).eq('fleet', fleet).order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(`Supabase: could not read the Commander thread (${error.message})`);
      return orThrow(parseRows(MessageRowSchema, data, `${WHERE}: commander_messages`)).map(messageOf).reverse();
    },

    /** The fleet's last `limit` messages to its agents, with the jobs that read each, oldest first (fleet_messages, fleet_message_reads). */
    async fleetMessages(workspace: string, fleet: string, limit: number): Promise<Message[]> {
      const { data, error } = await db.from('fleet_messages').select('id, author_login, body, created_at').eq('workspace_id', workspace).eq('fleet', fleet).order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(`Supabase: could not read the fleet's messages (${error.message})`);
      const rows = orThrow(parseRows(FleetMessageRowSchema, data, `${WHERE}: fleet_messages`));
      if (rows.length === 0) return [];
      const seen = await db.from('fleet_message_reads').select('message_id, role, job_id, read_at').in('message_id', rows.map((r) => r.id));
      if (seen.error) throw new Error(`Supabase: could not read who read the fleet's messages (${seen.error.message})`);
      const reads = orThrow(parseRows(ReadRowSchema, seen.data, `${WHERE}: fleet_message_reads`));
      return rows.map((row) => fleetMessageOf(row, reads)).reverse();
    },

    /** What the fleet spent in the last 24 hours up to `at` (fleet_tokens_24h(): its jobs and its Commander), and the oldest spending's time. */
    async spent(workspace: string, fleet: string, at: Date): Promise<{ tokens: number; oldestEnd: string | null }> {
      const answer: Answer = await db.rpc('fleet_tokens_24h', { p_workspace: workspace, p_fleet: fleet, p_at: at.toISOString() });
      if (answer.error) throw new Error(`Supabase: could not read the fleet's spending (${answer.error.message})`);
      const row = orThrow(parseRows(SpentRowSchema, answer.data, `${WHERE}: fleet_tokens_24h`))[0];
      return { tokens: row?.tokens ?? 0, oldestEnd: row?.oldest_end ?? null };
    },

    /** The fleet's notebooks' lines that are not deleted, newest first (commander_notes, s4). */
    async notes(workspace: string, fleet: string): Promise<NoteRow[]> {
      const { data, error } = await db.from('commander_notes').select('id, notebook, mission_id, day, line, events, created_at')
        .eq('workspace_id', workspace).eq('fleet', fleet).is('deleted_at', null).order('created_at', { ascending: false }).limit(NOTES_READ);
      if (error) throw new Error(`Supabase: could not read the fleet's notebooks (${error.message})`);
      return orThrow(parseRows(NoteRowSchema, data, `${WHERE}: commander_notes`)).map((n) => ({
        id: n.id, notebook: n.notebook, mission: n.mission_id, day: n.day, line: n.line, events: n.events, createdAt: n.created_at,
      }));
    },

    /** Deletes a line as the signed-in member (commander_note_delete()): who deleted it and when. */
    async deleteNote(note: string): Promise<Written<Deleted>> {
      const answer: Answer = await db.rpc('commander_note_delete', { p_note: note });
      if (answer.error) return refusedBy(answer.error);
      const row = orThrow(parseRow(DeletedRowSchema, answer.data, `${WHERE}: commander_note_delete`));
      return { ok: true, value: { id: row.id, at: row.deleted_at, login: row.deleted_login } };
    },

    /** Records the message to the fleet as its author (commander_send()): it waits for the next job, and no job read it yet. */
    async send(workspace: string, fleet: string, text: string): Promise<Written<Message>> {
      const answer: Answer = await db.rpc('commander_send', { p_workspace: workspace, p_fleet: fleet, p_text: text });
      if (answer.error) return refusedBy(answer.error);
      return { ok: true, value: fleetMessageOf(orThrow(parseRow(FleetMessageRowSchema, answer.data, `${WHERE}: commander_send`)), []) };
    },

    /** Records the question as its asker (commander_ask()). */
    async ask(workspace: string, fleet: string, text: string): Promise<Written<Message>> {
      const answer: Answer = await db.rpc('commander_ask', { p_workspace: workspace, p_fleet: fleet, p_text: text });
      if (answer.error) return refusedBy(answer.error);
      return { ok: true, value: messageOf(orThrow(parseRow(MessageRowSchema, answer.data, `${WHERE}: commander_ask`))) };
    },
  };
}

export function commanderWriter(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** Adds the Commander's reply to a question of the fleet, with what its model calls counted. */
    async reply(input: { workspace: string; fleet: string; question: string; reply: Reply; tokens: number }): Promise<Message> {
      const { data, error } = await db.from('commander_messages')
        .insert({ workspace_id: input.workspace, fleet: input.fleet, kind: 'reply', reply_to: input.question, reply: input.reply, tokens: input.tokens })
        .select(MESSAGE_COLUMNS).single();
      if (error) throw new Error(`Supabase: could not keep the Commander's reply (${error.message})`);
      return messageOf(orThrow(parseRow(MessageRowSchema, data, `${WHERE}: commander_messages`)));
    },
  };
}

export type CommanderReader = ReturnType<typeof commanderReader>;
export type CommanderWriter = ReturnType<typeof commanderWriter>;
