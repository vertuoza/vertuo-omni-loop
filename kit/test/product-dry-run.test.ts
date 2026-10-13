// PRD 1548, slice s12 (acceptance 11): `/omni:ultra-yolo`, `/omni:ultra-wave`, `/omni:ultra-yolo-fix`,
// `/omni:do-work --target`, `/omni:mega-drive` and `/omni:mega-pr-care` run a product PRD. Each skill's
// text names the product path; then one dry run walks it through `main()` on a fixture checkout of a
// product's repository, against a fake Omni page (the dossier, approval, phase-0 and outbox routes) and
// a fake GitHub: a product PRD created, approved, its plan taken through `omni dossier get`, two target
// PRs saying `Part of mobile-12`, an item relayed to the server, an answer, the gate green, the targets
// marked ready, and no pull request in a plan repository. Every command the dry run types is one the
// skills' product sections spell out, placeholders filled, so the prose cannot drift from what runs.
// The held and drifted runs read the lines the skills park and refuse on. Nothing calls the network.
import { createHash } from 'node:crypto';
import type { ExecFileSyncOptions } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { main } from '../bin/omni.ts';
import type { Fetch } from '../lib/ask/client.ts';
import { propertyOf } from '../lib/narrow.ts';
import { fakeOutboxRoutes } from './fake-outbox-routes.ts';
import { makeRepo, realExec } from './fixture.ts';
import type { FetchInit } from './fixture.ts';

const BASE = 'https://omni.test';
const HOST = 'omni.test';
const LINK = `${BASE}/prd/d-12`;
const AT = '2026-10-11T12:00:00.000Z';
const CONFIG = `kit: 1\nrepo:\n  slug: acme/backend\nask:\n  url: ${BASE}\ndossier:\n  enabled: true\n`;
const TARGETS = ['acme/backend', 'acme/frontend'];

const SKILLS = ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'do-work', 'mega-drive', 'mega-pr-care'] as const;
const read = (skill: string) => readFileSync(new URL(`../plugin/skills/${skill}/SKILL.md`, import.meta.url), 'utf8');

/** A text with each run of whitespace made one space: prose wraps its lines anywhere. */
const flat = (text: string) => text.replace(/\s+/g, ' ');

/** The section whose `## ` heading starts with `start`, up to the next `## ` heading outside a fence. */
function section(text: string, start: string) {
  const lines = text.split('\n');
  let fenced = false;
  let from = -1;
  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      if (from >= 0) return lines.slice(from, index).join('\n');
      if (line.startsWith(`## ${start}`)) from = index;
    }
  }
  return from < 0 ? '' : lines.slice(from).join('\n');
}

/** do-work's product path: its **A product PRD** bullet of **Under `--target <name>`**. */
function doWorkProduct(text: string) {
  const under = section(text, 'Under `--target <name>`');
  const from = under.indexOf('- **A product PRD**');
  return from < 0 ? '' : under.slice(from, under.indexOf('\n- **The result**', from));
}

/** Each skill's product path, flattened. */
const PRODUCT: Record<(typeof SKILLS)[number], string> = Object.fromEntries(
  SKILLS.map((skill) => [skill, flat(skill === 'do-work' ? doWorkProduct(read(skill)) : section(read(skill), 'From a product'))]),
) as Record<(typeof SKILLS)[number], string>;
/** Every command the product path spells out: the six skills', and `/omni:mega-brainstorm`'s that creates the PRD. */
const SPELLED = [...Object.values(PRODUCT), flat(section(read('mega-brainstorm'), 'From a product'))].join('\n');

const description = (skill: string) => /^description: (.*)$/m.exec(read(skill))?.[1] ?? '';

