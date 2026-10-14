import { answerChart } from '../../../../src/arcade-api/chart.controller';
import { chartDeps } from '../../../../src/arcade-api/chart-live';

// GET /api/arcade/chart → 200 {chart} | 401 | 403 | 500: the star chart /play sends today, to the crew,
// read when the star chart opens (src/arcade-api/chart.controller.ts, PRD 1808 s2).
export const maxDuration = 10;

export function GET() {
  return answerChart(chartDeps());
}
