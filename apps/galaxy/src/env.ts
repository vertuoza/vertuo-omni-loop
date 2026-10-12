/**
 * **The arcade's environment, on the server** (PRD 1059): every variable the arcade's server code, its
 * routes, its proxy and its scripts read, read here once as feature groups (the helpers are the kit's,
 * `kit/lib/env/group.ts`). A group is complete, or `null` when none of its variables is set: the
 * feature is off. A half-set group or a malformed value is one {@link EnvError} naming every variable
 * concerned and never a value, thrown by {@link readEnv}, and so at startup by `instrumentation.ts`.
 *
 * Nothing is required: with nothing set, development serves the demo and production the closed mode
 * (`./data/mode.ts`, the rule unchanged), and every optional feature is off. Each value is trimmed
 * first, so a blank one is unset, as each reader used to treat it.
 *
 * The browser's two public values are read in `./env.client.ts`, where Next inlines them.
 *
 * Plain Node loads this module (`scripts/releases-sync.ts`): it names its imports with their extension,
 * and the script resolves its `server-only` marker as the server does (`scripts/server-only.ts`).
 */
import 'server-only';
import { z } from 'zod';
import { envGroup, envReader, variablesOf, type EnvSource } from 'vertuo-omni-plan/kit/lib/env/group.ts';
import { arcadeMode } from './data/mode.ts';

/** A value that is set: trimmed, never blank. */
const secret = z.string().min(1);