describe('each skill names the product path (PRD 1548 s12)', () => {
  it.each(SKILLS)('%s takes a product PRD id in its description, and gives it a product section', (skill) => {
    expect(description(skill)).toContain('<key>-<n>');
    expect(PRODUCT[skill]).toMatch(/any (kitted )?checkout of a repository the product holds/);
  });

  it.each(['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'mega-pr-care'] as const)('%s turns to the product section at step 0, a plan section or not', (skill) => {
    expect(flat(section(read(skill), 'Step 0'))).toMatch(/Given a product PRD's id \(`<key>-<n>`, as `mobile-12`\), follow \*\*From a product\*\* below from here on, a plan section or not/);
  });

  it('keeps every plan-repository path as it was', () => {
    expect(flat(section(read('ultra-yolo'), 'Step 0'))).toContain('not a plan repository: /omni:yolo <n> builds a PRD of this repository');
    expect(flat(section(read('ultra-wave'), 'Step 0'))).toContain('PRD <prd> is an ordinary PRD: /omni:wave <prd>');
    expect(flat(read('mega-drive'))).toContain('not a plan repository: /omni:drive [<n>…] [--roadmap <n>] (in Claude: /loop /omni:drive)');
    expect(flat(read('mega-pr-care'))).toContain('not a plan repository: /omni:pr-care <n>');
  });

  it('ultra-yolo waits on approval, parks on held, refuses on drifted, and marks the targets ready on a green gate with no plan PR', () => {
    const text = PRODUCT['ultra-yolo'];
    expect(text).toContain('**it waits on approval.**');
    expect(text).toContain('**refuse:** stop on its `approval:` lines');
    expect(text).toContain('**park on held:** stop on `server unreachable · held, not failed`');
    expect(text).toContain('Part of <key>-<n> · <page link>');
    expect(text).toContain('no plan PR');
    expect(text).toContain('**This is the only place a product PRD\'s target feature PR is marked ready,** and nothing in any plan repository is opened, edited or marked ready');
    expect(text).toContain('Item 5 waits for the gate');
  });

  it.each(['ultra-wave', 'ultra-yolo-fix'] as const)('%s refuses while drifted and parks while held', (skill) => {
    expect(PRODUCT[skill]).toContain('**refuses**');
    expect(PRODUCT[skill]).toContain('**parks');
    expect(PRODUCT[skill]).toContain('server unreachable · held, not failed');
  });

  it('ultra-wave and do-work take the plan through omni dossier get and send every item to the server', () => {
    expect(PRODUCT['ultra-wave']).toContain('node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan');
    expect(PRODUCT['ultra-wave']).toContain('node .omni-loop/bin/omni.mjs item relay <out> --prd <key>-<n>');
    expect(PRODUCT['do-work']).toContain('node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan');
    expect(PRODUCT['do-work']).toContain('node .omni-loop/bin/omni.mjs item new --prd <key>-<n> --slice <id> --file <file> --out <scratch dir> --json');
  });

  it('mega-drive parks a PRD waiting for approval or drifted, waits while held, and launches ultra-yolo once approved', () => {
    const text = PRODUCT['mega-drive'];
    expect(text).toContain('waits on a reviewer: the PRD waits for approval on its page');
    expect(text).toContain('no step is launched while it is drifted');
    expect(text).toContain('a `wait`, never a park and never a failure');
    expect(text).toContain('`/omni:ultra-yolo <key>-<n>`');
  });

  it('mega-pr-care looks after the Part of target PRs, reading both checks from the server, with no plan PR', () => {
    const text = PRODUCT['mega-pr-care'];
    expect(text).toContain('`Part of <key>-<n> · <page link>`');
    expect(text).toContain('**`omni/approved`**');
    expect(text).toContain('`0 open · one gate on <product>`');
    expect(text).toContain('there is no plan PR');
  });
});

/** One stored version of a dossier file. */
type Version = { version: number; content: string; sha256: string };
type Void = { pusher: string; kind: string; from: string; to: string; voidedAt: string };
type Approval = { approver: { login: string; member: boolean }; approvedAt: string; files: { kind: string; path: string; sha256: string; versionId: string }[]; voids: Void[] };

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** A fake Omni page holding Mobile's product PRDs: the dossier routes, the approval route, each repository's
 * phase-0 flag and the outbox routes (`fake-outbox-routes.ts`). A push that changes a pinned file voids the
 * approval, as the server does; with `down` set, every call fails as an unreachable server does. */
function fakeOmni() {
  const outbox = fakeOutboxRoutes({ prds: ['mobile-12'] });
  const files = new Map<string, Version[]>();
  const state: { seq: number; approval: Approval | null; down: boolean } = { seq: 12, approval: null, down: false };
  const latest = (kind: string) => files.get(kind)?.at(-1);

  /** Keeps `content` as `kind`'s next version, or null when it is the latest already; changing a pinned file
   * voids the approval. */
  function keep(kind: string, content: string): number | null {
    const before = latest(kind);
    if (before?.content === content) return null;
    const version = { version: (before?.version ?? 0) + 1, content, sha256: sha(content) };
    files.set(kind, [...(files.get(kind) ?? []), version]);
    const pinned = state.approval?.files.find((file) => file.kind === kind);
    if (pinned) state.approval?.voids.push({ pusher: 'bob', kind, from: pinned.sha256, to: version.sha256, voidedAt: AT });
    return version.version;
  }

  function push(body: unknown): Response {
    const artifacts = z.array(z.object({ kind: z.string(), content: z.string() })).parse(propertyOf(body, 'artifacts'));
    const kept = artifacts.map(({ kind, content }) => ({ kind, version: keep(kind, content) }));
    const added = kept.filter(({ version }) => version !== null);
    const unchanged = kept.filter(({ version }) => version === null).map(({ kind }) => kind);
    return answer(200, { id: 'd-12', prdId: `mobile-${state.seq}`, url: LINK, added, unchanged, product: 'Mobile' });
  }

  function get(kind: string): Response {
    const kept = latest(kind);
    if (!kept) return answer(404, { error: `PRD mobile-12 has no ${kind} yet.` });
    return answer(200, { id: 'd-12', prdId: 'mobile-12', url: LINK, kind, ...kept, createdAt: AT });
  }

  /** Each route the dry run calls, by `<method> <path>`. */
  const routes: Record<string, (url: URL, body: unknown) => Response> = {
    'POST /api/dossiers/push': (_url, body) => push(body),
    'GET /api/dossiers/approval': () => answer(200, { url: LINK, approval: state.approval }),
    'GET /api/repositories/phase0': () => answer(200, { phase0: 'server' }),
    'GET /api/dossiers/get': (url) => get(url.searchParams.get('kind') ?? ''),
    'GET /api/dossiers': () => answer(200, { id: 'd-12', url: LINK, prdId: 'mobile-12', title: 'Offline photo upload', product: 'Mobile', approval: state.approval }),
  };
  const reply = (method: string, url: URL, body: unknown): Response =>
    (routes[`${method} ${url.pathname}`] ?? (() => answer(404, { error: `no route ${method} ${url.pathname}` })))(url, body);

  const fetch = (target: string, init: FetchInit): Promise<Response> => {
    if (state.down) return Promise.reject(new TypeError('fetch failed'));
    const url = new URL(target);
    if (url.pathname.startsWith('/api/outbox/')) return (outbox.fetch as unknown as (t: string, i: FetchInit) => Promise<Response>)(target, init);
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    return Promise.resolve(reply(init.method ?? 'GET', url, body));
  };

  return {
    fetch: fetch as unknown as Fetch,
    outbox,
    /** An approver of Mobile approves the PRD on its page, pinning every file as it is today. */
    approve: () => {
      state.approval = {
        approver: { login: 'ada', member: true }, approvedAt: '2026-10-11T09:30:00.000Z', voids: [],
        files: [...files].map(([kind, versions]) => ({ kind, path: `${kind}.md`, sha256: versions.at(-1)?.sha256 ?? '', versionId: `v-${kind}` })),
      };
    },
    setDown: (down: boolean) => { state.down = down; outbox.setDown(down); },
  };
}

/** One pull request of the fake GitHub. */
type Pr = { repo: string; number: number; base: string; head: string; body: string; draft: boolean };

/** A fake `gh` that opens and readies pull requests and records every call; `git` runs for real. */
function fakeGitHub() {
  const prs: Pr[] = [];
  const calls: { args: readonly string[]; repo: string }[] = [];
  const flag = (args: readonly string[], name: string) => String(args[args.indexOf(name) + 1]);
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
    if (file !== 'gh') return realExec(file, args, options);
    calls.push({ args, repo: args.includes('--repo') ? flag(args, '--repo') : '' });
    const verb = args.slice(0, 2).join(' ');
    if (verb === 'pr create') {
      const pr = { repo: flag(args, '--repo'), number: 40 + prs.length, base: flag(args, '--base'), head: flag(args, '--head'), body: readFileSync(flag(args, '--body-file'), 'utf8'), draft: args.includes('--draft') };
      prs.push(pr);
      return `https://github.com/${pr.repo}/pull/${pr.number}\n`;
    }
    if (verb === 'pr ready') {
      const pr = prs.find((kept) => kept.repo === flag(args, '--repo') && kept.number === Number(args[2]));
      if (!pr) throw new Error(`no pull request ${String(args[2])}`);
      pr.draft = false;
      return '';
    }
    if (verb === 'repo view') return 'main\n';
    return '[]';
  };
  return { exec, prs, calls };
}

