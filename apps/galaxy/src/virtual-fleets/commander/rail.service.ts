import type { Card, CardAnswerRequest, CommanderRefusalKind } from './commander.contract';
import type { RailReader } from './rail.repository';
import { activeRepos, answerable, cardsOf, ITEM_CHOICES, RAIL_WORDS } from './rail';

// The rail's rules over its reads (PRD 3107 s2; ADR-0095). The cards are read from their questions' own records each
// time, never from the model, so the rail needs no model key and no tokens (AC-13, AC-16). A member's answer is checked
// again against the record first: a card answered elsewhere is never answered twice and comes back as it stands (AC-12);
// a choice that is not the card's own is refused. Then it is sent through that question's own answer route, as the
// member (the live wiring calls the route's controller with their sign-in), so the record names them as it would on the
// question's page (AC-4, BR-PRODUCT-12): the Commander never picks a choice and writes no answer of its own. A route
// that refused leaves the card open and says `Not sent: try again.`; one that was beaten to it reads the other answer.

type RailServed<T> = { ok: true; value: T } | { ok: false; kind: CommanderRefusalKind; error: string; card?: Card; cause?: string };

/** The answer routes, called as the signed-in member: true when the route kept the answer. */
export interface CardAnswerers {
  /** POST /api/runners/jobs/<id>/answers {answers}. */
  job(id: string, answers: Record<string, string>): Promise<boolean>;
  /** POST /api/missions/items/<item> {answer}. */
  item(id: string, answer: 'adopted' | 'declined'): Promise<boolean>;
}

export interface RailServiceDeps {
  reader: Pick<RailReader, 'missions' | 'jobQuestions' | 'items' | 'outbox' | 'approvals' | 'logins'>;
  /** The answer routes, or null where they cannot run (no database). */
  answerers: CardAnswerers | null;
  now: () => Date;
}

const NOT_THIS_FLEET = 'This question is not one of this fleet’s.';
const NOT_A_CHOICE = 'Pick one of the card’s own choices.';
const ANSWERED = 'This question was answered already.';
const NOT_HERE = 'Questions are not answered here: this deployment has no database.';

type Refused = Extract<RailServed<never>, { ok: false }>;

/** The card, when it can take this choice now; otherwise why not: none of this fleet's, answered already, or a choice that is not its own. */
function openCard(card: Card | undefined, choice: string): { ok: true; card: Card } | Refused {
  if (card === undefined) return { ok: false, kind: 'missing', error: NOT_THIS_FLEET };
  if (card.answered !== null) return { ok: false, kind: 'answered', error: ANSWERED, card };
  if (!answerable(card) || !card.choices.includes(choice)) return { ok: false, kind: 'invalid', error: NOT_A_CHOICE, card };
  return { ok: true, card };
}

/** What a sent choice gives: the card as its record now reads, or as answered by this member when the record lags; a route
 * that refused gives the answer someone else gave, or `Not sent: try again.` with the card left open. */
function outcome(before: Card, after: Card | undefined, sent: boolean, mine: NonNullable<Card['answered']>): RailServed<Card> {
  const stands = after ?? before;
  if (sent) return { ok: true, value: stands.answered === null ? { ...before, answered: mine } : stands };
  return stands.answered === null ? { ok: false, kind: 'not-sent', error: RAIL_WORDS.notSent, card: stands } : { ok: false, kind: 'answered', error: ANSWERED, card: stands };
}

/** Sends the choice through the card's own route: whether the route kept it. */
async function send(answerers: CardAnswerers, card: Card, choice: string): Promise<boolean> {
  if (card.source === 'job') return answerers.job(card.id, { [card.question]: choice });
  const item = ITEM_CHOICES[choice];
  return item !== undefined && answerers.item(card.id, item);
}

export function railService(deps: RailServiceDeps) {
  const { reader } = deps;

  /** The fleet's cards, read now from their records. */
  async function cards(workspace: string, fleet: string): Promise<Card[]> {
    const missions = await reader.missions(workspace, fleet);
    const ids = missions.map((m) => m.id);
    const [jobs, items, outbox, approvals] = await Promise.all([
      reader.jobQuestions(workspace, ids),
      reader.items(ids),
      reader.outbox(workspace, activeRepos(missions)),
      reader.approvals(),
    ]);
    const people = [...new Set([...jobs.map((j) => j.closedBy), ...items.map((i) => i.answeredBy)].filter((p) => p !== null))];
    const logins = await reader.logins(workspace, people);
    return cardsOf({ fleet, missions, jobs, items, outbox, approvals, logins }, deps.now());
  }

  const find = async (request: CardAnswerRequest): Promise<Card | undefined> =>
    (await cards(request.workspace, request.fleet)).find((c) => c.source === request.source && c.id === request.id);

  return {
    cards,

    /** A member's choice on a card, sent through its question's own route as them; the card as it then stands. */
    async answer(request: CardAnswerRequest, me: string | null): Promise<RailServed<Card>> {
      const open = openCard(await find(request), request.choice);
      if (!open.ok) return open;
      if (deps.answerers === null) return { ok: false, kind: 'unavailable', error: NOT_HERE };
      const sent = await send(deps.answerers, open.card, request.choice);
      return outcome(open.card, await find(request), sent, { login: me ?? RAIL_WORDS.someone, at: deps.now().toISOString(), choice: request.choice });
    },
  };
}

export type RailService = ReturnType<typeof railService>;
