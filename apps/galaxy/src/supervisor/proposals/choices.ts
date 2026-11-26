import type { Finding } from '../api/supervisor.contract';
import { isLinkAction, JobTargetSchema, MissionTargetSchema, type Pressed } from './proposals.contract';

// What the Suggested box of an open finding draws (PRD omni-loop-34 s7, the before/after page's 2.A): at most two of
// the Supervisor's suggestions, each a button an owner presses, the first the primary one, or a link the page follows
// (Open Terminal, Open the mission), then Not a problem. A suggestion pressed already shows how it ended instead.

export type Choice =
  | { kind: 'press'; id: string; label: string; primary: boolean }
  | { kind: 'link'; id: string; label: string; href: string }
  | { kind: 'pressed'; id: string; label: string; words: string };

const OUTCOME_WORDS = { done: 'Done', refused: 'Refused', failed: 'Failed' } as const;

/** Where a link suggestion goes: a job's Terminal on the Runners page, a mission's room; the page itself when its target names none. */
export function hrefOf(action: string | null, target: Record<string, unknown> | null): string {
  if (action === 'open-terminal') {
    const job = JobTargetSchema.safeParse(target);
    return job.success ? `/app/runners?terminal=${job.data.job}#job-${job.data.job}` : '/app/runners';
  }
  const mission = MissionTargetSchema.safeParse(target);
  const fleet = typeof target?.fleet === 'string' ? target.fleet : null;
  return mission.success && fleet !== null ? `/app/ai-fleet?fleet=${encodeURIComponent(fleet)}&tab=room&mission=${mission.data.mission}` : '/app/ai-fleet';
}

/** The box's choices, in the Supervisor's order. */
export function choicesOf(finding: Finding): Choice[] {
  const suggestions = finding.proposals.filter((p) => p.kind === 'suggestion' && p.label !== null).slice(0, 2);
  let primary = true;
  return suggestions.flatMap((s): Choice[] => {
    const label = s.label ?? '';
    if (isLinkAction(s.action)) {
      return [{ kind: 'link', id: s.id, label, href: hrefOf(s.action, s.target) }];
    }
    const press = finding.proposals.find((p) => p.kind === 'press' && p.replyTo === s.id);
    const result = press ? finding.proposals.find((p) => p.kind === 'result' && p.replyTo === press.id) : undefined;
    if (press) {
      const words = result?.outcome ? `${OUTCOME_WORDS[result.outcome]}${result.note ? `: ${result.note}` : ''}` : `Pressed by ${press.by ?? 'an owner'}`;
      return [{ kind: 'pressed', id: s.id, label, words }];
    }
    const choice: Choice = { kind: 'press', id: s.id, label, primary };
    primary = false;
    return [choice];
  });
}

/** The line under the box once a press came back. */
export const pressedWords = (pressed: Pressed): string => `${OUTCOME_WORDS[pressed.outcome]}: ${pressed.note}`;
