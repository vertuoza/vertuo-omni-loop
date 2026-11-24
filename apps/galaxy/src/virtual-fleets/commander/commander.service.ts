import type { AskAnswer, AskRequest, SendRequest, Card, CardAnswerRequest, CommanderRefusalKind, CommanderState, CommanderView, Deleted, Message, NoteDeleteRequest, ViewQuery } from './commander.contract';
import type { CommanderReader, CommanderWriter, Written } from './commander.repository';
import {
  ACTIVE, EVENTS_PER_MISSION, inRecord, keepClaims, moreEvents, notebooksOf, OLDER_EVENTS_TOOL, readModelReply, stateOf, suggestionsOf, SYSTEM, THREAD_MESSAGES,
  turnOf, WORDS, usedUpWords, type EventRow, type FleetRecord, type MissionRow, type Turn,
} from './commander';
import type { CommanderModel } from './model';
import type { RailService } from './rail.service';

// The Commander's rules (PRD 3107 s1; ADR-0095), over the reader as the signed-in person and the writer as the service
// role. Opening the tab reads the fleet's state (off with no model key, used up once its daily cap is reached), the
// status line, the thread and the first visit's questions. Asking checks the fleet and the state first, so with no key or
// no tokens left no model call is made and nothing is written; then records the question as its asker, reads this
// fleet's record alone (the workspace and the fleet named on every read), asks the model at most 3 tool rounds, keeps the
// claims whose every reference was in the turn, and writes the reply, signed by no person, with what it counted.
// The tab also carries the Waiting on you rail's cards (s2), read whatever the state, and a member's answer from a card
// is checked against the fleet first, then left to the rail (rail.service.ts): no model is ever asked about a card.
// The tab carries the fleet's two notebooks too (s4), and a question reads the fleet notebook's last 50 lines that are not
// deleted and the last lines of each mission it reads; a member deletes a line as themselves, and it leaves the record.

type Served<T> = { ok: true; value: T } | { ok: false; kind: CommanderRefusalKind; error: string; question?: Message; state?: CommanderState; card?: Card; cause?: string };

export const ONLY_MEMBERS = 'Only a member of the workspace reads its fleet’s Commander.';
export const NOT_VIRTUAL = 'Fleet: only an AI Fleet has a Commander.';
const NOT_HERE = 'The Commander is not available here: this deployment cannot keep its replies.';
const FAILED = 'The Commander could not answer. Try again.';
const ONLY_MEMBERS_MESSAGE = 'Only a member of the workspace messages its fleet.';
const NOT_SENT = 'Not sent: try again.';
const ONLY_MEMBERS_NOTE = 'Only a member of the workspace deletes a line of its notebooks.';
const NO_NOTE = 'Note: no such line in this fleet\u2019s notebooks.';
const NOT_DELETED = 'Not deleted: try again.';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The most messages the tab shows. */
const SHOWN = 50;
/** The events of each mission the first visit's questions read. */
const SUGGESTION_EVENTS = 20;

export interface CommanderServiceDeps {
  reader: Pick<CommanderReader, 'fleet' | 'missions' | 'events' | 'jobs' | 'thread' | 'fleetMessages' | 'spent' | 'ask' | 'send' | 'notes' | 'deleteNote'>;
  /** The service role's writer, or null when this deployment has none. */
  writer: Pick<CommanderWriter, 'reply'> | null;
  /** The model, or null when the server has no key. */
  model: CommanderModel | null;
  /** The Waiting on you rail (s2): its cards, and a member's answer from one. It needs no model. */
  rail: Pick<RailService, 'cards' | 'answer'>;
  /** The signed-in member's GitHub login, or null when their sign-in carries none. */
  me: string | null;
  now: () => Date;
}

type Refused = Extract<Written<unknown>, { ok: false }>;

/** A refused ask in its words; anything unforeseen is a failure, its words kept for the log only. */
function refusal({ code, message }: Refused): Served<never> {
  if (code === '42501') return { ok: false, kind: 'forbidden', error: ONLY_MEMBERS };
  if (code === '22023' && message) return { ok: false, kind: 'invalid', error: message };
  return { ok: false, kind: 'database', error: FAILED, cause: `${code ?? 'no code'}: ${message}` };
}

