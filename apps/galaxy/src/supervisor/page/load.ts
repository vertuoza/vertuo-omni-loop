import { log } from 'omni-loop/kit/lib/log/log.ts';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { Finding, Message, Note, Seat } from '../api/supervisor.contract';
import type { Served } from '../api/supervisor.service';
import { openFinding, type SeatRunner, type SupervisorPageView } from './model';

// The Supervisor page's read (PRD omni-loop-34 s5): the workspace the person joined first, as every board page heads its
// own; with none, the no-workspace notice. Then, through the Supervisor API's service (its rules: a member only), the
// person's role, the seat, the open and the done findings and the general thread, in parallel; the open finding's
// thread once the address names one of them. The seat's runner (its name and slots) and an owner's count of notes fail
// soft: the header then names no runner, and Memory counts none. The reads are a port so the loader is tested on fakes;
// ./live.ts is the page's.

export interface SupervisorPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<{ id: string } | null>;
  /** Whether the person is an owner of it; refused for anyone not a member. */
  role(workspace: string): Promise<Served<{ owner: boolean }>>;
  seat(workspace: string): Promise<Served<Seat | null>>;
  findings(workspace: string, open: boolean): Promise<Served<Finding[]>>;
  /** A thread, oldest first: the general one with no finding. */
  messages(workspace: string, finding: string | null): Promise<Served<Message[]>>;
  notes(workspace: string): Promise<Served<Note[]>>;
  /** The runner that holds the seat, by id; null when it cannot be read. */
  runner(id: string): Promise<SeatRunner | null>;
}

const failed = (message: string) => { log.error({ event: 'supervisor-page', outcome: 'failed', message }); };

class Unread extends Error {}

const value = <T>(served: Served<T>, what: string): T => {
  if (served.ok) return served.value;
  throw new Unread(`${what} could not be read (${served.error})`);
};

async function soft<T>(read: () => Promise<T>, fallback: T, what: string): Promise<T> {
  try {
    return await read();
  } catch (error) {
    failed(`${what} could not be read (${messageOf(error)})`);
    return fallback;
  }
}

export async function loadSupervisorPage(reads: SupervisorPageReads, findingId: string | null, now: Date): Promise<SupervisorPageView> {
  try {
    const workspace = await reads.workspace();
    if (!workspace) return { kind: 'no-workspace' };
    const id = workspace.id;
    const { owner } = value(await reads.role(id), 'the role');
    const [seat, open, done, chat] = await Promise.all([
      reads.seat(id).then((s) => value(s, 'the seat')), reads.findings(id, true).then((s) => value(s, 'the open findings')),
      reads.findings(id, false).then((s) => value(s, 'the done findings')), reads.messages(id, null).then((s) => value(s, 'the chat')),
    ]);
    const opened = openFinding({ open, done }, findingId);
    const [thread, runner, notes] = await Promise.all([
      opened ? reads.messages(id, opened.id).then((s) => value(s, 'the finding\'s thread')) : Promise.resolve([]),
      seat ? soft(() => reads.runner(seat.runner), null, 'the seat\'s runner') : Promise.resolve(null),
      owner ? soft(async () => value(await reads.notes(id), 'the notes').length, 0, 'the notes') : Promise.resolve(0),
    ]);
    return { kind: 'page', workspace: id, owner, seat, runner, open, done, chat, thread, notes, now: now.toISOString() };
  } catch (error) {
    failed(error instanceof Unread ? error.message : `the page could not be read (${messageOf(error)})`);
    return { kind: 'unreadable' };
  }
}