const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

/** A kitted checkout of acme/backend, a repository Mobile holds, with no plan section, a fake Omni page and
 * a fake GitHub; `type` runs a command a skill's product path spells out, its placeholders filled. */
function world() {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });
  const omni = fakeOmni();
  const github = fakeGitHub();
  const scratch = mkdtempSync(join(tmpdir(), 'product-dry-run-'));
  const type = async (spelled: string, fills: Record<string, string> = {}) => {
    expect(SPELLED, `a skill spells out: ${spelled}`).toContain(spelled);
    const typed = Object.entries(fills).reduce((line, [hole, value]) => line.split(hole).join(value), spelled);
    expect(typed, `every placeholder of ${spelled} is filled`).not.toMatch(/<[a-z][^>]*>/);
    const argv = typed.split(' ');
    if (argv[0] === 'gh') return { code: 0, out: github.exec('gh', argv.slice(1)), err: '' };
    expect(argv.slice(0, 2)).toEqual(['node', '.omni-loop/bin/omni.mjs']);
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv.slice(2), {
      cwd: repo.root, exec: github.exec, env: {}, tokens: signedIn, fetch: omni.fetch, scratch,
      // `omni product` takes its clock as a Date, every other verb here as epoch milliseconds.
      now: argv[2] === 'product' ? () => new Date(AT) : () => Date.parse(AT),
      stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
    });
    return { code, out: out.join(''), err: err.join('') };
  };
  const file = (name: string, text: string) => {
    const dir = mkdtempSync(join(scratch, 'in-'));
    writeFileSync(join(dir, name), text);
    return { dir, path: join(dir, name) };
  };
  return { repo, omni, github, scratch, type, file };
}

