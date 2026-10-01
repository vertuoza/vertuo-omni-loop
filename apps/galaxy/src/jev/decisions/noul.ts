import type { JevDecisionSettings } from '../store';

// A yes-or-no decision asked as a Noul (outbox-risk, constituent-break): Jev's number from 0 to 1 at or
// above the decision's threshold is `true`, under it `false`; anything else falls outside the question.
export const noulAtThreshold = (answer: string | number, { threshold }: Pick<JevDecisionSettings, 'threshold'>): boolean | null =>
  typeof answer === 'number' && Number.isFinite(answer) && answer >= 0 && answer <= 1 ? answer >= threshold : null;
