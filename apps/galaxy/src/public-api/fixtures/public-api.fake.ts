import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { runnersService } from '../../runners/runners.service';
import { API_KEY, fakeStore, OLGA, OTHER_KEY, T0, WORKSPACE } from '../../runners/fixtures/store.fake';
import { stubGithub } from '../../runners/fixtures/github.fake';
import { hashApiKey } from '../keys/secret';
import { notifier } from '../notify';
import type { PRD_STAGES } from '../public-api.contract';
import type { DossierPage, DossierRow, KeyGithubApp, KeyRow, ListedKind, ProductRow, PublicApiRepository, StageRow } from '../public-api.repository';

// The public API's storage in memory (PRD 2022 s2), for the service's and the controller's tests: the
// rows of public.dossiers, public.products and public.prd_stages, read as the repository reads them
// (the workspace, the kind, numbered only, the allow-list, the keyset, newest first), and api_key_of()
// as supabase/migrations/20261210090000_api_keys.sql answers it: only a live `api` key whose maker is
// still a member of its workspace. Two workspaces: Northwind (northwind/backend, northwind/web) and
// Southwind (southwind/backend). Ada made Northwind's keys and is still a member; Ben made one and left.
// A product's plan repository (products.plan_repository) is added by `planRepository`; there is none at first.
// A key's GitHub App (PRD 2433 s6), as the repository reads it for a send, is added by `githubApp`; no key holds one at first.

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
export const SOUTHWIND = '22222222-2222-4222-8222-222222222222';
export const ADA = '00000000-0000-4000-8000-0000000000a1';
export const BEN = '00000000-0000-4000-8000-0000000000b1';
export const DAN = '00000000-0000-4000-8000-0000000000d1';

/** A secret of the key's shape: `oma_` and 43 base64url characters. */
const secret = (tag: string) => `oma_${tag.padEnd(43, 'x')}`;

/** Each key's secret, as a program sends it. */
export const SECRETS = {
  /** Northwind's, every repository. */
  all: secret('northwindAll'),
  /** Northwind's, northwind/backend only. */
  backend: secret('northwindBackend'),
  /** Northwind's, revoked. */
  revoked: secret('northwindRevoked'),
  /** Northwind's, made by Ben, who left. */
  orphaned: secret('northwindOrphaned'),
  /** Southwind's, every repository. */
  south: secret('southwindAll'),
  /** The runners' workspace's (demo-org/app, demo-org/other), made by its owner Olga: it starts and follows jobs. */
  runners: secret('runnersAll'),
  /** The same workspace's, limited to demo-org/other. */
  runnersLimited: secret('runnersLimited'),
  /** The same workspace's second key, every repository (PRD 2425): it reads the jobs the first sent. */
  runnersOther: secret('runnersOther'),
  /** Shaped as a key, but no key's. */
  unknown: secret('nobody'),
} as const;

type StoredKey = { secret: string; row: KeyRow; revoked: boolean; makerLeft: boolean };

const KEYS: StoredKey[] = [
  { secret: SECRETS.all, row: { key_id: 'k-all', workspace_id: NORTHWIND, repos: [], made_by: ADA, name: 'QA dashboard' }, revoked: false, makerLeft: false },
  { secret: SECRETS.backend, row: { key_id: 'k-backend', workspace_id: NORTHWIND, repos: ['northwind/backend'], made_by: ADA, name: 'Backend bot' }, revoked: false, makerLeft: false },
  { secret: SECRETS.revoked, row: { key_id: 'k-revoked', workspace_id: NORTHWIND, repos: [], made_by: ADA, name: 'Leaked' }, revoked: true, makerLeft: false },
  { secret: SECRETS.orphaned, row: { key_id: 'k-orphaned', workspace_id: NORTHWIND, repos: [], made_by: BEN, name: 'Ben’s tool' }, revoked: false, makerLeft: true },
  { secret: SECRETS.runners, row: { key_id: API_KEY, workspace_id: WORKSPACE, repos: [], made_by: OLGA, name: 'QA dashboard' }, revoked: false, makerLeft: false },
  { secret: SECRETS.runnersLimited, row: { key_id: 'k-runners-limited', workspace_id: WORKSPACE, repos: ['demo-org/other'], made_by: OLGA, name: 'Limited' }, revoked: false, makerLeft: false },
  { secret: SECRETS.runnersOther, row: { key_id: OTHER_KEY, workspace_id: WORKSPACE, repos: [], made_by: OLGA, name: 'Support bot' }, revoked: false, makerLeft: false },
  { secret: SECRETS.south, row: { key_id: 'k-south', workspace_id: SOUTHWIND, repos: [], made_by: DAN, name: 'South tool' }, revoked: false, makerLeft: false },
];