const SPEC = '---\ntitle: Offline photo upload\nphase0: server\n---\n\n# Offline photo upload\n';
const PLAN = [
  '# Plan: offline photo upload',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| backend | back-end | abc | own |',
  '| frontend | front-end | abc | own |',
  '',
  '## Slices',
  '',
  '| id | repo | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- | --- |',
  '| s1 | backend | Upload queue | `api/` | — | 1 |',
  '| s2 | frontend | Offline badge | `app/` | s1 | 2 |',
  '',
].join('\n');

const ITEM = {
  slug: 'retry-window', wave: 1, raised: '2026-10-11', hardToRevert: true,
  questionPlain: 'How long should a photo wait for the network before the upload is retried?',
  decisionPlain: 'A photo waits thirty seconds before the next try, which keeps the battery calm.',
  introFun: 'A photo waits in line for a signal, patient as a cat at a door.',
  punchlineFun: 'Thirty seconds felt like a polite amount of staring.',
  decide: 'How long the upload queue waits before trying again.', meanwhile: 'Thirty seconds, one constant.', cost: 'One constant.',
  gaps: ['whether thirty seconds matches the field reports'],
  options: ['Wait thirty seconds, the option built.', 'Wait five seconds, so photos land sooner.'],
};

/** The PRD created from a checkout of acme/backend and approved on its page: its id and page link. */
async function approvedPrd(w: ReturnType<typeof world>) {
  expect(await w.type('node .omni-loop/bin/omni.mjs product use <key>', { '<key>': 'mobile' })).toEqual({ code: 0, out: 'product mobile remembered in this checkout\n', err: '' });
  const folder = w.file('spec.md', SPEC);
  writeFileSync(join(folder.dir, 'plan.md'), PLAN);
  const created = await w.type('node .omni-loop/bin/omni.mjs dossier push --product <key> --new --from <prd folder>', { '<key>': 'mobile', '<prd folder>': folder.dir });
  expect(created).toMatchObject({ code: 0, err: '' });
  const [id = '', link = ''] = created.out.split('\n');
  expect([id, link]).toEqual(['mobile-12', LINK]);

  const waiting = await w.type('node .omni-loop/bin/omni.mjs prd <key>-<n>', { '<key>-<n>': id });
  expect(waiting.out).toContain('state: prd\nbirthplace: server\napproval: PRD mobile-12 waits for approval: https://omni.test/prd/d-12\n');
  w.omni.approve();
  const approved = await w.type('node .omni-loop/bin/omni.mjs prd <key>-<n>', { '<key>-<n>': id });
  expect(approved.out).toContain('state: inbox\nbirthplace: server\napproval: approved by ada');
  expect(approved.out).toContain(`page: ${LINK}`);
  return { id, link, folder };
}

