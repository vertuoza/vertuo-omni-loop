// `omni roadmap check --product <key> <file>` and `omni roadmap push --product <key> (--new | --roadmap <n>)
// <file>` (PRD 2011, s2), through `main()` with a fetch that answers as `POST /api/roadmaps` does for a
// roadmap born on the server: a check answers the product's repositories, a push the roadmap's id.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import type { FetchInit } from '../test/fixture.ts';
import { main } from './omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const ROADMAP_ID = '00000000-0000-4000-8000-000000000042';
const CONFIG = { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\n` };

const tokens = () => {
  const store: Record<string, Tokens> = { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, next: Tokens) => { store[host] = next; } };
};

type Call = { url: string; body: Record<string, unknown> };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** The app: a check answers the product's repositories, a push the id the server numbered. */
function app({ check, push }: { check?: () => Response; push?: (body: Record<string, unknown>) => Response } = {}) {
  const calls: Call[] = [];
  const fetch = (url: string, init: FetchInit) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, body });
    const answer =
      body.check === true
        ? (check ?? (() => json(200, {
          checked: true, product: { key: 'mobile', name: 'Mobile' },
          repositories: [{ repo: 'app', readOnly: false, consumes: ['api'] }, { repo: 'api', readOnly: false, consumes: [] }, { repo: 'docs', readOnly: true, consumes: [] }],
        })))()
        : (push ?? (() => json(201, { roadmapId: ROADMAP_ID, dossierId: 'd', roadmap: 'mobile-R3', created: true, product: { id: 'p', name: 'Mobile' }, added: [{ kind: 'roadmap', version: 1 }, { kind: 'roadmap-prds', version: 1 }], unchanged: [] })))(body);
    return Promise.resolve(answer);
  };
  return { calls, fetch };
}

function roadmapMd(rows: string[], front = ['title: Mobile launch', 'milestone: The app ships.']): string {
  return ['---', ...front, '---', '', '## PRDs', '', '| id | PRD | title | blocked by | why | wave | repos |', '|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

const GREEN = roadmapMd([
  '| P1 | mobile-12 | Sign-in | – | – | 1 | app, api |',
  '| P2 | #912 | Receipts | P1 | needs the session | 2 | app |',
]);

async function omni(argv: string[], root: string, fetch: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, env: {}, tokens: tokens(), fetch, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

function repoWith(text: string) {
  const { root } = makeRepo({ git: true, files: CONFIG });
  writeFileSync(join(root, 'roadmap.md'), text);
  return root;
}

describe('omni roadmap check --product', () => {
  it('grades the rows against the product\'s repositories, a product PRD and a repository PRD alike', async () => {
    const root = repoWith(GREEN);
    const { calls, fetch } = app();
    const { code, out } = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], root, fetch);
    expect(code).toBe(0);
    expect(out).toContain('omni roadmap check — roadmap.md: 2 PRD(s) across 2 wave(s), for product mobile.');
    expect(out).toMatch(/^ {2}wave 1: P1 mobile-12 \(app, api\)\n {2}wave 2: P2 #912 \(app\)$/m);
    expect(out).toContain('every row, blocker and question holds, and every row names repositories of product mobile.');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: `${BASE}/api/roadmaps`, body: { productKey: 'mobile', check: true, repo: 'acme/widgets' } });
  });

  it('refuses a row naming a repository outside the product, by name', async () => {
    const root = repoWith(roadmapMd(['| P1 | mobile-12 | Sign-in | – | – | 1 | app, shop |']));
    const { code, out } = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], root, app().fetch);
    expect(code).toBe(1);
    expect(out).toContain('roadmap.md: P1: shop is not a repository of product mobile (app, api, docs).');
  });

  it('never reads plan.targets: a read-only repository of the product is refused, a consumer is held after its provider', async () => {
    const root = repoWith(roadmapMd([
      '| P1 | mobile-12 | Docs | – | – | 1 | docs |',
      '| P2 | mobile-13 | API | – | – | 1 | api |',
      '| P3 | mobile-14 | App | P2 | the app calls it | 1 | app |',
    ]));
    const { code, out } = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], root, app().fetch);
    expect(code).toBe(1);
    expect(out).toContain('P1: docs is a read-only repository — no roadmap row may name it.');
    expect(out).toContain('P3: in wave 1, but its highest blocker, P2, is in wave 1, so its wave is 2.');
  });

  it('asks for the repos column: a product has several repositories', async () => {
    const root = repoWith(['---', 'title: T', 'milestone: M', '---', '', '## PRDs', '', '| id | PRD | title | blocked by | why | wave |', '|---|---|---|---|---|---|', '| P1 | mobile-12 | Sign-in | – | – | 1 |', ''].join('\n'));
    const { code, out } = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], root, app().fetch);
    expect(code).toBe(1);
    expect(out).toContain('PRDs: the table has no "repos" column; in a product roadmap each row names its repositories.');
  });

  it('stops with one line when the repositories cannot be read, and on a file that does not parse', async () => {
    const root = repoWith(GREEN);
    const refused = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], root, app({ check: () => json(404, { error: 'No product keyed mobile in your workspaces.' }) }).fetch);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('the repositories of product mobile could not be read: refused (404): No product keyed mobile in your workspaces.');
    const bad = await omni(['roadmap', 'check', '--product', 'mobile', 'roadmap.md'], repoWith('no front matter'), app().fetch);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('no front matter');
    const missing = await omni(['roadmap', 'check', '--product', 'mobile', 'nope.md'], root, app().fetch);
    expect(missing).toMatchObject({ code: 1, err: 'nope.md cannot be read\n' });
  });

  it('refuses a bad key and the push flags, exit 2', async () => {
    const root = repoWith(GREEN);
    expect((await omni(['roadmap', 'check', '--product', 'Mobile', 'roadmap.md'], root, app().fetch)).code).toBe(2);
    expect((await omni(['roadmap', 'check', '--product', 'mobile', '--new', 'roadmap.md'], root, app().fetch)).code).toBe(2);
    expect((await omni(['roadmap', 'check', '--product', 'mobile'], root, app().fetch)).code).toBe(2);
  });
});

describe('omni roadmap push --product', () => {
  it('--new creates the product\'s next roadmap and prints its id, the first line', async () => {
    const root = repoWith(GREEN);
    const { calls, fetch } = app();
    const { code, out, err } = await omni(['roadmap', 'push', '--product', 'mobile', '--new', 'roadmap.md'], root, fetch);
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe(`mobile-R3\ncreated · added roadmap v1, roadmap-prds v1 — ${BASE}/roadmaps/${ROADMAP_ID}\n`);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).toEqual({
      productKey: 'mobile', new: true, repo: 'acme/widgets', title: 'Mobile launch', milestone: 'The app ships.', target: null, source: null,
      questions: [], document: GREEN,
      prds: [
        { id: 'P1', prd: 'mobile-12', title: 'Sign-in', repos: ['app', 'api'], blockers: [], wave: 1, state: 'waiting', waitsOn: null, waitsOnUrl: null, startedAt: null, endedAt: null },
        { id: 'P2', prd: 912, title: 'Receipts', repos: ['app'], blockers: ['P1'], wave: 2, state: 'waiting', waitsOn: null, waitsOnUrl: null, startedAt: null, endedAt: null },
      ],
    });
  });

  it('--roadmap pushes to <key>-R<n>, either spelling, and says when no file changed', async () => {
    const root = repoWith(GREEN);
    const same = () => json(200, { roadmapId: ROADMAP_ID, dossierId: 'd', roadmap: 'mobile-R3', created: false, product: { id: 'p', name: 'Mobile' }, added: [], unchanged: ['roadmap', 'roadmap-prds'] });
    for (const which of ['3', 'mobile-R3']) {
      const { calls, fetch } = app({ push: same });
      const { code, out } = await omni(['roadmap', 'push', '--product', 'mobile', '--roadmap', which, 'roadmap.md'], root, fetch);
      expect(code).toBe(0);
      expect(out).toBe(`mobile-R3\nupdated · no new version · unchanged roadmap, roadmap-prds — ${BASE}/roadmaps/${ROADMAP_ID}\n`);
      expect(calls[1]?.body).toMatchObject({ productKey: 'mobile', roadmap: 3 });
      expect(calls[1]?.body).not.toHaveProperty('new');
    }
  });

  it('takes the roadmap the file\'s front matter names when neither flag is given', async () => {
    const root = repoWith(roadmapMd(['| P1 | mobile-12 | Sign-in | – | – | 1 | app |'], ['roadmap: mobile-R3', 'title: Mobile launch', 'milestone: The app ships.']));
    const { calls, fetch } = app({ push: () => json(200, { roadmapId: ROADMAP_ID, dossierId: 'd', roadmap: 'mobile-R3', created: false, product: { id: 'p', name: 'Mobile' }, added: [], unchanged: [] }) });
    expect((await omni(['roadmap', 'push', '--product', 'mobile', 'roadmap.md'], root, fetch)).code).toBe(0);
    expect(calls[1]?.body).toMatchObject({ roadmap: 3 });
  });

  it('writes nothing when a row names a repository outside the product: only the check is sent', async () => {
    const root = repoWith(roadmapMd(['| P1 | mobile-12 | Sign-in | – | – | 1 | shop |']));
    const { calls, fetch } = app();
    const { code, out, err } = await omni(['roadmap', 'push', '--product', 'mobile', '--new', 'roadmap.md'], root, fetch);
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toContain('nothing was sent');
    expect(err).toContain('roadmap.md: P1: shop is not a repository of product mobile (app, api, docs).');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body.check).toBe(true);
  });

  it('is told where it goes, once, and to a roadmap of its own product', async () => {
    const root = repoWith(GREEN);
    const { fetch } = app();
    expect((await omni(['roadmap', 'push', '--product', 'mobile', 'roadmap.md'], root, fetch)).code).toBe(2);
    expect((await omni(['roadmap', 'push', '--product', 'mobile', '--new', '--roadmap', '3', 'roadmap.md'], root, fetch)).code).toBe(2);
    expect((await omni(['roadmap', 'push', '--product', 'mobile', '--roadmap', 'web-R3', 'roadmap.md'], root, fetch)).code).toBe(2);
    const named = repoWith(roadmapMd(['| P1 | mobile-12 | Sign-in | – | – | 1 | app |'], ['roadmap: mobile-R3', 'title: T', 'milestone: M']));
    const again = await omni(['roadmap', 'push', '--product', 'mobile', '--new', 'roadmap.md'], named, fetch);
    expect(again.code).toBe(2);
    expect(again.err).toContain('the file already names mobile-R3');
    const other = await omni(['roadmap', 'push', '--product', 'web', 'roadmap.md'], named, fetch);
    expect(other.code).toBe(2);
    expect(other.err).toContain('a roadmap of product mobile, not web');
  });

  it('stops with one line when the app refuses or cannot be reached', async () => {
    const root = repoWith(GREEN);
    const refused = await omni(['roadmap', 'push', '--product', 'mobile', '--new', 'roadmap.md'], root, app({ push: () => json(403, { error: 'no' }) }).fetch);
    expect(refused).toMatchObject({ code: 1, out: '', err: 'refused (403): no\n' });
    const off = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: null\n' } });
    writeFileSync(join(off.root, 'roadmap.md'), GREEN);
    expect(await omni(['roadmap', 'push', '--product', 'mobile', '--new', 'roadmap.md'], off.root, app().fetch)).toMatchObject({ code: 1, err: 'off\n' });
  });
});
