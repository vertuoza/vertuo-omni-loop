import { log } from 'omni-loop/kit/lib/log/log.ts';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import { refuse, reply } from '../business-api/reply';
import type { KnowledgeGraph } from '../data/knowledge';

// The star chart's route (PRD 1808 s2), as a plain function of its dependencies, so it is tested on
// stubs and the route stays one line:
//
//   GET /api/arcade/chart  → 200 {chart}: the knowledge graph /play sends today, or 'none' in a build
//                            that carries no knowledge base
//
// It answers the people /play sends the chart to: a signed-in member of a workspace (the crew), whose
// membership could be read. Refusals, each `{error}` in plain words (ADR-0029): 401 signed out, 403 an
// outsider (no workspace: /play sends them no chart), 500 the chart out of reach, its cause logged.
// A membership that cannot be read is out of reach, never outsider (BR-PRODUCT-30), and no chart is read.

/** Who asks: crew, an outsider, or null when nobody is signed in. */
export type ChartStanding = 'crew' | 'outsider' | null;

export interface ChartDeps {
  /** Who asks; rejects when their membership cannot be read. */
  standing: () => Promise<ChartStanding>;
  /** The chart: the graph, 'none' in a build without a knowledge base, null when it cannot be read. */
  chart: () => KnowledgeGraph | 'none' | null;
  log?: (line: string) => void;
}

/** The arcade's own words for a chart it cannot read (src/arcade/scenes/chart.tsx). */
export const CHART_OUT_OF_REACH = 'THE STAR CHART IS OUT OF REACH';

const logged = (message: string) => { log.error({ event: 'arcade-chart', outcome: 'failed', message }); };

/** GET: the star chart, to the crew. */
export async function answerChart({ standing, chart, log: write = logged }: ChartDeps): Promise<Response> {
  let who: ChartStanding;
  try {
    who = await standing();
  } catch (error) {
    write(`arcade chart: the membership could not be read (${messageOf(error)})`);
    return refuse(500, CHART_OUT_OF_REACH);
  }
  if (who === null) return refuse(401, 'Sign in first.');
  if (who === 'outsider') return refuse(403, 'The star chart is for the crew of a workspace.');
  const read = chart();
  if (read === null) {
    write('arcade chart: the knowledge could not be read');
    return refuse(500, CHART_OUT_OF_REACH);
  }
  return reply(200, { chart: read });
}
