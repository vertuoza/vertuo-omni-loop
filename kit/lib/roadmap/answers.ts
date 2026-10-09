/**
 * **A roadmap's answers** (PRD 1162, slice s6): a person answers an open question of a roadmap with a
 * comment on the roadmap's issue, and the repository's side reads the answers back from those comments.
 *
 * The comment carries one marker, `<!-- omni-roadmap-answer: <question> -->`, on its first line, then
 * the answer under a line naming the question. The marker is fixed, not derived from the outbox's
 * marker prefix, so that the roadmap's page can write the same comment without reading the
 * repository's config. Pure: comments in, answers out.
 */
import type { IssueComment } from '../outbox/comment.ts';

/** The longest answer the app stores for a question. */
export const ANSWER_MAX = 1000;

const MARKER = /^<!-- omni-roadmap-answer: ([A-Za-z0-9][A-Za-z0-9._-]{0,19}) -->[ \t]*\r?\n?/;

/** The marker an answer to `question` opens with. */
export const answerMarker = (question: string): string => `<!-- omni-roadmap-answer: ${question} -->`;

/** The line under the marker that names the question; the answer follows it. */
const heading = (question: string): string => `**${question}**, answered:`;

/** The comment that records `answer` to `question`. */
export function answerComment(question: string, answer: string): string {
  return `${answerMarker(question)}\n${heading(question)}\n\n${answer.trim()}\n`;
}

/** The question and the answer a comment records, or null when it records none. */
export function answerOf(body: string): { question: string; answer: string } | null {
  const marked = MARKER.exec(body);
  if (!marked) return null;
  const question = marked[1] ?? '';
  let rest = body.slice(marked[0].length).trim();
  if (rest.startsWith(heading(question))) rest = rest.slice(heading(question).length).trim();
  if (!rest) return null;
  return { question, answer: rest.length > ANSWER_MAX ? rest.slice(0, ANSWER_MAX).trim() : rest };
}

/** The latest answer to each question, read from the roadmap issue's comments in the order GitHub
 * lists them (oldest first); a comment without the marker, or with nothing after it, is ignored. */
export function readAnswers(comments: readonly IssueComment[]): Map<string, string> {
  const answers = new Map<string, string>();
  for (const comment of comments) {
    const found = answerOf(comment.body ?? '');
    if (found) answers.set(found.question, found.answer);
  }
  return answers;
}
