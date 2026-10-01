// @ts-nocheck
/**
 * **The kit's fallback intros and punchlines** (PRD #50, slice s2).
 *
 * Every open or adopted question in the pull request's outbox comment shows an intro under its
 * heading and a punchline after the question. The agent that raised the item writes both (the
 * item's `## The intro, for fun` and `## The punchline, for fun`); this pool fills in for an item
 * without them — one raised before PRD #50, or an adopted entry whose embedded item predates it
 * (the settled ledger is append-only, so those never gain the sections).
 *
 * **Which line a question takes never moves.** {@link assignBanter} serves ids in the order it is
 * given — the comment hands them over in question-number order — and each takes the line its id
 * hashes to ({@link stableHash}), or, when an earlier id in the same call already took that line,
 * the next one along nobody has taken yet. Two calls with the same ids give the same lines, and an
 * id added at the end never changes an earlier one's. Once every line is taken, the taken set
 * starts over, so a question past the end of the pool still gets a line.
 *
 * **What a pool line may say** is what an agent's line may say (`outbox.mjs`'s `funLineProblems`:
 * plain words, 120 characters at most), about a question or its situation, never about a person or
 * a team, and never mocking whoever answers. Unlike an agent's line, it never names the game played
 * on top of delivery: the kit never mentions it. `banter.test.mjs` holds the pool to all of it.
 *
 * **One named exception, outside this pool** (PRD #99): OmniMan is the loop's signing identity —
 * the `signature` config default (`kit/lib/config.ts`, `kit/lib/signature.ts`) — and the face of
 * the omni-loop GitHub App, both on the delivery side, so the kit names him there. The pool keeps
 * the rule: no line here names him or anything else of the game.
 *
 * Pure: no filesystem, no network, no clock.
 */

/** The lines a question's intro is drawn from, when its item carries none. */
const INTROS = Object.freeze([
  'Here is a small question with surprisingly strong opinions.',
  'This one looked simple right up until it did not.',
  'The spec went quiet here, which is rare and a little suspicious.',
  'A question walks into a pull request and politely asks for a minute.',
  'Two sensible ideas met in this change, and only one could stay.',
  'Not every decision is dramatic, but this one did try its best.',
  'This question has been rehearsing its big moment all week.',
  'The kind of question that sounds easy until it is asked out loud.',
  'Found in the margin of the spec, next to a very small question mark.',
  'The build kept going and left this question behind like a bookmark.',
  'Nothing is on fire; this is simply a question with good manners.',
  'One more choice, gift-wrapped and labelled with care.',
  'Fresh from the workshop, and still warm from the build.',
  'Some questions knock politely, and this is one of them.',
  'This decision was made in pencil, on purpose.',
  'Behind every tidy change sits a judgement call, and here it is.',
  'A crossroads so small it barely needed a sign, so here is the sign.',
  'Every plan has a gap somewhere, and this one found a very tidy gap.',
  'Plot twist: the easy part had a question hiding in it.',
  'Here is a question that deserves better than a shrug.',
  'A decision was made, and it would like to be introduced properly.',
  'Somewhere between two good ideas, a choice had to be made.',
  'Presenting a question that kept its promise to stay short.',
  'The agent paused here, picked a path, and left a note on the door.',
  'Every piece of work leaves one crumb of doubt, and this is the crumb.',
  'A fork in the road, freshly swept and ready for visitors.',
  'This question was found hiding behind a perfectly reasonable assumption.',
  "Today's small mystery comes with a clue and a best guess.",
]);

/** The lines a question's punchline is drawn from, when its item carries none. Each reads well
 * before options, before the steps a person must take, and before an older decision line alike. */
const PUNCHLINES = Object.freeze([
  'Nothing here is carved in stone, only lightly pencilled.',
  'The good news is that every pencil comes with an eraser.',
  'No wrong answers here, only reversible ones.',
  'Changing course later costs a little, not a lot.',
  'The agent has a hunch, and hunches love a second opinion.',
  'Quick to read, and oddly satisfying to settle.',
  'It sounds bigger than it is, like most things before lunch.',
  'The work did not wait, but it did leave a light on.',
  'Every settled question makes the next build a little calmer.',
  'Settling it takes a minute, and the minute is well spent.',
  'It is easier to answer than it was to ask.',
  'Answers of every size are welcome here.',
  'Nothing breaks while it waits; it just waits a little hopefully.',
  'A calm answer now saves a long thread later.',
  'One small answer, many quieter tomorrows.',
  'Nothing dramatic, just a small signpost waiting for its arrow.',
  'Sometimes the sensible choice and the fun choice are the same one.',
  'It is only a question, but it has been very well behaved.',
  'The code carries on meanwhile; it just likes to be sure.',
  'Half the fun of a question is watching it turn into a decision.',
  'Best of all, the answer fits on one line.',
  'The worst case is a small rework, and small reworks are friendly.',
  'Clarity is cheap today and pricey next month.',
  'The question is short, and the peace of mind lasts much longer.',
  'Somewhere, a future bug just got a little nervous.',
  'Every question answered is one less surprise at release time.',
  'A good question ages like milk, so this one is served fresh.',
  'Small print, big relief once it is settled.',
]);

/** The kit's pool: `{ intros, punchlines }`. */
export const BANTER_POOL = Object.freeze({ intros: INTROS, punchlines: PUNCHLINES });

/**
 * 32-bit FNV-1a over `text`'s UTF-8 bytes: the same number for the same text on every run, machine
 * and Node version, so the line an id hashes to never moves.
 *
 * @param {string} text
 * @returns {number} an unsigned 32-bit integer
 */
export function stableHash(text) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * One line of `lines` for each of `ids`, served in order: the line `salt:<id>` hashes to, or the
 * next one along no earlier id took. Once every line is taken, the taken set starts over.
 *
 * @param {string[]} ids
 * @param {readonly string[]} lines
 * @param {string} salt keeps an id's intro and punchline from always sharing an index
 * @returns {Map<string, string>}
 */
function serveLines(ids, lines, salt) {
  const taken = new Set();
  const served = new Map();
  for (const id of ids) {
    if (taken.size === lines.length) taken.clear();
    let index = stableHash(`${salt}:${id}`) % lines.length;
    while (taken.has(index)) index = (index + 1) % lines.length;
    taken.add(index);
    served.set(id, lines[index]);
  }
  return served;
}

/**
 * An intro and a punchline from `pool` for each of `ids`, served in the order given — the caller
 * passes them in question-number order (see the module doc). Pure.
 *
 * @param {string[]} ids
 * @param {{ pool?: { intros: readonly string[], punchlines: readonly string[] } }} [options]
 * @returns {Map<string, { intro: string, punchline: string }>}
 */
export function assignBanter(ids, { pool = BANTER_POOL } = {}) {
  const intros = serveLines(ids, pool.intros, 'intro');
  const punchlines = serveLines(ids, pool.punchlines, 'punchline');
  return new Map(ids.map((id) => [id, { intro: intros.get(id), punchline: punchlines.get(id) }]));
}
