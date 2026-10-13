// The briefing's closing section (PRD 1726): the thesis's laws section, read live, or, when there is
// no thesis or it has no laws section, one plain line per locked law read from the registers. Both
// `omni kb show briefing` and the context measure (PRD 1679) print it, so what a session reads and
// what is measured stay one.
import type { Config } from '../types.ts';
import { disclose, lawLine } from './disclose.ts';
import { readKnowledge, type KnowledgeCtx } from './registers.ts';
import { readThesis, thesisPath } from './thesis.ts';

/** The section's lines, and the file they were read from. */
export type BriefingLaws = { source: string; lines: string[] };

export function briefingLaws(ctx: KnowledgeCtx & { config: Pick<Config, 'laws'> }): BriefingLaws {
  const thesis = readThesis(ctx);
  const file = thesisPath(ctx);
  if (thesis?.lawsSection) {
    return { source: file, lines: [`## The laws  [read live from ${file}]`, thesis.lawsSection] };
  }
  const { laws } = disclose(readKnowledge({ ctx }).entries, thesis, null);
  const body = laws.length === 0 ? ['No law is locked yet.'] : laws.map((law) => lawLine(law, ctx.config.laws.owners));
  const missing = thesis === null ? `no thesis at ${file}` : `no laws section in ${file}`;
  return { source: ctx.layout.knowledgeRoot, lines: [`## The laws  [${missing}; read from the registers]`, ...body] };
}
