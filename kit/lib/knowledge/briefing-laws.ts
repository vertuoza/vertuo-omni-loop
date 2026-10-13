// The briefing's closing section (PRD 1726): which laws are locked, by id, and how to read the ones a
// change touches. Only the ids go in the briefing, never each law's full sentence: every session reads
// the briefing first and it is held to a ceiling (PRD 1679), so a law's words are disclosed by
// `omni kb laws --paths` or `--slice`, for the laws a change touches. Both `omni kb show briefing`
// and the context measure print it, so what a session reads and what is measured stay one.
import type { Config } from '../types.ts';
import { disclose } from './disclose.ts';
import { readKnowledge, type KnowledgeCtx } from './registers.ts';
import { readThesis, thesisPath } from './thesis.ts';

/** The section's lines, and the file they were read from. */
export type BriefingLaws = { source: string; lines: string[] };

export function briefingLaws(ctx: KnowledgeCtx & { config: Pick<Config, 'laws'> }): BriefingLaws {
  const thesis = readThesis(ctx);
  const source = thesis === null ? ctx.layout.knowledgeRoot : thesisPath(ctx);
  const { laws } = disclose(readKnowledge({ ctx }).entries, thesis, null);
  if (laws.length === 0) return { source, lines: ['## The laws', 'No law is locked yet.'] };
  const ids = laws.map(({ id }) => id).join(', ');
  return {
    source,
    lines: [
      `## The laws  [${laws.length} locked]`,
      `Locked: ${ids}. Before you change a file, run \`omni kb laws --paths <file>…\` (or \`--slice <prd> <slice>\`) to read the laws it touches; only their owner can approve a change to one.`,
    ],
  };
}
