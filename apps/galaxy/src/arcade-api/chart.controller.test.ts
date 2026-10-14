import { describe, expect, it } from 'vitest';
import type { KnowledgeGraph } from '../data/knowledge';
import { answerChart, CHART_OUT_OF_REACH, type ChartDeps } from './chart.controller';

// GET /api/arcade/chart (PRD 1808 s2): the star chart /play sends today, to the same people. Each
// answer on stubs: no test reads Supabase or the disk.

const GRAPH: KnowledgeGraph = {
  version: 1,
  repo: 'acme/widgets',
  domains: [{ name: 'product', code: 'PRODUCT', scope: 'product', counts: { principles: 1, rules: 0, invariants: 0, laws: 1, proposed: 0 } }],
  entries: [],
  links: [],
  loose: [],
  unserved: [],
};

const deps = (over: Partial<ChartDeps> = {}): ChartDeps & { reads: number; lines: string[] } => {
  const state = { reads: 0, lines: [] as string[] };
  return Object.assign(state, {
    standing: () => Promise.resolve('crew' as const),
    chart: () => { state.reads += 1; return GRAPH; },
    log: (line: string) => { state.lines.push(line); },
    ...over,
  });
};

const bodyOf = async (answer: Response): Promise<unknown> => answer.json();

describe('GET /api/arcade/chart', () => {
  it('answers the crew the chart /play sends today, never cached', async () => {
    const d = deps();
    const answer = await answerChart(d);
    expect(answer.status).toBe(200);
    expect(answer.headers.get('cache-control')).toBe('no-store');
    expect(await bodyOf(answer)).toEqual({ chart: GRAPH });
    expect(d.reads).toBe(1);
  });

  it('answers 401 to a signed-out visitor, and reads no chart', async () => {
    const d = deps({ standing: () => Promise.resolve(null) });
    const answer = await answerChart(d);
    expect(answer.status).toBe(401);
    expect(await bodyOf(answer)).toEqual({ error: expect.any(String) as unknown });
    expect(d.reads).toBe(0);
  });

  it('answers 403 to an outsider, who gets no chart on /play either, and reads no chart', async () => {
    const d = deps({ standing: () => Promise.resolve('outsider' as const) });
    const answer = await answerChart(d);
    expect(answer.status).toBe(403);
    expect(d.reads).toBe(0);
  });

  it("answers 'none' in a build without a knowledge base", async () => {
    const answer = await answerChart(deps({ chart: () => 'none' }));
    expect(answer.status).toBe(200);
    expect(await bodyOf(answer)).toEqual({ chart: 'none' });
  });

  it('answers out of reach, logged, when the knowledge cannot be read', async () => {
    const d = deps({ chart: () => null });
    const answer = await answerChart(d);
    expect(answer.status).toBe(500);
    expect(await bodyOf(answer)).toEqual({ error: CHART_OUT_OF_REACH });
    expect(d.lines).toHaveLength(1);
  });

  it('answers out of reach, never outsider, when the membership cannot be read (BR-PRODUCT-30), and reads no chart', async () => {
    const d = deps({ standing: () => Promise.reject(new Error('connection refused')) });
    const answer = await answerChart(d);
    expect(answer.status).toBe(500);
    expect(await bodyOf(answer)).toEqual({ error: CHART_OUT_OF_REACH });
    expect(d.lines.join('\n')).toContain('connection refused');
    expect(d.reads).toBe(0);
  });
});