/** A dossier as the table holds it, with the columns the lists filter on. */
export type FakeDossier = DossierRow & { workspace: string; kind: ListedKind | 'visual' | 'concept'; numbered: boolean };

type FakeStage = StageRow & { workspace: string };
type FakeProduct = ProductRow & { workspace: string };

/** The n-th moment of the fixture's clock, as PostgREST writes a timestamptz: microseconds and an offset. */
export function momentOf(n: number): string {
  const at = new Date(Date.UTC(2026, 9, 1) + n * 1000).toISOString().slice(0, 19);
  return `${at}.${String(n % 1_000_000).padStart(6, '0')}+00:00`;
}

/** The n-th dossier id. */
export const dossierId = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** Newest first: by created_at, then id, both descending. */
const newestFirst = (a: DossierRow, b: DossierRow) =>
  a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1;

const isAfter = (row: DossierRow, after: NonNullable<DossierPage['after']>) =>
  row.created_at < after.createdAt || (row.created_at === after.createdAt && row.id < after.id);

export function fakePublicApi() {
  const dossiers: FakeDossier[] = [];
  const products: FakeProduct[] = [];
  const stages: FakeStage[] = [];
  const plans: { workspace: string; repository: string }[] = [];
  const apps = new Map<string, KeyGithubApp>();
  const calls: string[] = [];
  let made = 0;

  /** Adds a dossier, the next on the clock unless `created_at` says otherwise. */
  const add = (row: Partial<FakeDossier> & Pick<FakeDossier, 'workspace' | 'kind'>): FakeDossier => {
    made += 1;
    const dossier: FakeDossier = {
      id: dossierId(made), prd: null, product_seq: null, product_id: null, title: `Dossier ${made}`, home_repo: null,
      created_at: momentOf(made), numbered: true, ...row,
    };
    dossiers.push(dossier);
    return dossier;
  };

  // The runners' own rules over their own fake store: what a key starts and follows a job with, and the live
  // lines (PRD 1904) the lines route reads.
  const { store, state: runnersState } = fakeStore();

  // The link a job pings (PRD 2425 s8): the real notifier over a fake network. A name resolves through `hosts` (an unknown one does
  // not resolve), a post is recorded in `posts` and answers `answer.status`, and the hand-over to "after the response" waits for
  // `flushPings()`, as Next's after() does. Nothing here reaches the network.
  const hosts = new Map<string, string[]>([
    ['hooks.example.com', ['93.184.216.34']],
    ['intranet.example.com', ['10.1.2.3']],
    ['loopback.example.com', ['127.0.0.1']],
  ]);
  const posts: { url: string; address: string; body: string }[] = [];
  const pingLogs: string[] = [];
  const answer = { status: 200 };
  const pending: (() => Promise<void>)[] = [];
  const pinger = notifier({
    net: {
      resolve: (host) => {
        const found = hosts.get(host);
        return found === undefined ? Promise.reject(new Error('ENOTFOUND')) : Promise.resolve(found);
      },
      fetch: ({ url, address, body }) => {
        posts.push({ url, address, body });
        return Promise.resolve(answer.status);
      },
    },
    sleep: () => Promise.resolve(),
    timer: () => () => undefined,
    log: (line) => { pingLogs.push(line); },
    later: (task) => { pending.push(task); },
  });
  const flushPings = async (): Promise<void> => {
    for (let task = pending.shift(); task !== undefined; task = pending.shift()) await task();
  };
  // A job a runner claims runs as the Omni App (PRD 2573): with none, it would end failed at its claim.
  const runners = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps, pinger);

  const repository: PublicApiRepository = {
    async keyOf(hash) {
      calls.push('keyOf');
      for (const key of KEYS) {
        if (!key.revoked && !key.makerLeft && (await hashApiKey(key.secret)) === hash) return key.row;
      }
      return null;
    },
    dossiers(page) {
      calls.push('dossiers');
      return Promise.resolve(dossiers
        .filter((d) => d.workspace === page.workspace && d.kind === page.kind && d.numbered)
        .filter((d) => page.repos.length === 0 || (d.home_repo !== null && page.repos.includes(d.home_repo)))
        .filter((d) => page.after === null || isAfter(d, page.after))
        .sort(newestFirst)
        .slice(0, page.take)
        .map(({ id, prd, product_seq, product_id, title, home_repo, created_at }) => ({ id, prd, product_seq, product_id, title, home_repo, created_at })));
    },
    jobLines(page) {
      calls.push('jobLines');
      return Promise.resolve(runnersState.lines
        .filter((row) => row.workspace_id === page.workspace && row.job_id === page.job && row.seq > page.after)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, page.take)
        .map(({ seq, text }) => ({ seq, text })));
    },
    products(workspace, ids) {
      calls.push('products');
      return Promise.resolve(products.filter((p) => p.workspace === workspace && ids.includes(p.id)).map(({ id, key, name }) => ({ id, key, name })));
    },
    stages(workspace, repository, prds) {
      calls.push('stages');
      return Promise.resolve(stages
        .filter((s) => s.workspace === workspace && s.repository === repository && prds.includes(s.prd))
        .map(({ repository: repo, prd, stage }) => ({ repository: repo, prd, stage })));
    },
    isPlanRepository(workspace, repository) {
      calls.push('isPlanRepository');
      return Promise.resolve(plans.some((plan) => plan.workspace === workspace && plan.repository === repository));
    },
    githubAppOf(key) {
      calls.push('githubAppOf');
      return Promise.resolve(apps.get(key) ?? null);
    },
  };

  return {
    repository,
    runners,
    runnersState,
    dossiers,
    calls,
    /** The names the fake resolver knows (each to its addresses), the posts the notifier made, what it logged, and the status the link answers. */
    hosts,
    posts,
    pingLogs,
    answer,
    /** Runs the pings handed over since the last flush, as the response having gone. */
    flushPings,
    add,
    /** A repository PRD, numbered `n`. */
    prd: (workspace: string, repo: string, n: number, more: Partial<FakeDossier> = {}) =>
      add({ workspace, kind: 'prd', home_repo: repo, prd: parsePrd(n), title: `PRD ${n} of ${repo}`, ...more }),
    /** A bug fix, its issue `n`. */
    bug: (workspace: string, repo: string, n: number, more: Partial<FakeDossier> = {}) =>
      add({ workspace, kind: 'bug', home_repo: repo, prd: parsePrd(n), title: `Bug ${n} of ${repo}`, ...more }),
    /** A product, by its key. */
    product: (workspace: string, id: string, key: string | null, name: string) => { products.push({ workspace, id, key, name }); },
    /** A stage a PRD reached. */
    stage: (workspace: string, repository: string, prd: PrdNumber, stage: (typeof PRD_STAGES)[number]) => { stages.push({ workspace, repository, prd, stage }); },
    /** A repository a product of the workspace names as its plan repository. */
    planRepository: (workspace: string, repository: string) => { plans.push({ workspace, repository }); },
    /** A GitHub App the key `keyId` holds, its private key sealed (the fake seals nothing: no test opens it). */
    githubApp: (keyId: string, more: Partial<KeyGithubApp> = {}) => { apps.set(keyId, { appId: 123456, slug: 'acme-bot', ciphertext: 'c2VhbGVk', iv: 'aXY=', ...more }); },
  };
}

export type FakePublicApi = ReturnType<typeof fakePublicApi>;
