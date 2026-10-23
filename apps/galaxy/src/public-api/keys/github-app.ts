import 'server-only';
import { z } from 'zod';
import { appJwt, REPO, type AppCredentials } from '../../signup/github-app';

// An API key's GitHub App, as GitHub sees it (PRD 2433 s4): the three calls the server makes with the
// App's own JWT, each behind an injected fetch so no test reaches GitHub (architecture › Boundaries,
// ADR-0095).
//
//   checkApp(pair)                         GET /app for the slug, then GET /users/<slug>[bot] for the bot's id
//   appInstallation(pair, repo)            GET /repos/{owner}/{repo}/installation: its id, owner, permissions
//   mintToken(pair, installation, repos)   POST /app/installations/{id}/access_tokens: a token for those
//                                          repositories and APP_PERMISSIONS, nothing more
//
// The pair is the App ID and its private key, which only the signing here ever reads. Nothing this module
// says (a result's detail, an error's message) carries the private key or a token: a failure names the
// status and the path, never GitHub's own words, which could echo a request (L-GDPR-2).

export type { AppCredentials };

const GITHUB = 'https://api.github.com';
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;
/** A slug as the database keeps it (api_key_github_apps.slug): GitHub's own are lower-case words and dashes. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** What a job's token may do on its repositories, and nothing more (spec §6): no workflows, no admin. */
export const APP_PERMISSIONS = { contents: 'write', pull_requests: 'write', issues: 'write', metadata: 'read' } as const;

/** The permissions an installation must hold at write for a job to run as the App (spec §4). */
const WRITE_PERMISSIONS = ['contents', 'pull_requests', 'issues'] as const;
export type WritePermission = (typeof WRITE_PERMISSIONS)[number];

/** The App and its bot, as GitHub answers for a pair it accepts. */
export type AppChecked =
  | { ok: true; slug: string; botId: number }
  /** `refused`: GitHub does not know this pair. `unavailable`: it could not say (down, rate-limited, an odd answer). */
  | { ok: false; reason: 'refused' | 'unavailable'; detail: string };

/** An installation of the App: its id, the account that holds it, and what GitHub lets it do. */
export interface AppInstallation {
  id: number;
  account: string;
  permissions: Record<string, string>;
}

/** A token GitHub minted, and when it stops working (an ISO date, as GitHub writes it). */
export interface MintedToken {
  token: string;
  expiresAt: string;
}

const AppAnswer = z.object({ slug: z.string().regex(SLUG) });
const BotAnswer = z.object({ id: z.number().int().positive() });
const InstallationAnswer = z.object({
  id: z.number().int().positive(),
  account: z.object({ login: z.string().regex(LOGIN) }),
  permissions: z.record(z.string(), z.string()),
});
const TokenAnswer = z.object({ token: z.string().min(1), expires_at: z.iso.datetime({ offset: true }) });

const failure = (reason: 'refused' | 'unavailable', detail: string): AppChecked => ({ ok: false, reason, detail });
const status = (res: Response, call: string) => `GitHub answered ${res.status} to ${call}`;
const odd = (call: string) => `GitHub's answer to ${call} is not the shape it documents`;

/** The App's JWT for `creds`, or null when the key signs nothing (not a private key). */
function signed(creds: AppCredentials, now: number): string | null {
  try {
    return appJwt(creds, now);
  } catch {
    return null;
  }
}

