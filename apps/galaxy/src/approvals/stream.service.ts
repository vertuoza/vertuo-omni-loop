import type { Asking } from 'omni-loop/kit/lib/approval/stream.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Answer, ApprovalHistory, HistoryRepository } from './approvals.repository';

// The approval stream's rules (PRD 1322 s3, spec §4): a PRD's requests, approvals and voids, shaped into
// the events the kit reads (settled item s4-01-approval-stream-contract):
//
//   asked, re-asked   {asked: [{login, name}], nobodyElse, author, product}   a request, as its reply said
//   approved          {approver, approvedAt, pinned}                           an approval
//   voided            {pusher, kind, from, to}                                 a void
//
// The rows are append-only, so the PRD's whole history in time order is the stream: an event's id is
// its place in it (1, 2, 3…), the same on every connection, and `Last-Event-ID: n` resumes after the
// n-th. A connection with no id starts with the PRD as it stands: its latest request, then whatever
// came after that request or the latest void, whichever is later, so an approval a void ended is never
// replayed as if it held. Realtime only says "look again": every look re-reads the history and sends
// what is past the last event sent, so a missed notification costs a ping's delay, never an event.
//
// A Tech Approval's rows (PRD 2608) are events of their own, tech-asked {login}, tech-approved {login,
// approvedAt} and tech-voided {login, pusher, kind, from, to}, which an older kit ignores (it reads a name it
// does not know as nothing). So `asked`, `approved` and `voided` stay the product approval's: a tech
// approval never ends an older kit's wait, and a void of one never makes it ask the approvers again.

/** How often the stream says it is alive, and looks at the history again. */
export const PING_EVERY_MS = 15_000;

/** One event of the stream: its id, its name, its data. */
export type StreamEvent = { id: string; event: 'asked' | 're-asked' | 'approved' | 'voided' | 'tech-asked' | 'tech-approved' | 'tech-voided'; data: unknown };

/** An event before its id: when it happened (microseconds), and how it sorts at the same time. */
type Timed = { at: number; rank: number; key: string; event: StreamEvent['event']; data: unknown };

const ISO = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** A database time in microseconds since the epoch: a JavaScript date keeps only milliseconds, and two
 * rows of one transaction may differ by less. */
function micros(at: string): number {
  const match = ISO.exec(at);
  if (!match) return Date.parse(at) * 1000;
  const [, base, fraction = '', zone = 'Z'] = match;
  return Date.parse(`${base}${zone}`) * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6));
}

/** Each person's login (their player's GitHub login, lower case, else their id) and name. */
function peopleOf(history: ApprovalHistory) {
  const people = new Map(history.people.map((person) => [person.user, person]));
  return (user: string): { login: string; name: string | null } => {
    const person = people.get(user);
    return { login: person?.login?.toLowerCase() || user, name: person?.name?.trim() || null };
  };
}

