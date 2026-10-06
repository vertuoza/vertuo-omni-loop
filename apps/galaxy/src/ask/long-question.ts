// A long question on the ask page (PRD 752, decisions 3, 4 and 7): over LONG_QUESTION characters, a
// question is drawn as a lead in bold plus the rest folded under "Read the full question · N steps ·
// N words". The lead is its first paragraph when the text has a blank line; otherwise its first
// sentence, followed by its last sentence ending in "?" when that is a different one. Inline steps
// written "(1) …; (2) …; (3) …" become a markdown numbered list in the rest. A question of
// LONG_QUESTION characters or fewer is not long: the page draws it as it always did.

/** Longer than this, a question gets a lead and a fold. */
export const LONG_QUESTION = 280;

export type LongQuestion = {
  /** Markdown: the first paragraph, or the first sentence plus the final question. */
  lead: string;
  /** Markdown: everything else, its inline steps as a numbered list; '' when nothing is left. */
  rest: string;
  /** How many inline steps the rest holds. */
  steps: number;
  /** How many words the whole question holds. */
  words: number;
};

const BLANK_LINE = /\n[ \t]*\n/;

/** Sentences of one paragraph: a break after ".", "!" or "?" followed by space. */
function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** One paragraph with its inline steps "(1) … (2) …" turned into a numbered list, when they run 1,
 * 2, 3… in order from 1 and there are at least two. */
function withSteps(paragraph: string): { text: string; steps: number } {
  const marks: number[] = [];
  let from = 0;
  for (let n = 1; ; n++) {
    const at = paragraph.indexOf(`(${n}) `, from);
    if (at < 0) break;
    marks.push(at);
    from = at + String(n).length + 3;
  }
  if (marks.length < 2) return { text: paragraph, steps: 0 };
  const before = paragraph.slice(0, marks[0]).trim();
  const items = marks.map((at, i) => {
    const body = paragraph.slice(at + String(i + 1).length + 3, marks[i + 1] ?? paragraph.length).trim();
    return `${i + 1}. ${body.replace(/[;,]\s*(?:and\s*)?$/, '').trim()}`;
  });
  return { text: [before, items.join('\n')].filter(Boolean).join('\n\n'), steps: marks.length };
}

function restOf(paragraphs: string[]): { rest: string; steps: number } {
  const done = paragraphs.map((p) => p.trim()).filter(Boolean).map(withSteps);
  return { rest: done.map((d) => d.text).join('\n\n'), steps: done.reduce((sum, d) => sum + d.steps, 0) };
}

/** The lead and the fold of a question, or null when it is not long. */
export function longQuestion(question: string): LongQuestion | null {
  const text = question.trim();
  if (text.length <= LONG_QUESTION) return null;
  const words = text.split(/\s+/).filter(Boolean).length;

  if (BLANK_LINE.test(text)) {
    const [first = '', ...others] = text.split(BLANK_LINE);
    return { lead: first.trim(), ...restOf(others), words };
  }

  const sentences = sentencesOf(text);
  let asks = -1;
  for (let i = sentences.length - 1; i > 0; i--) {
    if (sentences[i]?.endsWith('?')) {
      asks = i;
      break;
    }
  }
  const lead = asks > 0 ? `${sentences[0]} ${sentences[asks]}` : (sentences[0] ?? '');
  const middle = sentences.filter((_, i) => i !== 0 && i !== asks).join(' ');
  return { lead, ...restOf([middle]), words };
}

/** What the closed fold says: "Read the full question · 3 steps · 128 words". */
export function foldSummary(long: LongQuestion): string {
  const steps = long.steps ? ` · ${long.steps} ${long.steps === 1 ? 'step' : 'steps'}` : '';
  return `Read the full question${steps} · ${long.words} ${long.words === 1 ? 'word' : 'words'}`;
}