export function commanderService(deps: CommanderServiceDeps) {
  const { reader } = deps;

  /** The fleet, when the person may read its Commander: a member, on an AI Fleet. */
  async function fleetOf(query: ViewQuery): Promise<Served<{ cap: number | null }>> {
    const fleet = await reader.fleet(query.workspace, query.fleet);
    if (fleet === null) return { ok: false, kind: 'forbidden', error: ONLY_MEMBERS };
    if (!fleet.virtual) return { ok: false, kind: 'invalid', error: NOT_VIRTUAL };
    return { ok: true, value: { cap: fleet.cap } };
  }

  /** Whether the Commander answers now, and what the fleet spent. */
  async function stateNow(query: ViewQuery, cap: number | null, now: Date): Promise<{ state: CommanderState; spent: number }> {
    const spent = await reader.spent(query.workspace, query.fleet, now);
    return { state: stateOf({ modelOn: deps.model !== null, cap, spent: spent.tokens, oldestEnd: spent.oldestEnd, now }), spent: spent.tokens };
  }

  /** The events of each of these missions, newest first. */
  async function eventsOf(missions: readonly MissionRow[], limit: number): Promise<EventRow[]> {
    const read = await Promise.all(missions.map((m) => reader.events(m.id, limit)));
    return read.flat().sort((a, b) => b.at.localeCompare(a.at));
  }

  /** The model and the writer, when the Commander may answer this question now: a member, an AI Fleet, a key, tokens left. */
  async function readyFor(request: AskRequest, now: Date): Promise<Served<{ model: CommanderModel; writer: Pick<CommanderWriter, 'reply'> }>> {
    const fleet = await fleetOf(request);
    if (!fleet.ok) return fleet;
    const { state } = await stateNow(request, fleet.value.cap, now);
    if (state.kind === 'off') return { ok: false, kind: 'off', error: WORDS.off, state };
    if (state.kind === 'used-up') return { ok: false, kind: 'used-up', error: usedUpWords(state.backAt), state };
    const { model, writer } = deps;
    return model === null || writer === null ? { ok: false, kind: 'unavailable', error: NOT_HERE } : { ok: true, value: { model, writer } };
  }

  /** The turn of a question over this fleet's record alone, and the oldest event read of each mission. */
  async function turnFor(request: AskRequest, thread: Message[], now: Date): Promise<{ turn: Turn; oldest: Map<string, string> }> {
    const missions = inRecord(await reader.missions(request.workspace, request.fleet), now);
    const [events, jobs, notes] = await Promise.all([
      eventsOf(missions, EVENTS_PER_MISSION),
      reader.jobs(request.workspace, missions.map((m) => m.id), new Date(now.getTime() - DAY_MS)),
      reader.notes(request.workspace, request.fleet),
    ]);
    const record: FleetRecord = { fleet: request.fleet, missions, events, jobs, thread, notes };
    const oldest = new Map<string, string>();
    for (const e of events) oldest.set(e.mission, e.at);
    return { turn: turnOf(record, request.text), oldest };
  }

  /** The tool that reads older events: of a mission of the turn alone, before the oldest one already read. */
  function olderEvents(turn: Turn, oldest: Map<string, string>) {
    return async (name: string, args: unknown): Promise<string> => {
      const ref = typeof args === 'object' && args !== null && 'mission' in args && typeof args.mission === 'string' ? args.mission : '';
      const mission = turn.missions.get(ref);
      if (name !== OLDER_EVENTS_TOOL.function.name || !mission) return `No mission ${ref} in this fleet's record.`;
      const older = await reader.events(mission.id, EVENTS_PER_MISSION, oldest.get(mission.id) ?? null);
      const last = older.at(-1);
      if (last) oldest.set(mission.id, last.at);
      return moreEvents(turn, ref, older);
    };
  }

  return {
    /** The tab as it opens. */
    async view(query: ViewQuery): Promise<Served<CommanderView>> {
      const now = deps.now();
      const fleet = await fleetOf(query);
      if (!fleet.ok) return fleet;
      const missions = await reader.missions(query.workspace, query.fleet);
      const active = missions.filter((m) => ACTIVE.includes(m.status));
      const record = inRecord(missions, now);
      const [{ state, spent }, asked, told, events, jobs, cards, notes] = await Promise.all([
        stateNow(query, fleet.value.cap, now),
        reader.thread(query.workspace, query.fleet, SHOWN),
        reader.fleetMessages(query.workspace, query.fleet, SHOWN),
        eventsOf(active, SUGGESTION_EVENTS),
        reader.jobs(query.workspace, record.map((m) => m.id), new Date(now.getTime() - DAY_MS)),
        deps.rail.cards(query.workspace, query.fleet),
        reader.notes(query.workspace, query.fleet),
      ]);
      // The Commander's questions and replies and the messages to the fleet, one thread by time, the last SHOWN of it.
      const messages = [...asked, ...told].sort((a, b) => a.at.localeCompare(b.at)).slice(-SHOWN);
      const count = (status: string) => missions.filter((m) => m.status === status).length;
      return {
        ok: true,
        value: {
          workspace: query.workspace,
          fleet: query.fleet,
          state,
          status: { running: count('running'), waiting: count('waiting'), paused: count('paused'), spent, cap: fleet.value.cap },
          messages,
          suggestions: suggestionsOf(events),
          reading: { missions: record.length, jobs: jobs.length },
          cards,
          notebooks: notebooksOf(query.fleet, notes, missions),
          me: deps.me,
        },
      };
    },

    /** A member's choice on a card of the rail, sent through its question's own route as them (s2): the card as it then stands. */
    async answer(request: CardAnswerRequest): Promise<Served<Card>> {
      const fleet = await fleetOf(request);
      if (!fleet.ok) return fleet;
      return deps.rail.answer(request, deps.me);
    },

    /** A member's message to the fleet's agents (s3): stored signed by them and tagged for the fleet, a `messaged` event linking to
     * it in each running mission. It needs no model, so the Commander being off or out of tokens changes nothing. */
    async send(request: SendRequest): Promise<Served<Message>> {
      const fleet = await fleetOf(request);
      if (!fleet.ok) return fleet;
      const sent = await reader.send(request.workspace, request.fleet, request.text);
      if (sent.ok) return sent;
      if (sent.code === '42501') return { ok: false, kind: 'forbidden', error: ONLY_MEMBERS_MESSAGE };
      if (sent.code === '22023' && sent.message) return { ok: false, kind: 'invalid', error: sent.message };
      return { ok: false, kind: 'not-sent', error: NOT_SENT, cause: `${sent.code ?? 'no code'}: ${sent.message}` };
    },

    /** A member deletes a line of the fleet's notebooks, as themselves (s4): who deleted it and when. It needs no model. */
    async deleteNote(request: NoteDeleteRequest): Promise<Served<Deleted>> {
      const fleet = await fleetOf(request);
      if (!fleet.ok) return fleet;
      const notes = await reader.notes(request.workspace, request.fleet);
      if (!notes.some((note) => note.id === request.note)) return { ok: false, kind: 'missing', error: NO_NOTE };
      const deleted = await reader.deleteNote(request.note);
      if (deleted.ok) return deleted;
      if (deleted.code === '42501') return { ok: false, kind: 'forbidden', error: ONLY_MEMBERS_NOTE };
      if (deleted.code === '22023') return { ok: false, kind: 'missing', error: NO_NOTE };
      return { ok: false, kind: 'database', error: NOT_DELETED, cause: `${deleted.code ?? 'no code'}: ${deleted.message}` };
    },

    /** A member's question and the Commander's reply. */
    async ask(request: AskRequest): Promise<Served<AskAnswer>> {
      const now = deps.now();
      const ready = await readyFor(request, now);
      if (!ready.ok) return ready;
      const { model, writer } = ready.value;
      const thread = await reader.thread(request.workspace, request.fleet, THREAD_MESSAGES);
      const asked = await reader.ask(request.workspace, request.fleet, request.text);
      if (!asked.ok) return refusal(asked);
      const question = asked.value;
      const { turn, oldest } = await turnFor(request, thread, now);
      const answer = await model({ system: SYSTEM, data: turn.data, tools: [OLDER_EVENTS_TOOL], runTool: olderEvents(turn, oldest) });
      const read = answer.ok ? readModelReply(answer.content) : null;
      if (read === null) return { ok: false, kind: 'no-answer', error: WORDS.noAnswer, question, cause: answer.ok ? 'the model wrote no reply of its shape' : answer.why };
      const reply = await writer.reply({ workspace: request.workspace, fleet: request.fleet, question: question.id, reply: { ...keepClaims(read, turn.refs), read: turn.read }, tokens: answer.tokens });
      return { ok: true, value: { question, reply } };
    },
  };
}

export type CommanderService = ReturnType<typeof commanderService>;
