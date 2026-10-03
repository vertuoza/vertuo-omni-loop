/**
 * **The GitHub App's environment** (PRD 1059): the one module of `apps/omni-app` that reads
 * `process.env`. `readEnv(source)` gives its feature groups, each complete or `null` (the feature is
 * off); `api/github.ts` and `api/inngest.ts` read them once, when they load, and hand each group to the
 * code that needs it. A half-set group, a malformed value, or in production a missing webhook secret
 * or GitHub App, throws one `EnvError` there, naming every variable and never a value.
 *
 * **Production** is `VERCEL_ENV=production`: the app is deployed on Vercel, whose previews run with
 * `NODE_ENV=production` too, and the README's setup never says a preview holds the app's secrets
 * (GitHub and Inngest call the production domain only). A preview, a development server and a test
 * require nothing.
 *
 * **Not read here:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` and `INNGEST_DEV`. The Inngest SDK
 * reads them from the process itself, in `new Inngest()` and `serve()` (`src/inngest-client.ts`,
 * `api/inngest.ts`); passing them would duplicate the SDK's own reading and its rules for each.
 */
import { z } from 'zod';
import { envGroup, envReader, type EnvSource } from 'vertuo-omni-plan/kit/lib/env/group.ts';

export { EnvError, requireGroup, type EnvSource } from 'vertuo-omni-plan/kit/lib/env/group.ts';

/** Galaxy's host when `GALAXY_URL` names none. */
export const DEFAULT_GALAXY_URL = 'https://www.omni-loop.xyz';

/** Which Vercel environment this deployment is: `production`, `preview` or `development`. */
const VERCEL = envGroup({
  label: 'the Vercel environment',
  schema: z.object({ name: z.string().optional() }),
  variables: { name: 'VERCEL_ENV' },
});

/** The secret GitHub signs every delivery with; unset, every delivery is refused. */
const WEBHOOK = envGroup({
  label: 'the webhook secret',
  schema: z.object({ secret: z.string() }),
  variables: { secret: 'GITHUB_WEBHOOK_SECRET' },
  required: 'production',
});

/** The GitHub App's id and private key, which sign every installation token. */
export const GITHUB_APP = envGroup({
  label: 'the GitHub App',
  schema: z.object({
    id: z.string().regex(/^\d+$/, 'must be a number'),
    // A key pasted with literal `\n` sequences is accepted (README, "Setup").
    privateKey: z.string().transform((pem) => pem.replace(/\\n/g, '\n')),
  }),
  variables: { id: 'GITHUB_APP_ID', privateKey: 'GITHUB_APP_PRIVATE_KEY' },
  required: 'production',
});

/** The database, as the service role: the pr-stats collector and the canon gate read it. */
const SUPABASE = envGroup({
  label: 'the Supabase pair',
  schema: z.object({ url: z.url(), key: z.string() }),
  variables: { url: 'SUPABASE_URL', key: 'SUPABASE_SERVICE_ROLE_KEY' },
});

/** OpenRouter, which the retro, the harvest and the canon gate ask; the model has a default. */
const OPENROUTER = envGroup({
  label: 'OpenRouter',
  schema: z.object({ key: z.string(), model: z.string().optional() }),
  variables: { key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL' },
});

/** The secret stage events are signed with on their way to galaxy (PRD 587). */
const STAGE_EVENTS = envGroup({
  label: 'the stage events',
  schema: z.object({ secret: z.string() }),
  variables: { secret: 'STAGE_EVENT_SECRET' },
});

/** The secret the canon gate signs its call to galaxy's constituent judge with (PRD 871). */
const CONSTITUENT_JUDGE = envGroup({
  label: 'the constituent judge',
  schema: z.object({ secret: z.string() }),
  variables: { secret: 'CONSTITUENT_JUDGE_SECRET' },
});

/** Galaxy's host, for the stage events and the judge. */
const GALAXY = envGroup({
  label: 'galaxy',
  schema: z.object({ url: z.url().optional() }),
  variables: { url: 'GALAXY_URL' },
});

/** Every group of the GitHub App, read from `source`; throws one `EnvError` naming every problem. */
export function readEnv(source: EnvSource) {
  const production = envReader(source).group(VERCEL)?.name === 'production';
  const reader = envReader(source, { production });
  const env = {
    production,
    webhook: reader.group(WEBHOOK),
    githubApp: reader.group(GITHUB_APP),
    supabase: reader.group(SUPABASE),
    openrouter: reader.group(OPENROUTER),
    stageEvents: reader.group(STAGE_EVENTS),
    constituentJudge: reader.group(CONSTITUENT_JUDGE),
    galaxyUrl: (reader.group(GALAXY)?.url ?? DEFAULT_GALAXY_URL).replace(/\/+$/, ''),
  };
  reader.done();
  return env;
}

/** The GitHub App's groups, as `readEnv` gives them. */
export type AppEnv = ReturnType<typeof readEnv>;
/** The GitHub App's id and private key. */
export type GithubAppEnv = z.output<typeof GITHUB_APP.schema>;
/** The Supabase pair. */
export type SupabaseEnv = z.output<typeof SUPABASE.schema>;
/** OpenRouter's key and model. */
export type OpenRouterEnv = z.output<typeof OPENROUTER.schema>;

/** The environment this process was started with: the one read of `process.env`, when a route loads. */
export function processEnv(): EnvSource {
  return process.env;
}
