// LOOP LINGO (PRD 285, trimmed by PRD 971): HOME speaks plain words first. The loop terms it uses are
// glossed once, in the strategy guide's sidebar; the other loop words never appear in its prose. The
// checks here read a text and name what breaks that rule, so a test can hold the page to it.

export interface LingoEntry {
  term: string;
  gloss: string;
}

/** The sidebar, in the loop's order: the terms HOME's prose still says (HARNESS left with SET UP, and
 * WAVE with the old PLAN level, PRD 971). */
export const LINGO: readonly LingoEntry[] = [
  { term: 'PRD', gloss: 'The brief for one feature: the problem, the stories, and what done means.' },
  { term: 'SLICE', gloss: 'One small piece of a feature, built test-first, with its own pull request.' },
  { term: 'OUTBOX', gloss: 'The decisions the agents took without asking, waiting for your answer.' },
];

/** The loop terms HOME may use, each only once glossed: a term out of the sidebar is still one, so a
 * sentence that brings it back must bring its gloss back too. */
export const LOOP_TERMS: readonly string[] = ['HARNESS', 'PRD', 'SLICE', 'WAVE', 'OUTBOX'];

/** The loop words HOME's prose never says. */
export const BANNED_WORDS: readonly string[] = ['phase-0', 'worktree', 'sub-PR', 'dossier', 'territory', 'yolo'];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether the text says the word: whole word, any case, with or without a plural s. */
export function says(text: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}s?(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/** The loop terms the text uses that the glossary does not gloss. */
export function unglossedTerms(text: string, glossary: readonly LingoEntry[] = LINGO): string[] {
  const glossed = new Set(glossary.map((e) => e.term.toUpperCase()));
  return LOOP_TERMS.filter((t) => !glossed.has(t) && says(text, t));
}

/** The glossed terms the text never uses: a gloss left without a use. */
export function unusedGlosses(text: string, glossary: readonly LingoEntry[] = LINGO): string[] {
  return glossary.map((e) => e.term).filter((t) => !says(text, t));
}

/** The banned loop words the text says. */
export function bannedWords(text: string): string[] {
  return BANNED_WORDS.filter((w) => says(text, w));
}

export interface LingoFindings {
  unglossed: string[];
  unused: string[];
  banned: string[];
}

/** Every finding on a text; all three empty means the text keeps to LOOP LINGO. */
export function lingoFindings(text: string, glossary: readonly LingoEntry[] = LINGO): LingoFindings {
  return { unglossed: unglossedTerms(text, glossary), unused: unusedGlosses(text, glossary), banned: bannedWords(text) };
}
