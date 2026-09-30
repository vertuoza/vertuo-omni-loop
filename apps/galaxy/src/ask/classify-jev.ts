import { questionCategory } from '../jev/decisions/question-category';
import { decide, type JevDecideDeps } from '../jev/resolve';
import type { Category, Classifier, ClassifyInput } from './classify';

// A round's category through Jev (PRD 812 s2): the `question-category` decision of the round's
// workspace, run by the resolver with today's classifier (Haiku, ./classify.ts) as the old answer.
// Off is exactly today: only the classifier runs. Shadow stores Haiku's and logs Jev's beside it; On
// stores Jev's, and Haiku's whenever Jev cannot. The call is logged about `round:<id>`.

export type CategoryDecider = (run: {
  workspace: string;
  roundId: string;
  input: ClassifyInput;
  /** Today's classifier, or null when there is none (no OPENROUTER_API_KEY): no old answer. */
  classify: Classifier | null;
}) => Promise<Category | null>;

export function categoryThroughJev(deps: JevDecideDeps): CategoryDecider {
  return async ({ workspace, roundId, input, classify }) => {
    const counted = await decide(deps, {
      workspace,
      entry: questionCategory,
      input,
      old: classify ? () => classify(input) : async () => null,
      ref: `round:${roundId}`,
    });
    return counted.value;
  };
}
