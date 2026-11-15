// The one table of plain words of a work's status (PRD 2906's spec, "One table of plain words"): every
// step's name, every verdict sentence, every You and Next line, and each technical word with its
// explanation. Every status anyone sees draws its words from here; `steps.ts` picks the lines and
// `render.ts` lays them out.
//
// - **A technical word** is written `[[word]]` in a line of this table. A block explains it the first
//   time it appears, as `word (its explanation)`, and prints it plain after (`explainer()`); the JSON
//   answer prints it plain (`plain()`). The loop's own words (branch, slice, sub-PR, outbox, wave, CI)
//   are never written here: the plain words say what they mean.
// - **A step** has its `name` (the spec's table of steps), its `short` name for the step line, the
//   verdict `sentence` said while the work is at it, its **You** line, whether that line asks the
//   person something (`asks`: the verdict then reads `Waiting for you`), and one or two **Next** items.
// - **`{name}`** in a line is filled from the work's facts (`fill()`).

/** The kinds of work a status is told for, in the glossary's words. */
export type StatusKind = 'prd' | 'bug' | 'visual';

/** The technical words a block explains, the first time each appears. */
export const TERMS = Object.freeze({
  'pull request': 'where the change is reviewed, then merged by you',
  checks: 'the tests GitHub runs on every change',
  draft: 'not yet asked for review',
  merge: 'accept the change into the product',
  PRD: 'the written plan of a feature',
});

/** A technical word of `TERMS`. */
export type Term = keyof typeof TERMS;

/** The work's kind, as the work line names it. */
export const KIND_NAMES: Readonly<Record<StatusKind, string>> = Object.freeze({ prd: '[[PRD]]', bug: 'Bug fix', visual: 'Visual update' });

/** The label of the work's Omni page link. */
export const PAGE_LABELS: Readonly<Record<StatusKind, string>> = Object.freeze({ prd: 'PRD page', bug: 'Bug page', visual: 'Visual update page' });

/** The labels of the other links, and the pull request's explanation's term. */
export const LINK_LABELS = Object.freeze({ issue: 'GitHub issue', pullRequest: 'Pull request' });

/** The verdict's levels, and the label each step's sentence is said under. */
export type StatusLevel = 'on-track' | 'waiting' | 'stuck';
export const LEVEL_LABELS = Object.freeze({ 'on-track': '🟢 On track', waiting: '🟡 Waiting for you' });

/** The stuck verdicts the facts say over any step, each with its own Next: a closed pull request, failed checks, a stuck part. */
export const VERDICTS = Object.freeze({
  closed: { label: '🔴 Stopped', sentence: 'the [[pull request]] was closed without merging', next: ['nothing more happens unless the [[pull request]] is reopened'] },
  failed: { label: '🔴 Stuck', sentence: '{failed} of the [[checks]] failed', next: ['I look at why the [[checks]] failed, and fix it'] },
  stuck: { label: '🔴 Stuck', sentence: '{stuck}', next: ['the stuck part is taken up again, and you are asked only if it cannot be finished'] },
} as const);

/** The verdict while a pull request is open and its checks are not known: the step's Next stays. */
export const CHECKS_UNKNOWN = Object.freeze({ label: '🟡 Waiting', sentence: 'the [[checks]] are not known right now (GitHub did not answer)' });

/** How many checks failed, and how many parts are stuck, in words. */
export const failedCount = (n: number): string => (n === 1 ? 'one' : String(n));
export const stuckParts = (n: number): string => (n === 1 ? 'a part of the build is stuck' : `${String(n)} parts of the build are stuck`);

/** The questions waiting, as a verdict and as You say them. */
export const questionsWait = (n: number): string => (n === 1 ? '1 question waits' : `${String(n)} questions wait`);
export const theQuestions = (n: number): string => (n === 1 ? 'the question' : `the ${String(n)} questions`);

/** Where a person gives an answer or an approval: the work's page, else its pull request, else GitHub. */
export const WHERE = Object.freeze({ page: 'on its page', pullRequest: 'on its [[pull request]]', github: 'on GitHub' });

/** **You**, when the person has nothing to do. */
export const NOTHING_TO_DO = 'nothing to do right now.';

const REVIEW_YOU = 'review the change (link below) and, if it is right, [[merge]].';

/** A step of a work. */
export type StepId =
  | 'shaping' | 'writing' | 'approval' | 'ready'
  | 'planning' | 'building' | 'checking' | 'questions' | 'prd-review' | 'shipped'
  | 'understanding' | 'reproducing' | 'fixing' | 'fix-checks' | 'fix-review' | 'fix-merged'
  | 'options' | 'applying' | 'checks' | 'visual-review' | 'visual-merged';

/** The words of one step. */
export type StepWords = { name: string; short: string; sentence: string; you: string; asks: boolean; next: readonly string[] };

const step = (name: string, short: string, sentence: string, next: readonly string[], you = NOTHING_TO_DO, asks = false): StepWords => Object.freeze({ name, short, sentence, you, asks, next: Object.freeze([...next]) });

