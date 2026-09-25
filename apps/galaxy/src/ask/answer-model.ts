// How the ask page turns a person's picks into the answer Claude receives (PRD 71's spec, "The
// contract"): `answers` maps each question's text to the chosen label exactly as Claude wrote it,
// several labels joined with ", " for a multi-select, and the text typed for Other, verbatim. The
// page shows a label ending in "(Recommended)" without it and with a badge instead, but sends the
// label as given. Pure, so the page's components only render it.

/** One option of an AskUserQuestion question. `preview` is shown in a monospace panel. */
export type AskOption = { label: string; description: string; preview: string | null };

/** One AskUserQuestion question, as the page reads it. */
export type AskQuestion = { question: string; header: string; multiSelect: boolean; options: AskOption[] };

/** What a person has picked for one question: labels, and Other (chosen or not, and its text). */
export type Pick = { labels: string[]; otherOn: boolean; otherText: string };

/** A round's picks, one per question, in the round's order. */
export type Draft = Pick[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

function readOption(raw: unknown): AskOption | null {
  if (!isRecord(raw) || typeof raw.label !== 'string' || raw.label === '') return null;
  return { label: raw.label, description: text(raw.description), preview: typeof raw.preview === 'string' && raw.preview !== '' ? raw.preview : null };
}

/** The round's questions from AskUserQuestion's `questions`, stored exactly as the tool took them.
 * Anything that is not a question with text is left out rather than guessed at. */
export function readQuestions(raw: unknown): AskQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((q): AskQuestion[] => {
    if (!isRecord(q) || typeof q.question !== 'string' || q.question.trim() === '') return [];
    const options = Array.isArray(q.options) ? q.options.map(readOption).filter((o): o is AskOption => o !== null) : [];
    return [{ question: q.question, header: text(q.header), multiSelect: q.multiSelect === true, options }];
  });
}

const RECOMMENDED = /\s*\(recommended\)\s*$/i;

/** An option's label as the page shows it: a trailing "(Recommended)" becomes the badge. */
export function shownLabel(label: string): { text: string; recommended: boolean } {
  const bare = label.replace(RECOMMENDED, '');
  return bare !== label && bare.trim() !== '' ? { text: bare, recommended: true } : { text: label, recommended: false };
}

/** A draft with nothing picked yet. */
export const emptyDraft = (questions: AskQuestion[]): Draft => questions.map(() => ({ labels: [], otherOn: false, otherText: '' }));

/** Picks an option: it replaces the pick (and Other) of a single choice, and toggles in a multi-select. */
export function pickOption(question: AskQuestion, pick: Pick, label: string): Pick {
  if (!question.multiSelect) return { ...pick, labels: [label], otherOn: false };
  const labels = pick.labels.includes(label) ? pick.labels.filter((l) => l !== label) : [...pick.labels, label];
  return { ...pick, labels };
}

/** Chooses Other (a single choice then drops its option), or un-ticks it in a multi-select. */
export function toggleOther(question: AskQuestion, pick: Pick): Pick {
  if (!question.multiSelect) return { ...pick, labels: [], otherOn: true };
  return { ...pick, otherOn: !pick.otherOn };
}

/** Typing in Other chooses it. */
export function typeOther(question: AskQuestion, pick: Pick, typed: string): Pick {
  return { ...pick, labels: question.multiSelect ? pick.labels : [], otherOn: true, otherText: typed };
}

/** The answer text for one question, or null while it has none. */
export function answerOf(question: AskQuestion, pick: Pick): string | null {
  const other = pick.otherOn && pick.otherText.trim() !== '' ? [pick.otherText] : [];
  const labels = question.options.map((o) => o.label).filter((label) => pick.labels.includes(label));
  const parts = question.multiSelect ? [...labels, ...other] : [...labels.slice(0, 1), ...other].slice(0, 1);
  return parts.length ? parts.join(', ') : null;
}

/** The whole round's `answers`, once every question has one; null until then (Send stays off). */
export function roundAnswers(questions: AskQuestion[], draft: Draft): Record<string, string> | null {
  if (questions.length === 0) return null;
  const answers: Record<string, string> = {};
  for (const [i, question] of questions.entries()) {
    const answer = draft[i] ? answerOf(question, draft[i]) : null;
    if (answer === null) return null;
    answers[question.question] = answer;
  }
  return answers;
}

/** What a key press asks for: 1 to 4 pick an option, Enter sends. While Other has the focus
 * (`typing`), digits are text and Shift+Enter breaks the line. */
export type KeyIntent = { kind: 'pick'; option: number } | { kind: 'send' } | null;

export function keyIntent(
  key: { key: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean },
  typing: boolean,
): KeyIntent {
  if (key.ctrlKey || key.metaKey || key.altKey || key.isComposing) return null;
  if (key.key === 'Enter') return key.shiftKey ? null : { kind: 'send' };
  if (typing || !/^[1-4]$/.test(key.key)) return null;
  return { kind: 'pick', option: Number(key.key) - 1 };
}

/** The question a key press acts on: the one holding the focus, else the first without an answer
 * (else the last). */
export function activeQuestion(questions: AskQuestion[], draft: Draft, focused: number | null): number {
  if (focused !== null && focused >= 0 && focused < questions.length) return focused;
  const open = questions.findIndex((q, i) => !draft[i] || answerOf(q, draft[i]) === null);
  return open === -1 ? Math.max(0, questions.length - 1) : open;
}

/** Picks option `option` of question `index` from the keyboard; the same draft for a key past the
 * last option. */
export function pickByKey(questions: AskQuestion[], draft: Draft, index: number, option: number): Draft {
  const question = questions[index];
  const label = question?.options[option]?.label;
  if (!question || label === undefined || !draft[index]) return draft;
  return draft.map((pick, i) => (i === index ? pickOption(question, pick, label) : pick));
}

/** The preview beside the options: the option in focus, else the one picked last, else the first
 * that has one. Null for a question without previews. */
export function shownPreview(question: AskQuestion, pick: Pick, focusedOption: number | null): { option: number; text: string } | null {
  const at = (i: number | null | undefined) => {
    const preview = i === null || i === undefined || i < 0 ? null : question.options[i]?.preview;
    return preview ? { option: i as number, text: preview } : null;
  };
  const picked = pick.labels.length ? question.options.findIndex((o) => o.label === pick.labels[pick.labels.length - 1]) : -1;
  return at(focusedOption) ?? at(picked) ?? at(question.options.findIndex((o) => o.preview !== null));
}
