import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functions, GET, POST, PUT } from '../../entries/inngest.ts';
import { EnvError } from '../env.ts';
import { RETRO_FUNCTION_ID } from '../retro/retro.ts';
import { HARVEST_FUNCTION_ID } from '../knowledge-harvest/knowledge-harvest.ts';
import { MAIN_WATCH_FUNCTION_ID } from '../main-watch/main-watch.ts';

describe('/api/inngest', () => {
  beforeEach(() => {
    vi.stubEnv('INNGEST_DEV', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves the retro function (PRD 72) and the knowledge harvest (PRD 82), the main watch (PRD 2410), and nothing else', () => {
    expect(functions.map((fn) => fn.id())).toEqual([
      RETRO_FUNCTION_ID,
      HARVEST_FUNCTION_ID,
      MAIN_WATCH_FUNCTION_ID,
    ]);
  });

  it('serves none of the pull-request checks, the fix row stamp, the fleet board, the canon buttons nor the server event: they run on the job ledger (PRD 2688, acceptance 11; PRD omni-loop-3 s3, s4)', () => {
    const ids = functions.map((fn) => fn.id());
    for (const gone of ['outbox-check', 'inbox-check', 'approved-check', 'approved-rerun', 'budgets-check', 'fix-row-stamp', 'fleet-board', 'canon-action', 'server-event']) expect(ids).not.toContain(gone);
    const triggers = functions.flatMap((fn) => (fn as unknown as { opts: { triggers?: { event?: string }[] } }).opts.triggers ?? []).map((trigger) => trigger.event);
    for (const event of ['omni-loop/outbox.check.requested', 'omni-loop/inbox.check.requested', 'omni-loop/approved.check.requested', 'omni-loop/approved.label.changed', 'omni-loop/budgets.check.requested', 'omni-loop/fix.stamp.requested', 'omni-loop/fleet-board.requested', 'omni-loop/canon.action.requested', 'omni-loop/server.event.received']) {
      expect(triggers).not.toContain(event);
    }
  });

  it('answers GET, POST and PUT — the three verbs Inngest calls', () => {
    for (const verb of [GET, POST, PUT]) expect(typeof verb).toBe('function');
  });

  it('describes the app on GET in dev mode', async () => {
    const response = await GET(new Request('https://omni-loop.example/api/inngest', { headers: { host: 'omni-loop.example' } }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { function_count: number };
    // Inngest registers each failure handler as a function of its own, beside its function; mainWatch has none.
    expect(body.function_count).toBe(5);
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
    expect((await loadOver({ VERCEL_ENV: 'preview' })).functions).toHaveLength(3);
  });
});