/** Every step's words. */
export const STEPS: Readonly<Record<StepId, StepWords>> = Object.freeze({
  shaping: step('Shaping the idea', 'Shaped', 'the idea is being shaped into a [[PRD]]', ['once the idea is clear, I write it down for your approval']),
  writing: step('Writing it down', 'Written down', 'the [[PRD]] is being written down', ['once it is written, you read it and approve it']),
  approval: step('Waiting for your approval', 'Your approval', 'the [[PRD]] is written and waits for your approval', ['once you approve it, its build is planned and started'], 'read the [[PRD]] and approve it {where} (link below).', true),
  ready: step('Ready to build', 'Ready to build', 'the [[PRD]] is approved and ready to build', ['the build starts: the work is built in small parts, one after the other']),
  planning: step('Planning', 'Planned', 'the [[PRD]] is approved, and its build is being planned', ['once the plan is written, the parts are built one after the other']),
  building: step('Building ({k} of {n} parts)', 'Built', 'the [[PRD]] is being built, {k} of {n} parts done', ['once every part is built, the whole [[PRD]] is checked together']),
  checking: step('Checking it all together', 'Checked', 'every part is built, and the whole [[PRD]] is being checked together', ['once it is checked, it comes to you for review, or with questions']),
  questions: step('Questions for you', 'Your answers', 'the build is done, and {questions} for your answer', ['once you answer, your answers are taken into the build', 'then it comes to you for review'], 'answer {theQuestions} {where} (link below).', true),
  'prd-review': step('Ready for your review', 'Your review', 'the [[PRD]] is built and ready for your review', ['once you [[merge]] it, the [[PRD]] is shipped'], REVIEW_YOU, true),
  shipped: step('Shipped', 'Shipped', 'the [[PRD]] is shipped: it is in the product', ['nothing more: it is in the product']),
  understanding: step('Understanding the bug', 'Understood', 'the bug is being looked into', ['once it is understood, I reproduce it with a test that fails']),
  reproducing: step('Trying to reproduce it', 'Reproduced', 'the bug is being reproduced with a test that fails', ['once it is reproduced, I fix it, and the fix gets its [[pull request]]']),
  fixing: step('Reproduced, fixing it', 'Fixed', 'the bug is reproduced, and the fix is being written', ['once the fix is written, the automatic [[checks]] run on it']),
  'fix-checks': step('Fix done, [[checks]] running', 'Checked', 'the fix is done, and the automatic [[checks]] run on it', ['once the [[checks]] pass, I mark it ready', 'then it is yours to review and [[merge]]']),
  'fix-review': step('Ready for your review', 'Your review', 'the fix is ready for your review', ['once you [[merge]] it, the fix is in the product'], REVIEW_YOU, true),
  'fix-merged': step('Merged', 'Merged', 'the fix is merged: it is in the product', ['nothing more: the bug is fixed']),
  options: step('Showing you options', 'Options shown', 'a few options for the change are being drawn for you', ['you pick one of the options, then I apply it']),
  applying: step('Applying your pick', 'Pick applied', 'your pick is being applied', ['once it is applied, the change gets its [[pull request]], and the automatic [[checks]] run']),
  checks: step('[[Checks]] running', 'Checked', 'your pick is applied, and the automatic [[checks]] run on it', ['once the [[checks]] pass, it is yours to review and [[merge]]']),
  'visual-review': step('Ready for your review', 'Your review', 'the change is ready for your review', ['once you [[merge]] it, the change is in the product'], REVIEW_YOU, true),
  'visual-merged': step('Merged', 'Merged', 'the change is merged: it is in the product', ['nothing more: the change is in the product']),
});

/** The building step's name while no board counts its parts. */
export const BUILDING_UNCOUNTED = 'Building';

/** The steps of each kind of work, in order (the spec's table): a PRD's brainstorm steps until it is
 * approved, then its build's, whose fifth is `Ready for your review` unless questions wait. */
export const TRACKS = Object.freeze({
  'prd-before': ['shaping', 'writing', 'approval', 'ready'],
  'prd-after': ['planning', 'building', 'checking', 'prd-review', 'shipped'],
  bug: ['understanding', 'reproducing', 'fixing', 'fix-checks', 'fix-review', 'fix-merged'],
  visual: ['options', 'applying', 'checks', 'visual-review', 'visual-merged'],
} as const satisfies Record<string, readonly StepId[]>);

/** A track of `TRACKS`. */
export type Track = keyof typeof TRACKS;

/** The Details line of a failed check, in its raw name, for developers. */
export const DETAILS_LABEL = "Details (RAW, the check's real name, for developers)";
export const DETAILS_FAILED = 'failed';

/** The freshness line: just checked, an older copy because GitHub did not answer, or not asked. */
export const FRESHNESS = Object.freeze({
  now: 'Checked just now.',
  noAnswer: 'Checked {m} min ago (GitHub did not answer).',
  noAnswerNever: 'Not checked yet (GitHub did not answer).',
  notAsked: 'Checked {m} min ago.',
  notAskedNever: 'Not checked with GitHub yet.',
});

const MARK = /\[\[([^\]]+)\]\]/g;
const PLACEHOLDER = /\{(\w+)\}/g;

/** The term `word` names, whatever its case, or `null`. */
export function termOf(word: string): Term | null {
  const wanted = word.toLowerCase();
  return (Object.keys(TERMS) as Term[]).find((term) => term.toLowerCase() === wanted) ?? null;
}

/** `text` with each `{name}` filled from `values`; a name with no value is left as it is. */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/** `text` with its technical words plain, unexplained. */
export const plain = (text: string): string => text.replace(MARK, (_, word: string) => word);

/** What explains each technical word once in a block: `say()` explains the words of a line that the
 * block has not explained yet, and `first()` claims a word for a line that explains it its own way. */
export function explainer(): { say: (text: string) => string; first: (term: Term) => boolean } {
  const explained = new Set<Term>();
  const first = (term: Term): boolean => {
    if (explained.has(term)) return false;
    explained.add(term);
    return true;
  };
  const say = (text: string): string =>
    text.replace(MARK, (_, word: string) => {
      const term = termOf(word);
      return term && first(term) ? `${word} (${TERMS[term]})` : word;
    });
  return { say, first };
}
