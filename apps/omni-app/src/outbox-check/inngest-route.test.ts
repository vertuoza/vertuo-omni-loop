import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../entries/inngest.ts';
import { EnvError } from '../env.ts';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves no function: the retro, the knowledge harvest and the main watch are jobs of the ledger (PRD omni-loop-4)', () => {
    expect(functions).toEqual([]);
  });

  it('serves none of the pull-request checks, the fix row stamp, the fleet board, the canon buttons nor the server event: they run on the job ledger (PRD 2688, acceptance 11; PRD omni-loop-3 s3, s4)', () => {
    expect(functions.map((fn: { id(): string }) => fn.id())).toEqual([]);
  });

  it('answers GET, POST and PUT — the three verbs Inngest calls', () => {
    for (const verb of [GET, POST, PUT]) expect(typeof verb).toBe('function');
  });

  it('describes the app on GET in dev mode', async () => {
    const response = await GET(new Request('https://omni-loop.example/api/inngest', { headers: { host: 'omni-loop.example' } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { function_count: number };
    expect(body.function_count).toBe(0);
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
    return import('../../entries/inngest.ts');
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
    expect((await loadOver({ VERCEL_ENV: 'preview' })).functions).toHaveLength(0);
  });
});
