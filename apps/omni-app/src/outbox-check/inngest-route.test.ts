import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../api/inngest.ts';
import { EnvError } from '../env.ts';
import { FUNCTION_ID } from './outbox-check.ts';
import { INBOX_FUNCTION_ID } from '../inbox-check/inbox-check.ts';
import { RETRO_FUNCTION_ID } from '../retro/retro.ts';
import { HARVEST_FUNCTION_ID } from '../knowledge-harvest/knowledge-harvest.ts';
import { PR_STATS_FUNCTION_ID } from '../pr-stats/pr-stats.ts';
import { CANON_ACTION_FUNCTION_ID } from '../inbox-check/canon-action.ts';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the outbox-check function, the inbox-check function (PRD 675), the retro function (PRD 72) and the knowledge harvest (PRD 82), the pr stats collector (PRD 612), the canon buttons (PRD 839), and nothing else', () => {
    expect(functions.map((fn) => fn.id())).toEqual([
      FUNCTION_ID,
      INBOX_FUNCTION_ID,
      RETRO_FUNCTION_ID,
      HARVEST_FUNCTION_ID,
      PR_STATS_FUNCTION_ID,
      CANON_ACTION_FUNCTION_ID,
    ]);
  });

  it('answers GET, POST and PUT — the three verbs Inngest calls', () => {
    for (const verb of [GET, POST, PUT]) expect(typeof verb).toBe('function');
  });

  it('describes the app on GET in dev mode', async () => {
    const response = await GET(new Request('https://omni-loop.example/api/inngest', { headers: { host: 'omni-loop.example' } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { function_count: number };
    // Inngest registers each failure handler as a function of its own, beside its function; prStats and canonAction have none.
    expect(body.function_count).toBe(10);
  });
});

describe('/api/inngest — the environment, read when the route loads (PRD 1059)', () => {
  afterEach(() => {
    vi.doUnmock('../env.ts');
    vi.resetModules();
  });

  /** The route, loaded afresh over `source` in place of the process's environment. */
  async function loadOver(source: Record<string, string>) {
    vi.resetModules();
    vi.doMock('../env.ts', async (importOriginal) => ({ ...(await importOriginal<object>()), processEnv: () => source }));
    return import('../../api/inngest.ts');
  }

  it('fails to load in production without the webhook secret and the GitHub App, naming them', async () => {
    const loading = loadOver({ VERCEL_ENV: 'production' });
    // A fresh load has its own EnvError class: the error is told by its name.
    await expect(loading).rejects.toMatchObject({ name: new EnvError([]).name });
    await expect(loading).rejects.toThrow(/GITHUB_WEBHOOK_SECRET.*GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY/);
  });

  it('fails to load on a half-set group, naming its variables and never a value', async () => {
    const loading = loadOver({ SUPABASE_URL: 'https://db.example' });
    await expect(loading).rejects.toThrow('SUPABASE_SERVICE_ROLE_KEY is not set while SUPABASE_URL is');
  });

  it('loads on a preview with nothing set', async () => {
    expect((await loadOver({ VERCEL_ENV: 'preview' })).functions).toHaveLength(6);
  });
});
