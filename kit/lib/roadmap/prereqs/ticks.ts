/**
 * **A prerequisite's tick** (PRD 1218, slice s2): a `person` row of a roadmap's `## Prerequisites`
 * table is done once a person says so, with a comment on the roadmap's issue. `omni roadmap tick`
 * and the roadmap page's **Mark as done** post the same comment; `omni roadmap prereqs` reads them
 * back.
 *
 * The comment opens with one marker, `<!-- omni-roadmap-tick: <id> -->`, on its first line. Like a
 * roadmap answer's, the marker is fixed, so the page writes it without reading the repository's
 * config. Pure: comments in, ticked ids out.
 */
import type { IssueComment } from '../../outbox/comment.ts';

const MARKER = /^<!-- omni-roadmap-tick: ([A-Za-z0-9][A-Za-z0-9._-]{0,19}) -->/;

/** The marker a tick of row `id` opens with. */
export const tickMarker = (id: string): string => `<!-- omni-roadmap-tick: ${id} -->`;

/** The comment that ticks row `id`. */
export function tickComment(id: string): string {
  return `${tickMarker(id)}\nPrerequisite **${id}** is done.\n`;
}

/** The row a comment ticks, or null when it ticks none. */
export function tickOf(body: string): string | null {
  return MARKER.exec(body)?.[1] ?? null;
}

/** Every row ticked by the roadmap issue's comments; a comment without the marker is ignored. */
export function readTicks(comments: readonly IssueComment[]): Set<string> {
  const ticks = new Set<string>();
  for (const comment of comments) {
    const id = tickOf(comment.body ?? '');
    if (id !== null) ticks.add(id);
  }
  return ticks;
}