/** The PRD's history as the stream's events, in time order, each id its place. */
export function eventsOf(history: ApprovalHistory): StreamEvent[] {
  const person = peopleOf(history);
  const kindOf = new Map(history.approvals.map((approval) => [approval.id, approval.kind]));
  const techRequests = history.requests.filter((request) => request.approvalKind === 'tech');
  const lastNamed = techRequests.reduce<(typeof techRequests)[number] | null>((latest, request) => (!latest || micros(request.askedAt) >= micros(latest.askedAt) ? request : latest), null);
  const named = lastNamed?.asked[0];
  const namedLogin = named === undefined ? null : person(named).login;
  const timed: Timed[] = [
    ...history.requests.map((request): Timed => {
      if (request.approvalKind === 'tech') {
        return { at: micros(request.askedAt), rank: 0, key: request.id, event: 'tech-asked', data: { login: person(request.asked[0] ?? request.askedBy).login } };
      }
      const asking: Asking = {
        asked: request.asked.map((user) => person(user)),
        nobodyElse: request.nobodyElse,
        author: person(history.author ?? request.askedBy).login,
        product: request.product,
      };
      return { at: micros(request.askedAt), rank: 0, key: request.id, event: request.kind, data: asking };
    }),
    ...history.approvals.map((approval): Timed => (approval.kind === 'tech'
      ? { at: micros(approval.approvedAt), rank: 1, key: approval.id, event: 'tech-approved', data: { login: namedLogin ?? approval.approver, approvedAt: approval.approvedAt } }
      : {
          at: micros(approval.approvedAt), rank: 1, key: approval.id, event: 'approved',
          data: { approver: approval.approver, approvedAt: approval.approvedAt, pinned: approval.pinned },
        })),
    ...history.voids.map((voided): Timed => {
      const change = { pusher: voided.pusher, kind: voided.kind, from: voided.from, to: voided.to };
      const at = micros(voided.voidedAt);
      return kindOf.get(voided.approval ?? '') === 'tech'
        ? { at, rank: 2, key: voided.id, event: 'tech-voided', data: { login: namedLogin ?? voided.pusher, ...change } }
        : { at, rank: 2, key: voided.id, event: 'voided', data: change };
    }),
  ];
  timed.sort((a, b) => a.at - b.at || a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return timed.map(({ event, data }, place) => ({ id: String(place + 1), event, data }));
}

/** A `Last-Event-ID` this history knows: the place of an event in it, or null. */
function placeOf(lastEventId: string | null, count: number): number | null {
  if (lastEventId === null || !/^\d{1,9}$/.test(lastEventId.trim())) return null;
  const place = Number(lastEventId.trim());
  return place <= count ? place : null;
}

/** What a connection starts with: the events after `Last-Event-ID`, or, with none it knows, the PRD
 * as it stands (its latest request, then what followed it or the latest void, whichever is later). */
export function startOf(events: StreamEvent[], lastEventId: string | null): StreamEvent[] {
  const place = placeOf(lastEventId, events.length);
  if (place !== null) return events.slice(place);
  const request = events.findLastIndex((e) => e.event === 'asked' || e.event === 're-asked');
  const voided = events.findLastIndex((e) => e.event === 'voided');
  if (request > voided) return events.slice(request);
  // A void came last (or nothing did): the latest request, then only what followed the void.
  return [...events.slice(request, request + 1), ...events.slice(voided + 1)];
}

/** A PRD's stream as one connection follows it: what it starts with, then what came since each look. */
export type Feed = {
  start: StreamEvent[];
  /** The events since the last look, re-reading the history; none when it could not be read. */
  next(): Promise<StreamEvent[]>;
  /** Calls `nudge` when a request, an approval or a void of this PRD lands; answers how to stop. */
  watch(nudge: () => void): Promise<() => void>;
};

/** Opens PRD `prd` of `repo`'s stream as the caller: its feed, null when the caller reads no such PRD,
 * or the database's refusal. */
export async function openFeed(
  history: HistoryRepository,
  repo: string,
  prd: PrdNumber,
  lastEventId: string | null,
  log: (line: string) => void,
): Promise<Answer<Feed | null>> {
  const first = await history.read(repo, prd);
  if (!first.ok) return first;
  if (!first.value) return { ok: true, value: null };
  const { dossier } = first.value;
  const events = eventsOf(first.value);
  let sent = events.length;
  let looking: Promise<StreamEvent[]> = Promise.resolve([]);
  const look = async (): Promise<StreamEvent[]> => {
    const read = await history.read(repo, prd);
    if (!read.ok || !read.value) {
      log(`approvals: the stream of ${repo} #${prd} could not read its history: ${read.ok ? 'the PRD is gone' : (read.refusal.message ?? read.refusal.code ?? 'the database failed')}`);
      return [];
    }
    const now = eventsOf(read.value);
    const fresh = now.slice(sent);
    sent = now.length;
    return fresh;
  };
  return {
    ok: true,
    value: {
      start: startOf(events, lastEventId),
      next() {
        // One look at a time, so two nudges never send the same event twice.
        looking = looking.then(look, look);
        return looking;
      },
      watch: (nudge) => history.watch(dossier, nudge),
    },
  };
}
