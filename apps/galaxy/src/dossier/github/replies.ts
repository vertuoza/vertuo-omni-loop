// What the feature PR's comments say of the outbox (PRD 251, s9), for the Outbox tab: the outbox
// comment's numbering, and the answers nobody has settled yet. Pure, and it reads the comments with
// the kit's own reply reader (`planReplies`), so the tab shows exactly what `/omni:yolo-fix` will read:
// one answer per number, the latest winning, `approve all` covering what was listed before it.
//
// The kit counts only the replies of people GitHub lists as owner, member or collaborator. So the
// reader runs twice: once as the kit does, once as if every author counted. A number the first run
// answers shows that answer; a number only the second answers shows it too, marked as not counted,
// so the tab can say `/omni:yolo-fix` will not read it. Where an answer was given comes from the
// reply's door line (`_answered in the terminal · …`, `_answered on the Omni page · …`), else GitHub.
import { findPrMarkerComment, parseNumbersMarker } from 'vertuo-omni-plan/kit/lib/outbox/comment.ts';
import { planReplies } from 'vertuo-omni-plan/kit/lib/outbox/replies.ts';
import type { AnswerDoor, OutboxReplies, PendingAnswer } from './summary';

/** A comment of the feature PR, as GitHub lists it. */
export type PrComment = {
  id: number; html_url: string; body: string | null; created_at?: string; user?: { login: string } | null; author_association?: string;
};

/** The kit's markers, as `makeMarkers` builds them. */
type Markers = object;

/** An item as the kit's parser reads it; an adopted entry as the kit's ledger reader reads it. */
export type KitItem = { id: string; rank: string; sections: Record<string, unknown> };
export type KitAdopted = { id: string; itemText: string };

type Planned = { number: number; item: { id: string }; answer: { text: string; approvedBy: string; approvedAt: string; url?: string } };

/** The reply's door line, as the kit's reply writer ends every reply it writes. */
const DOOR_LINE = /^_answered (in the terminal|on the Omni page)\b/m;

function doorOf(body: string | null | undefined): AnswerDoor {
  const match = DOOR_LINE.exec(body ?? '');
  if (!match) return 'github';
  return match[1] === 'in the terminal' ? 'terminal' : 'page';
}

/** What the kit's reply reader decides: the answers it would settle and those it holds, by number. */
function answersOf(plan: unknown): Map<number, Planned> {
  const { settle, held } = plan as { settle: Planned[]; held: Planned[] };
  return new Map([...settle, ...held].map((p) => [p.number, p]));
}

export function outboxReplies({ comments, items, adopted, markers }: {
  comments: PrComment[]; items: KitItem[]; adopted: KitAdopted[]; markers: Markers;
}): OutboxReplies {
  const prComment = findPrMarkerComment(comments as { id: number; body?: string }[], markers) as PrComment | null;
  const numbering = (parseNumbersMarker(prComment?.body, markers) as { number: number; id: string }[])
    .map(({ number, id }) => ({ number, id }));
  const counted = answersOf(planReplies({ comments, items, adopted, markers }));
  // Every author counts here; a comment carrying an outbox marker is still never an answer.
  const everyone = comments.map((c) => ({ ...c, author_association: 'MEMBER' }));
  const anyone = answersOf(planReplies({ comments: everyone, items, adopted, markers }));
  const bodies = new Map(comments.map((c) => [c.html_url, c.body]));
  const pending = [...new Set([...counted.keys(), ...anyone.keys()])].sort((a, b) => a - b).map((number): PendingAnswer => {
    const kept = counted.get(number);
    const { item, answer } = kept ?? anyone.get(number)!;
    const url = answer.url ?? null;
    return {
      number, id: item.id, text: answer.text, by: answer.approvedBy, at: answer.approvedAt ?? null, url,
      counted: kept !== undefined, door: doorOf(url === null ? null : bodies.get(url)),
    };
  });
  return { numbering, pending };
}
