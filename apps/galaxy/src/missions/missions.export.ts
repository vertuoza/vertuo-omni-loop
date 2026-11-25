import { unansweredOf } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { MissionBrief, PlanDecisionRead, RetroRead } from './missions.contract';

// A mission's retros as plain Markdown files (PRD 3194), the shape `omni mission get` writes: each retro as the skill commits it
// above with-you (the two sides as headings, each sentence a bullet with its citations) and each item as its own file. Pure.

type Sentence = { text: string; cites: Array<{ kind: string; ref: number }> };

const CITE: Record<string, string> = { event: 'event', prd: 'PRD', pr: 'PR', repair: 'repair' };
const bullet = (sentence: Sentence): string => `- ${sentence.text} (${sentence.cites.map((cite) => `${CITE[cite.kind] ?? cite.kind} ${String(cite.ref)}`).join(', ')})`;

/** One retro as a file: what went well and what to change, or why it was skipped. */
function retroFile(retro: RetroRead): string {
  const title = retro.milestone === 'mission' ? '# Mission retro' : `# Retro of roadmap ${retro.milestone}`;
  if (retro.retro === null) return `${title}\n\nSkipped: ${retro.skipped ?? 'no reason given'}\n`;
  return `${title}\n\n## What went well\n\n${retro.retro.wentWell.map(bullet).join('\n')}\n\n## What to change\n\n${retro.retro.toChange.map(bullet).join('\n')}\n`;
}

/** One item as a file: its target, its wording and its evidence, then the answer when a member gave one. */
function itemFile(item: RetroRead['items'][number]): string {
  const answer = item.answer === null ? '' : `\n## Answer\n\n${item.answer}${item.note === null ? '' : `: ${item.note}`}\n`;
  return `# Item ${String(item.number)}\n\n## Target\n\n${item.target}\n\n## Wording\n\n${item.wording}\n\n## Evidence\n\n${item.evidence.map((line) => `- ${line}`).join('\n')}\n${answer}`;
}

/** Each product PRD whose last decision naming a plan version is the Architect's escalation with open points (bug #3286), in the order recorded. */
function openOf(decisions: readonly PlanDecisionRead[]): MissionBrief['open'] {
  const prds = [...new Set(decisions.map((one) => one.prd))];
  return prds.flatMap((prd) => {
    const open = unansweredOf(decisions.filter((one) => one.prd === prd));
    return open?.plan == null ? [] : [{ prd, plan: open.plan, points: open.why }];
  });
}

/** What `GET /api/missions/brief` answers: the two files as pushed and each retro, in order, with its items as files; and the Architect's open points the PM has yet to answer (bug #3286). */
export function missionExport(number: number, page: { record: string; brief: string }, retros: readonly RetroRead[], decisions: readonly PlanDecisionRead[]): MissionBrief {
  return {
    mission: number,
    ...page,
    retros: retros.map((retro, index) => ({
      k: index + 1,
      milestone: retro.milestone,
      content: retroFile(retro),
      items: retro.items.map((item) => ({ name: `${String(item.number)}.md`, content: itemFile(item) })),
    })),
    open: openOf(decisions),
  };
}
