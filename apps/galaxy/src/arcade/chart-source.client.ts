import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { KnowledgeGraph } from '../data/knowledge';

// The star chart from the browser (PRD 1808, s4): `GET /api/arcade/chart` (src/arcade-api/chart.controller.ts),
// read when the chart opens. The sign-in cookie goes with the request; the page builds no Supabase
// client. Any refusal (401, 403, 500) or an answer of another shape throws: the game reads the chart as
// out of reach, and asks again the next time it opens.

/** The star chart's route. */
export const CHART_PATH = '/api/arcade/chart';

/** The browser's fetch, or a stub in a test. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const isList = (value: unknown, key: string) => Array.isArray(propertyOf(value, key));

/** A knowledge graph as the route answers it: the parts the chart reads, each of its kind. */
function isGraph(value: unknown): value is KnowledgeGraph {
  return propertyOf(value, 'version') === 1 && ['domains', 'entries', 'links', 'loose', 'unserved'].every((key) => isList(value, key));
}

/** The star chart: the graph, or 'none' in a build without a knowledge base. Throws when it could not be read. */
export async function fetchChart(fetcher: Fetch = (url, init) => fetch(url, init)): Promise<KnowledgeGraph | 'none'> {
  const response = await fetcher(CHART_PATH, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`The star chart: ${String(response.status)}`);
  const chart = propertyOf(await response.json(), 'chart');
  if (chart === 'none' || isGraph(chart)) return chart;
  throw new Error('The star chart: an answer of another shape');
}