describe('/omni:ultra-yolo mobile-12, a dry run through main() (acceptance 11)', () => {
  it('builds a product PRD to two ready target PRs on a green gate, opening no PR in a plan repository', async () => {
    const w = world();
    const { id, link } = await approvedPrd(w);

    const got = await w.type('node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan', { '<key>-<n>': id });
    expect(got.code).toBe(0);
    const [planPath = '', hash] = got.out.trimEnd().split('\n');
    expect(readFileSync(planPath, 'utf8')).toBe(PLAN);
    expect(hash).toBe(`sha256 ${sha(PLAN)}`);
    expect(await w.type('node .omni-loop/bin/omni.mjs product phase0 <slug>…', { '<slug>…': TARGETS.join(' ') })).toMatchObject({
      code: 0, out: 'acme/backend is phase0: server\nacme/frontend is phase0: server\n',
    });

    const partOf = 'Part of <key>-<n> · <page link>'.replace('<key>-<n>', id).replace('<page link>', link);
    for (const slug of TARGETS) {
      const body = w.file('body.md', `${partOf}\n\n## Slices\n`);
      await w.type('gh pr create --repo <slug> --draft --base <target default branch> --head <feature branch> --body-file <file>', {
        '<slug>': slug, '<target default branch>': 'main', '<feature branch>': `feat/${id}`, '<file>': body.path,
      });
    }
    expect(w.github.prs.map(({ repo, body, draft }) => ({ repo, first: body.split('\n')[0], draft }))).toEqual(TARGETS.map((repo) => ({ repo, first: `Part of mobile-12 · ${LINK}`, draft: true })));

    const out = mkdtempSync(join(w.scratch, 'out-'));
    const raised = await w.type('node .omni-loop/bin/omni.mjs item new --prd <key>-<n> --slice <id> --file <file> --out <scratch dir> --json', {
      '<key>-<n>': id, '<id>': 's1', '<file>': w.file('item.json', JSON.stringify(ITEM)).path, '<scratch dir>': out,
    });
    expect(JSON.parse(raised.out)).toMatchObject({ outcome: 'record', rank: 'high', id: 's1-01-retry-window' });
    expect(w.omni.outbox.rows(id)).toEqual([]);
    const relayed = await w.type('node .omni-loop/bin/omni.mjs item relay <out> --prd <key>-<n>', { '<out>': out, '<key>-<n>': id });
    expect(relayed).toMatchObject({ code: 0, out: `moved ${join(out, 's1-01-retry-window.md')} → mobile-12/s1-01-retry-window\n` });
    expect(w.omni.outbox.rows(id).map((row) => [row.item, row.settlement])).toEqual([['s1-01-retry-window', null]]);

    const red = await w.type('node .omni-loop/bin/omni.mjs status <key>-<n>', { '<key>-<n>': id });
    expect(red.code).toBe(1);
    expect(red.out).toContain('1 open item(s)');
    expect(w.github.prs.every((pr) => pr.draft)).toBe(true);

    const asked = await w.type('node .omni-loop/bin/omni.mjs answers ask <key>-<n>', { '<key>-<n>': id });
    expect(asked.out).toContain('Q1 · high (s1-01-retry-window)');
    const picks = w.file('picks.json', JSON.stringify([{ number: 1, pick: 'A', reason: 'thirty seconds is right' }]));
    const posted = await w.type('node .omni-loop/bin/omni.mjs answers post --prd <key>-<n> --answers <file>', { '<key>-<n>': id, '<file>': picks.path });
    expect(posted).toMatchObject({ code: 0, out: '1: s1-01-retry-window settled as "agreed"\n' });

    expect(await w.type('node .omni-loop/bin/omni.mjs status <key>-<n>', { '<key>-<n>': id })).toMatchObject({ code: 0, out: 'outbox-status — PRD mobile-12: no open item.\n' });
    for (const pr of [...w.github.prs]) await w.type('gh pr ready <n> --repo <slug>', { '<n>': String(pr.number), '<slug>': pr.repo });

    expect(w.github.prs.map(({ repo, draft }) => ({ repo, draft }))).toEqual(TARGETS.map((repo) => ({ repo, draft: false })));
    expect(w.github.calls.map(({ args, repo }) => `${args.slice(0, 2).join(' ')} ${repo}`)).toEqual([
      'pr create acme/backend', 'pr create acme/frontend', 'pr ready acme/backend', 'pr ready acme/frontend',
    ]);
    expect(existsSync(join(w.repo.root, '.omni-loop/delivery'))).toBe(false);
    expect(realExec('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: w.repo.root, encoding: 'utf8' })).toBe('');
  });

  it('parks on held while the server is unreachable: the approval, the plan, the relay and the gate all hold', async () => {
    const w = world();
    const { id } = await approvedPrd(w);
    w.omni.setDown(true);
    const prd = await w.type('node .omni-loop/bin/omni.mjs prd <key>-<n>', { '<key>-<n>': id });
    expect(prd.out).toBe('PRD mobile-12\nstate: unreachable\nbirthplace: server\napproval: server unreachable · held, not failed\n');
    expect(PRODUCT['ultra-yolo']).toContain('`unreachable` | **park on held:** stop on `server unreachable · held, not failed`');
    expect(await w.type('node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan', { '<key>-<n>': id })).toMatchObject({ code: 1, err: 'held · server unreachable · held, not failed\n' });
    const gate = await w.type('node .omni-loop/bin/omni.mjs status <key>-<n>', { '<key>-<n>': id });
    expect(gate.code).toBe(1);
    expect(gate.err).toMatch(/held · server unreachable since \S+ · held, not failed/);
    expect(PRODUCT['ultra-yolo']).toContain('**Held** (`held · server unreachable since <time> · held, not failed`): every target PR stays draft');
    expect(w.github.calls).toEqual([]);
  });

  it('refuses while the PRD is drifted: a push that changes the approved plan voids its approval', async () => {
    const w = world();
    const { id } = await approvedPrd(w);
    const edited = w.file('plan.md', `${PLAN}\nOne more line.\n`);
    expect((await w.type('node .omni-loop/bin/omni.mjs dossier push <key>-<n> --from <prd folder>', { '<key>-<n>': id, '<prd folder>': edited.dir })).code).toBe(0);
    const prd = await w.type('node .omni-loop/bin/omni.mjs prd <key>-<n>', { '<key>-<n>': id });
    expect(prd.out).toContain('state: drifted\n');
    expect(prd.out).toMatch(/approval: ≠ plan\.md · voided by bob's push [0-9a-f]{7}→[0-9a-f]{7} · ✗ refuse · approve again: https:\/\/omni\.test\/prd\/d-12\n/);
    expect(PRODUCT['ultra-yolo']).toContain('`drifted` | **refuse:** stop on its `approval:` lines (`≠ <file> · voided by <login>\'s push … · ✗ refuse · approve again: <link>`)');
    expect(PRODUCT['ultra-wave']).toContain('`state: drifted` **refuses** the wave: no slice is claimed');
    expect(w.github.calls).toEqual([]);
  });
});
