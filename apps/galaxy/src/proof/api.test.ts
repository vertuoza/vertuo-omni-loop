import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { previewGif, registerRun, requestUploads, type ProofDeps } from './api';
import { FakeProofWorld } from './store.fake';
import { sure } from '../arcade/sure';

// The routes' answers, read as they came: the run and its signed links, or a refusal's words.
const Links = z.looseObject({
  run: z.string(),
  files: z.array(z.looseObject({ name: z.string(), path: z.string(), url: z.unknown() })),
});
const Refusal = z.looseObject({ error: z.string() });

const ORIGIN = 'https://omni.test';
const DOSSIER = '00000000-0000-4000-8000-0000000000d1';
const OTHER_DOSSIER = '00000000-0000-4000-8000-0000000000d2';
const MB = 1024 * 1024;

let world: FakeProofWorld;
let deps: ProofDeps;

beforeEach(() => {
  world = new FakeProofWorld();
  world.account('tok-ada', 'ada', ['ws-acme']);
  world.account('tok-eve', 'eve', ['ws-other']);
  world.dossier({ id: DOSSIER, workspace: 'ws-acme', repo: 'acme/widgets', prd: 798 });
  world.dossier({ id: OTHER_DOSSIER, workspace: 'ws-other', repo: 'other/thing', prd: 5 });
  deps = { connect: (token) => world.client(token), open: () => world.public() };
});

const post = (path: string, body: unknown, token: string | null = 'tok-ada') =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const uploads = (files: unknown, extra: Record<string, unknown> = {}, token?: string | null) =>
  requestUploads(post('/api/proofs/uploads', { repo: 'acme/widgets', prd: 798, files, ...extra }, token), deps);

const CLIP = { name: '1-sign-in.webm', bytes: 3 * MB, type: 'video/webm' };
const SCRIPT = { name: '1-sign-in.spec.ts', bytes: 900, type: 'text/plain' };
const GIF = { name: 'preview.gif', bytes: 400_000, type: 'image/gif' };

/** Asks for links, then does what the kit does with each: one PUT. The run's id. */
async function uploadAll(files: Array<{ name: string; bytes: number; type: string }>): Promise<string> {
  const res = await uploads(files);
  expect(res.status).toBe(200);
  const body = Links.parse(await res.json());
  for (const f of body.files) world.put(f.path);
  return body.run;
}

const register = (body: Record<string, unknown>, token?: string | null) =>
  registerRun(post('/api/proofs', { repo: 'acme/widgets', prd: 798, commit: 'abc1234', url: 'https://preview.test', ...body }, token), deps);

describe('POST /api/proofs/uploads', () => {
  it('gives one signed link per file, under a fresh run of the PRD\'s dossier', async () => {
    const res = await uploads([CLIP, SCRIPT, GIF]);
    expect(res.status).toBe(200);
    const body = Links.parse(await res.json());
    expect(body.run).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(body.files.map((f) => f.name)).toEqual(['1-sign-in.webm', '1-sign-in.spec.ts', 'preview.gif']);
    for (const f of body.files) {
      expect(f.path).toBe(`${DOSSIER}/${body.run}/${f.name}`);
      expect(typeof f.url).toBe('string');
    }
    const again = Links.parse(await (await uploads([CLIP])).json());
    expect(again.run).not.toBe(body.run);
  });

  it('refuses a type other than webm, gif or text (400), naming the file', async () => {
    const res = await uploads([{ name: 'clip.mp4', bytes: MB, type: 'video/mp4' }]);
    expect(res.status).toBe(400);
    expect(Refusal.parse(await res.json()).error).toContain('clip.mp4');
  });

  it('refuses a name whose extension is not its type\'s (400)', async () => {
    expect((await uploads([{ name: 'clip.mp4', bytes: MB, type: 'video/webm' }])).status).toBe(400);
  });

  it('refuses a name that is a path (400)', async () => {
    expect((await uploads([{ name: '../x.webm', bytes: MB, type: 'video/webm' }])).status).toBe(400);
  });

  it('refuses a file over 50 MB (413)', async () => {
    const res = await uploads([CLIP, { ...CLIP, name: 'big.webm', bytes: 60 * MB }]);
    expect(res.status).toBe(413);
    expect(Refusal.parse(await res.json()).error).toContain('big.webm');
    expect((await uploads([{ ...CLIP, bytes: 50 * MB }])).status).toBe(200);
  });

  it('refuses more than 25 files (400), and none', async () => {
    const many = Array.from({ length: 26 }, (_, i) => ({ ...CLIP, name: `${i}.webm` }));
    expect((await uploads(many)).status).toBe(400);
    expect((await uploads(many.slice(0, 25))).status).toBe(200);
    expect((await uploads([])).status).toBe(400);
  });

  it('refuses the same name twice (400)', async () => {
    expect((await uploads([CLIP, CLIP])).status).toBe(400);
  });

  it('refuses a PRD without a dossier (404), and one of another workspace alike', async () => {
    expect((await uploads([CLIP], { prd: 799 })).status).toBe(404);
    expect((await uploads([CLIP], { repo: 'other/thing', prd: 5 })).status).toBe(404);
  });

  it('refuses a signed-out call (401)', async () => {
    expect((await uploads([CLIP], {}, null)).status).toBe(401);
    expect((await uploads([CLIP], {}, 'tok-nobody')).status).toBe(401);
  });

  it('refuses a malformed body (400)', async () => {
    expect((await requestUploads(post('/api/proofs/uploads', { repo: 'nope', prd: 798, files: [CLIP] }), deps)).status).toBe(400);
    expect((await requestUploads(post('/api/proofs/uploads', { repo: 'acme/widgets', prd: 0, files: [CLIP] }), deps)).status).toBe(400);
    expect((await uploads([{ name: 'a.webm', bytes: -1, type: 'video/webm' }])).status).toBe(400);
  });

  it('answers 503 where there is no database', async () => {
    expect((await requestUploads(post('/api/proofs/uploads', {}), { connect: null, open: null })).status).toBe(503);
  });
});

