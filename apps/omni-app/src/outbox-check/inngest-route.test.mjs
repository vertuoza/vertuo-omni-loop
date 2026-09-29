import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../api/inngest.mjs';
import { FUNCTION_ID, outboxCheck } from './outbox-check.mjs';
import { RETRO_FUNCTION_ID, retro } from '../retro/retro.mjs';
import { HARVEST_FUNCTION_ID, knowledgeHarvest } from '../knowledge-harvest/knowledge-harvest.mjs';
import { PR_STATS_FUNCTION_ID, prStats } from '../pr-stats/pr-stats.mjs';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the outbox-check function, the retro function (PRD 72) and the knowledge harvest (PRD 82), the pr stats collector (PRD 612), and nothing else', () => {
    expect(functions).toEqual([outboxCheck, retro, knowledgeHarvest, prStats]);
    expect(outboxCheck.id()).toBe(FUNCTION_ID);
    expect(retro.id()).toBe(RETRO_FUNCTION_ID);
    expect(knowledgeHarvest.id()).toBe(HARVEST_FUNCTION_ID);
    expect(prStats.id()).toBe(PR_STATS_FUNCTION_ID);
  });

  it('answers GET, POST and PUT — the three verbs Inngest calls', () => {
    for (const verb of [GET, POST, PUT]) expect(typeof verb).toBe('function');
  });

  it('describes the app on GET in dev mode', async () => {
    const response = await GET(new Request('https://omni-loop.example/api/inngest', { headers: { host: 'omni-loop.example' } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    // Inngest registers each failure handler as a function of its own, beside its function; prStats has none.
    expect(body.function_count).toBe(7);
  });
});