/** The galaxy's database, as anyone reaches it: its address and its publishable (anon) key. */
const SUPABASE = envGroup({
  label: 'the Supabase public pair',
  schema: z.object({ url: z.url(), key: secret }),
  variables: { url: 'NEXT_PUBLIC_SUPABASE_URL', key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' },
});

/**
 * The service role, which alone writes past row-level security: its key, and the database's address
 * when the service reads it from another one than the public pair's (the season cache, the releases
 * sync).
 */
const SERVICE_ROLE = envGroup({
  label: 'the Supabase service role',
  schema: z.object({ key: secret, url: z.url().optional() }),
  variables: { key: 'SUPABASE_SERVICE_ROLE_KEY', url: 'SUPABASE_URL' },
});

/** The omni-loop GitHub App's id and private key, which sign-up and the GitHub readers sign with. */
const GITHUB_APP = envGroup({
  label: 'the GitHub App',
  schema: z.object({
    id: z.string().regex(/^\d+$/, 'a number'),
    // A key pasted on one line (`\n` escaped, as a dashboard often stores it) is turned back into lines.
    privateKey: secret.transform((key) => key.replace(/\\n/g, '\n')),
  }),
  variables: { id: 'GITHUB_APP_ID', privateKey: 'GITHUB_APP_PRIVATE_KEY' },
});

/** The App's public slug, all the install link needs. */
const GITHUB_APP_SLUG = envGroup({
  label: 'the GitHub App\'s slug',
  schema: z.object({ slug: secret }),
  variables: { slug: 'GITHUB_APP_SLUG' },
});

/** The same App's OAuth client, which Send on a PRD's Outbox tab posts the answers as the person with. */
const GITHUB_OAUTH = envGroup({
  label: 'the GitHub App\'s OAuth client',
  schema: z.object({ clientId: secret, clientSecret: secret }),
  variables: { clientId: 'GITHUB_APP_CLIENT_ID', clientSecret: 'GITHUB_APP_CLIENT_SECRET' },
});

/** OpenRouter, which sorts the ask questions, suggests rivals and drafts a business's claims. */
const OPENROUTER = envGroup({
  label: 'OpenRouter',
  schema: z.object({ key: secret }),
  variables: { key: 'OPENROUTER_API_KEY' },
});

/** One shared secret: a bearer a route checks, or the key it signs with. */
const oneSecret = (label: string, variable: string) => envGroup({
  label,
  schema: z.object({ secret }),
  variables: { secret: variable },
});

const STAGES_SYNC = oneSecret('the stages sync', 'STAGES_SYNC_SECRET');
const STAGE_EVENT = oneSecret('the stage events', 'STAGE_EVENT_SECRET');
const SECRETS_MASTER = oneSecret('Jev\'s master key', 'SECRETS_MASTER_KEY');
const CONSTITUENT_JUDGE = oneSecret('the constituent judge', 'CONSTITUENT_JUDGE_SECRET');
const LAW_JUDGE = oneSecret('the law judge', 'LAW_JUDGE_SECRET');
const BUSINESS_RECHECK = oneSecret('the business recheck', 'BUSINESS_RECHECK_SECRET');

/**
 * Web Push, which phones an approver a PRD that waits for them (PRD 1322): the VAPID pair the
 * `web-push` library signs with, each base64url, the public one also handed to the browser to subscribe.
 */
const WEB_PUSH = envGroup({
  label: 'Web Push',
  schema: z.object({
    publicKey: z.string().regex(/^[A-Za-z0-9_-]+$/, 'base64url'),
    privateKey: z.string().regex(/^[A-Za-z0-9_-]+$/, 'base64url'),
  }),
  variables: { publicKey: 'VAPID_PUBLIC_KEY', privateKey: 'VAPID_PRIVATE_KEY' },
});

/** An email address, alone or after a name: `approvals@omni-loop.xyz`, `Omni Loop <approvals@…>`. */
const SENDER = /^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

/** Resend, which emails an approver a PRD that waits for them (PRD 1322): its key, and who it sends as. */
const RESEND = envGroup({
  label: 'Resend',
  schema: z.object({ key: secret, from: z.string().regex(SENDER, 'an email address, or Name <address>') }),
  variables: { key: 'RESEND_API_KEY', from: 'RESEND_FROM' },
});

/** 32 bytes, as base64: an AES-256 key. */
const KEY_32 = z.string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64')
  .transform((value) => Buffer.from(value, 'base64'))
  .refine((key) => key.length === 32, '32 bytes of base64 (openssl rand -base64 32)');

/**
 * Kit tokens (PRD 1628): the key that seals each token's Supabase session before it is stored
 * (AES-256-GCM, `./ask/kit-token-live.ts`). Unset, a token can be neither made nor traded here.
 */
const KIT_TOKENS = envGroup({
  label: 'the kit tokens\' key',
  schema: z.object({ key: KEY_32 }),
  variables: { key: 'KIT_TOKEN_KEY' },
});

/** A build that asks for the demo by name (`OMNI_LOOP_DEMO=1`, ./data/mode.ts). */
const DEMO = envGroup({
  label: 'the demo',
  schema: z.object({ flag: secret }),
  variables: { flag: 'OMNI_LOOP_DEMO' },
});

/** Where `pnpm shots` takes its screenshots (scripts/shots.ts); localhost when unset. */
const GALAXY = envGroup({
  label: 'the screenshots\' address',
  schema: z.object({ url: z.url() }),
  variables: { url: 'GALAXY_URL' },
});

/**
 * The commit this deployment was built from, which Vercel sets on every build and function (PRD 1723):
 * `/api/health` says which commit is live. Unset off Vercel, and then the health says `null`.
 */
const VERCEL = envGroup({
  label: 'the deployed commit',
  schema: z.object({ commit: secret }),
  variables: { commit: 'VERCEL_GIT_COMMIT_SHA' },
});

/**
 * The variables a person sets for the arcade, server and browser: `.env.example` and the README's list
 * name exactly these (`src/env-docs.test.ts`).
 */
export const VARIABLES: readonly string[] = variablesOf([
  SUPABASE, SERVICE_ROLE, GITHUB_APP, GITHUB_APP_SLUG, GITHUB_OAUTH, OPENROUTER,
  STAGES_SYNC, STAGE_EVENT, SECRETS_MASTER, CONSTITUENT_JUDGE, LAW_JUDGE, BUSINESS_RECHECK, WEB_PUSH, RESEND,
  KIT_TOKENS, DEMO, GALAXY, VERCEL,
]);

/**
 * The variables Node and Next set, read here (`readEnv`, {@link nextRuntime}) but never set by a
 * person, so no docs list names them.
 */
export const PLATFORM_VARIABLES: readonly string[] = ['NODE_ENV', 'NEXT_PHASE', 'NEXT_RUNTIME'];

/** The phase Next sets while `next build` prerenders (next/constants' PHASE_PRODUCTION_BUILD). */
const PRODUCTION_BUILD = 'phase-production-build';

/** Every value of `source` trimmed, so a blank value reads as unset. */
function trimmed(source: EnvSource): EnvSource {
  return Object.fromEntries(Object.entries(source).map(([name, value]) => [name, value?.trim()]));
}

/** Every group of the arcade's server, read from `source`; throws one `EnvError` naming every problem. */
export function readEnv(raw: EnvSource) {
  const source = trimmed(raw);
  // Set by Node and Next, never by a person: the runtime's facts, read beside the groups.
  const production = source.NODE_ENV === 'production';
  const building = source.NEXT_PHASE === PRODUCTION_BUILD;
  const reader = envReader(source, { production });
  const secretOf = (group: typeof STAGES_SYNC) => reader.group(group)?.secret ?? null;
  const env = {
    production,
    building,
    supabase: reader.group(SUPABASE),
    serviceRole: reader.group(SERVICE_ROLE),
    githubApp: reader.group(GITHUB_APP),
    githubAppSlug: reader.group(GITHUB_APP_SLUG)?.slug ?? null,
    githubOAuth: reader.group(GITHUB_OAUTH),
    openrouter: reader.group(OPENROUTER),
    stagesSyncSecret: secretOf(STAGES_SYNC),
    stageEventSecret: secretOf(STAGE_EVENT),
    secretsMasterKey: secretOf(SECRETS_MASTER),
    constituentJudgeSecret: secretOf(CONSTITUENT_JUDGE),
    lawJudgeSecret: secretOf(LAW_JUDGE),
    businessRecheckSecret: secretOf(BUSINESS_RECHECK),
    webPush: reader.group(WEB_PUSH),
    resend: reader.group(RESEND),
    kitTokenKey: reader.group(KIT_TOKENS)?.key ?? null,
    demo: reader.group(DEMO)?.flag ?? null,
    galaxyUrl: reader.group(GALAXY)?.url ?? null,
    commit: reader.group(VERCEL)?.commit ?? null,
  };
  reader.done();
  return { ...env, mode: arcadeMode(source) };
}

/**
 * The deployed commit alone, read from `raw` whatever the other groups hold: the health endpoint says
 * which commit is live even when the rest of the environment does not parse.
 */
export function readCommit(raw: EnvSource): string | null {
  return envReader(trimmed(raw)).group(VERCEL)?.commit ?? null;
}

/** The arcade server's groups, as `readEnv` gives them. */
export type ArcadeEnv = ReturnType<typeof readEnv>;
/** The Supabase public pair. */
export type SupabaseEnv = z.output<typeof SUPABASE.schema>;
/** The service role's key, and its own address when set. */
export type ServiceRoleEnv = z.output<typeof SERVICE_ROLE.schema>;
/** The GitHub App's id and private key. */
export type GithubAppEnv = z.output<typeof GITHUB_APP.schema>;
/** The GitHub App's OAuth client. */
export type GithubOAuthEnv = z.output<typeof GITHUB_OAUTH.schema>;
/** OpenRouter's key. */
export type OpenRouterEnv = z.output<typeof OPENROUTER.schema>;
let parsed: ArcadeEnv | undefined;

/**
 * This server's environment: the one read of `process.env`, parsed the first time it is asked for
 * (`instrumentation.ts` asks at startup), then the same value for the server's life.
 */
export function serverEnv(): ArcadeEnv {
  parsed ??= readEnv(process.env);
  return parsed;
}

/** This deployment's commit, `VERCEL_GIT_COMMIT_SHA`, or null off Vercel. */
export function serverCommit(): string | null {
  return readCommit(process.env);
}

/** The runtime Next runs this code in: `nodejs`, `edge`, or unset outside Next (a script, a test). */
export function nextRuntime(): string | undefined {
  return process.env.NEXT_RUNTIME;
}