describe('POST /api/proofs', () => {
  it('stores one run and answers the Proof tab\'s link', async () => {
    const run = await uploadAll([CLIP, SCRIPT, GIF]);
    const res = await register({
      run,
      criteria: [
        { text: 'A signed-in person sees the tab', verdict: 'pass', video: CLIP.name, script: SCRIPT.name },
        { text: 'The config key is read', verdict: 'unfilmable', note: 'a config key, not a screen' },
      ],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: `${ORIGIN}/prd/${DOSSIER}?tab=proof` });
    expect(world.runs).toHaveLength(1);
    expect(world.runs[0]).toMatchObject({ id: run, dossier_id: DOSSIER, commit_sha: 'abc1234', url: 'https://preview.test', gif: 'preview.gif' });
    expect(sure(world.runs[0], 'world.runs[0]').criteria[1]).toEqual({ text: 'The config key is read', verdict: 'unfilmable', note: 'a config key, not a screen' });
  });

  it('records no GIF when none was uploaded', async () => {
    const run = await uploadAll([CLIP]);
    expect((await register({ run, criteria: [{ text: 'x', verdict: 'fail', note: 'Expected 1', video: CLIP.name }] })).status).toBe(200);
    expect(sure(world.runs[0], 'world.runs[0]').gif).toBeNull();
  });

  it('refuses a verdict other than pass, fail or unfilmable (400)', async () => {
    const run = await uploadAll([CLIP]);
    const res = await register({ run, criteria: [{ text: 'x', verdict: 'maybe' }] });
    expect(res.status).toBe(400);
    expect(Refusal.parse(await res.json()).error).toContain('verdict');
    expect(world.runs).toHaveLength(0);
  });

  it('refuses a file it did not upload (400), naming it', async () => {
    const run = await uploadAll([CLIP]);
    const res = await register({ run, criteria: [{ text: 'x', verdict: 'pass', video: CLIP.name, script: '1-sign-in.spec.ts' }] });
    expect(res.status).toBe(400);
    expect(Refusal.parse(await res.json()).error).toContain('1-sign-in.spec.ts');
    expect(world.runs).toHaveLength(0);
  });

  it('refuses a file of another run (400)', async () => {
    await uploadAll([CLIP]);
    const other = await uploadAll([SCRIPT]);
    expect((await register({ run: other, criteria: [{ text: 'x', verdict: 'pass', video: CLIP.name }] })).status).toBe(400);
  });

  it('refuses more than 10 criteria, and none (400)', async () => {
    const run = await uploadAll([CLIP]);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ text: `c${i}`, verdict: 'unfilmable' }));
    expect((await register({ run, criteria: eleven })).status).toBe(400);
    expect((await register({ run, criteria: [] })).status).toBe(400);
    expect((await register({ run, criteria: eleven.slice(0, 10) })).status).toBe(200);
  });

  it('refuses a malformed run, commit or url (400)', async () => {
    const run = await uploadAll([CLIP]);
    const criteria = [{ text: 'x', verdict: 'unfilmable' }];
    expect((await register({ run: 'not-a-uuid', criteria })).status).toBe(400);
    expect((await register({ run, commit: 'zzz', criteria })).status).toBe(400);
    expect((await register({ run, url: 'ftp://x', criteria })).status).toBe(400);
    expect((await register({ run, criteria: [{ text: '', verdict: 'pass' }] })).status).toBe(400);
  });

  it('refuses a run registered already (409)', async () => {
    const run = await uploadAll([CLIP]);
    const criteria = [{ text: 'x', verdict: 'pass', video: CLIP.name }];
    expect((await register({ run, criteria })).status).toBe(200);
    expect((await register({ run, criteria })).status).toBe(409);
  });

  it('refuses a PRD without a dossier (404) and a signed-out call (401)', async () => {
    const run = await uploadAll([CLIP]);
    const criteria = [{ text: 'x', verdict: 'unfilmable' }];
    expect((await register({ run, prd: 799, criteria })).status).toBe(404);
    expect((await register({ run, criteria }, null)).status).toBe(401);
    expect((await register({ run, criteria }, 'tok-eve')).status).toBe(404);
  });
});

describe('GET /api/proofs/<run>/preview.gif', () => {
  const gif = (run: string) => previewGif(new Request(`${ORIGIN}/api/proofs/${run}/preview.gif`), run, deps);

  it('answers 302 to a fresh 5-minute signed link, without sign-in', async () => {
    const run = await uploadAll([CLIP, GIF]);
    await register({ run, criteria: [{ text: 'x', verdict: 'pass', video: CLIP.name }] });
    const res = await gif(run);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`https://storage.test/sign/${DOSSIER}/${run}/preview.gif?ttl=300`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 404 for a run without a GIF, an unknown run and a malformed id', async () => {
    const run = await uploadAll([CLIP]);
    await register({ run, criteria: [{ text: 'x', verdict: 'pass', video: CLIP.name }] });
    expect((await gif(run)).status).toBe(404);
    expect((await gif('00000000-0000-4000-8000-00000000ffff')).status).toBe(404);
    expect((await gif('nope')).status).toBe(404);
  });

  it('answers 404 for an uploaded GIF of a run never registered', async () => {
    const run = await uploadAll([GIF]);
    expect((await gif(run)).status).toBe(404);
  });

  it('answers 503 where there is no service key', async () => {
    expect((await previewGif(new Request(`${ORIGIN}/x`), DOSSIER, { connect: null, open: null })).status).toBe(503);
  });
});