const headers = (jwt: string) => ({ authorization: `Bearer ${jwt}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' });

/** A call to GitHub as the App: a GET, or a POST with a JSON body. */
function asApp(fetchImpl: Fetch, jwt: string, path: string, body?: unknown): Promise<Response> {
  const url = `${GITHUB}${path}`;
  if (body === undefined) return fetchImpl(url, { method: 'GET', headers: headers(jwt), cache: 'no-store' });
  return fetchImpl(url, { method: 'POST', headers: { ...headers(jwt), 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
}

/** The body of a GitHub answer, or undefined when it is no JSON. */
const bodyOf = (res: Response): Promise<unknown> => res.json().then((json: unknown) => json, () => undefined);

/**
 * Checks an App ID and private key against GitHub before anything is stored (spec §2): the App's JWT
 * reads `GET /app` for the slug, then `GET /users/<slug>[bot]` names the bot's id, which the commits'
 * email needs. A pair GitHub refuses (401 or 404 on `/app`), or a key that signs nothing, is `refused`;
 * anything else GitHub fails at is `unavailable`, so the owner is told to try again, not that the pair is wrong.
 */
export async function checkApp(creds: AppCredentials, fetchImpl: Fetch = fetch, clock: () => number = Date.now): Promise<AppChecked> {
  const jwt = signed(creds, clock());
  if (jwt === null) return failure('refused', 'the private key signs nothing');
  try {
    const app = await asApp(fetchImpl, jwt, '/app');
    if (app.status === 401 || app.status === 404) return failure('refused', status(app, 'GET /app'));
    if (!app.ok) return failure('unavailable', status(app, 'GET /app'));
    const named = AppAnswer.safeParse(await bodyOf(app));
    if (!named.success) return failure('unavailable', odd('GET /app'));
    const bot = `/users/${named.data.slug}[bot]`;
    const botRes = await asApp(fetchImpl, jwt, bot);
    if (!botRes.ok) return failure('unavailable', status(botRes, `GET ${bot}`));
    const botId = BotAnswer.safeParse(await bodyOf(botRes));
    if (!botId.success) return failure('unavailable', odd(`GET ${bot}`));
    return { ok: true, slug: named.data.slug, botId: botId.data.id };
  } catch (error) {
    return failure('unavailable', `GitHub could not be reached (${error instanceof Error ? error.message : 'no reason'})`);
  }
}

/** The repository's name as GitHub's own routes read it, or throws: `owner/name` and nothing else. */
function repoOf(repo: string): string {
  if (!REPO.test(repo)) throw new Error(`${JSON.stringify(repo)} is not a GitHub repository`);
  return repo;
}

/**
 * The App's installation on the repository `owner/name` (spec §4), with the permissions GitHub gives it;
 * null when the App is not installed there. Throws, naming the status, when GitHub answers an error or
 * an odd shape, or when the App's key signs nothing.
 */
export async function appInstallation(creds: AppCredentials, repo: string, fetchImpl: Fetch = fetch, clock: () => number = Date.now): Promise<AppInstallation | null> {
  const path = `/repos/${repoOf(repo)}/installation`;
  const jwt = signed(creds, clock());
  if (jwt === null) throw new Error('The App\'s private key signs nothing');
  const res = await asApp(fetchImpl, jwt, path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(status(res, `GET ${path}`));
  const parsed = InstallationAnswer.safeParse(await bodyOf(res));
  if (!parsed.success) throw new Error(odd(`GET ${path}`));
  return { id: parsed.data.id, account: parsed.data.account.login, permissions: parsed.data.permissions };
}

/** The first of contents, pull_requests and issues the installation does not hold at write (admin counts), or null. */
export function missingPermission(installation: Pick<AppInstallation, 'permissions'>): WritePermission | null {
  const held = (level: string | undefined) => level === 'write' || level === 'admin';
  return WRITE_PERMISSIONS.find((permission) => !held(installation.permissions[permission])) ?? null;
}

/**
 * A token for `repositories` (`owner/name`) on `installation`, with exactly APP_PERMISSIONS (spec §6).
 * Throws, naming the status, when GitHub answers an error or an odd shape. It refuses before asking:
 * - no repository, which GitHub reads as every repository of the installation;
 * - a repository whose owner is not the installation's account, since GitHub takes only names and would
 *   look each one up in the account that holds the installation, giving access to a namesake.
 */
export async function mintToken(
  creds: AppCredentials, installation: Pick<AppInstallation, 'id' | 'account'>, repositories: readonly string[],
  fetchImpl: Fetch = fetch, clock: () => number = Date.now,
): Promise<MintedToken> {
  const names = new Map<string, string>();
  for (const repo of repositories) {
    const [owner = '', name = ''] = repoOf(repo).split('/');
    if (owner.toLowerCase() !== installation.account.toLowerCase()) throw new Error(`${repo} is not a repository of ${installation.account}`);
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  if (names.size === 0) throw new Error('A token needs at least one repository');
  const path = `/app/installations/${installation.id}/access_tokens`;
  const jwt = signed(creds, clock());
  if (jwt === null) throw new Error('The App\'s private key signs nothing');
  const res = await asApp(fetchImpl, jwt, path, { repositories: [...names.values()], permissions: APP_PERMISSIONS });
  if (!res.ok) throw new Error(status(res, `POST ${path}`));
  const parsed = TokenAnswer.safeParse(await bodyOf(res));
  if (!parsed.success) throw new Error(odd(`POST ${path}`));
  return { token: parsed.data.token, expiresAt: parsed.data.expires_at };
}
