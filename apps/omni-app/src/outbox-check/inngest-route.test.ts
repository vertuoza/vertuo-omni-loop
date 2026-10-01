import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../api/inngest.ts';
import { FUNCTION_ID, outboxCheck } from './outbox-check.ts';
import { INBOX_FUNCTION_ID, inboxCheck } from '../inbox-check/inbox-check.ts';
import { RETRO_FUNCTION_ID, retro } from '../retro/retro.ts';
import { HARVEST_FUNCTION_ID, knowledgeHarvest } from '../knowledge-harvest/knowledge-harvest.ts';
import { PR_STATS_FUNCTION_ID, prStats } from '../pr-stats/pr-stats.ts';
import { CANON_ACTION_FUNCTION_ID, canonAction } from '../inbox-check/canon-action.ts';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the outbox-check function, the inbox-check function (PRD 675), the retro function (PRD 72) and the knowledge harvest (PRD 82), the pr stats collector (PRD 612), the canon buttons (PRD 839), and nothing else', () => {
    expect(functions).toEqual([outboxCheck, inboxCheck, retro, knowledgeHarvest, prStats, canonAction]);
    expect(canonAction.id()).toBe(CANON_ACTION_FUNCTION_ID);
    expect(inboxCheck.id()).toBe(INBOX_FUNCTION_ID);
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
    // Inngest registers each failure handler as a function of its own, beside its function; prStats and canonAction have none.
    expect(body.function_count).toBe(10);
  });
});
