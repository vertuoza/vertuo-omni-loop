import { questionsDeps } from '../../../../src/questions/questions-live';
import { answerQuestion } from '../../../../src/questions/questions.controller';

// POST /api/outbox/answer {prdId, item, answer} → 200 {item, prdId, verdict, settledAt}: a member settles
// an open question of a product PRD from the product's Questions tab, as the signed-in person
// (src/questions/questions.controller.ts, PRD 1548 s9).
export const maxDuration = 60;

export function POST(request: Request) {
  return answerQuestion(request, questionsDeps());
}
