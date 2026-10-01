// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/picks.ts (PRD 251, s9); a card the
// outbox comment has not numbered yet offers nothing to pick.
//
// The person's picks on the Outbox tab (PRD 251, "The Outbox tab"): a letter on a decision, done or not
// done on a human action, another letter on an adopted medium (an objection), each with an optional
// reason — which not done needs. Pure, and safe in the browser: the tab's client code imports it.
//
// Select every recommendation picks A on every open decision and nothing else: it never marks a human
// action done, and never objects to an adopted medium — a person's check is never ticked for them, and
// the person still sends (the spec's Decision 10). Picks survive a reload through the browser's storage,
// a convenience only: what comes back is read defensively, and a pick on a question the tab no longer
// shows is dropped.

export type Pick = { pick: string; reason: string };
/** By question number. */
export type Picks = Record<number, Pick>;

/** What a question offers to pick. */
export type Pickable = { number: number; kind: 'decision' | 'action'; adopted: boolean; letters: string[] };

/** Where a dossier's picks are kept in the browser. */
export const picksKey = (dossierId: string) => `omni-outbox-picks:${dossierId}`;

export function pickable(cards: Array<{ number: number | null; kind: 'decision' | 'action'; adopted: boolean; options: Array<{ letter: string }> }>): Pickable[] {
  return cards.flatMap(({ number, kind, adopted, options }) => (number === null ? [] : [{ number, kind, adopted, letters: options.map((o) => o.letter) }]));
}

/** Whether `pick` answers `question`: a letter it offers (another than A when adopted), done, or not
 * done with a reason. */
export function isAnswer(question: Pickable, pick: Pick | undefined): boolean {
  if (!pick) return false;
  if (question.kind === 'action') return pick.pick === 'done' || (pick.pick === 'not-done' && pick.reason.trim() !== '');
  if (!question.letters.includes(pick.pick)) return false;
  return !question.adopted || pick.pick !== 'A';
}

/** How many questions the picks answer: the `n` of Send n answers. */
export function answered(questions: Pickable[], picks: Picks): number {
  return questions.filter((q) => isAnswer(q, picks[q.number])).length;
}

/** A on every open decision that offers it; every other pick as it was. */
export function recommend(questions: Pickable[], picks: Picks): Picks {
  const next: Picks = { ...picks };
  for (const q of questions) {
    if (q.kind !== 'decision' || q.adopted || !q.letters.includes('A')) continue;
    next[q.number] = picks[q.number]?.pick === 'A' ? picks[q.number]! : { pick: 'A', reason: '' };
  }
  return next;
}

/** Only the picks on questions still shown. */
export function keepKnown(questions: Pickable[], picks: Picks): Picks {
  const known = new Set(questions.map((q) => q.number));
  return Object.fromEntries(Object.entries(picks).filter(([number]) => known.has(Number(number))));
}

/** Picks as the browser kept them; anything malformed is dropped. */
export function readPicks(stored: string | null): Picks {
  let data: unknown;
  try {
    data = JSON.parse(stored ?? '');
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const picks: Picks = {};
  for (const [number, value] of Object.entries(data as Record<string, unknown>)) {
    const n = Number(number);
    const v = value as Partial<Pick> | null;
    if (!Number.isInteger(n) || n < 1 || !v || typeof v !== 'object' || typeof v.pick !== 'string') continue;
    picks[n] = { pick: v.pick, reason: typeof v.reason === 'string' ? v.reason : '' };
  }
  return picks;
}

/** What Send posts: each pick that answers its question, in number order, with its reason when given. */
export function answers(questions: Pickable[], picks: Picks): Array<{ number: number; pick: string; reason?: string }> {
  return questions
    .filter((q) => isAnswer(q, picks[q.number]))
    .sort((a, b) => a.number - b.number)
    .map(({ number }) => {
      const { pick, reason } = picks[number]!;
      return reason.trim() ? { number, pick, reason } : { number, pick };
    });
}

/** The picks without those on questions settled meanwhile. */
export function dropPicks(picks: Picks, numbers: number[]): Picks {
  return Object.fromEntries(Object.entries(picks).filter(([number]) => !numbers.includes(Number(number))));
}
