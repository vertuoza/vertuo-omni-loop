import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pitchGif, registerPitch, requestPitchUploads, type PitchDeps } from './api';
import { FakePitchWorld } from './store.fake';
import { z } from 'zod';
import { sure } from '../arcade/test/sure';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

// The routes' answers, read as they came: the run and its signed links, or a refusal's words.
const Links = z.looseObject({
  run: z.string(),
  files: z.array(z.looseObject({ name: z.string(), path: z.string(), url: z.unknown() })),
});
const Refusal = z.looseObject({ error: z.string() });

const ORIGIN = 'https://omni.test';
const SHIPPED = '00000000-0000-4000-8000-0000000000d1';
const BUILDING = '00000000-0000-4000-8000-0000000000d2';
const OTHER = '00000000-0000-4000-8000-0000000000d3';
const MB = 1024 * 1024;

let world: FakePitchWorld;
let deps: PitchDeps;

beforeEach(() => {
  world = new FakePitchWorld();
  world.account('tok-ada', 'ada', ['ws-acme']);
  world.account('tok-eve', 'eve', ['ws-other']);
  world.dossier({ id: SHIPPED, workspace: 'ws-acme', repo: 'acme/widgets', prd: parsePrd(859), shipped: true });
  world.dossier({ id: BUILDING, workspace: 'ws-acme', repo: 'acme/widgets', prd: parsePrd(860), shipped: false });
  world.dossier({ id: OTHER, workspace: 'ws-other', repo: 'other/thing', prd: parsePrd(5), shipped: true });
  deps = { connect: (token) => world.client(token), open: () => world.public() };
});

const post = (path: string, body: unknown, token: string | null = 'tok-ada') =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const FILES = [
  { name: 'slide.png', bytes: 400_000, type: 'image/png' },
  { name: 'slide-square.png', bytes: 300_000, type: 'image/png' },
  { name: 'pitch.mp4', bytes: 12 * MB, type: 'video/mp4' },
  { name: 'pitch-square.mp4', bytes: 9 * MB, type: 'video/mp4' },
  { name: 'pitch.gif', bytes: 2 * MB, type: 'image/gif' },
];

const uploads = (files: unknown = FILES, extra: Record<string, unknown> = {}, token?: string | null) =>
  requestPitchUploads(post('/api/pitches/uploads', { repo: 'acme/widgets', prd: 859, files, ...extra }, token), deps);

/** Asks for links, then does what the kit does with each: one PUT. The run's id. */
async function uploadAll(files = FILES): Promise<string> {
  const res = await uploads(files);
  expect(res.status).toBe(200);
  const body = Links.parse(await res.json());
  for (const f of body.files) world.put(f.path);
  return body.run;
}

const WORDS = {
  audience: 'customers', look: 'arcade', commit: 'abc1234',
  hook: 'Answer from your phone', benefit: 'Every question waits on one page.', kicker: 'NEW IN WIDGETS', closing: 'Widgets · https://widgets.test',
};

const register = (body: Record<string, unknown>, token?: string | null) =>
  registerPitch(post('/api/pitches', { repo: 'acme/widgets', prd: 859, ...WORDS, ...body }, token), deps);

describe('POST /api/pitches/uploads', () => {
  it('gives one signed link per file, under a fresh run of the shipped PRD\'s dossier', async () => {
    const res = await uploads();
    expect(res.status).toBe(200);
    const body = Links.parse(await res.json());
    expect(body.run).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(body.files.map((f: { name: string }) => f.name)).toEqual(FILES.map((f) => f.name));
    for (const f of body.files) expect(f.path).toBe(`${SHIPPED}/${body.run}/${f.name}`);
  });

  it('refuses a PRD not shipped (422), before any link is signed', async () => {
    const res = await uploads(FILES, { prd: 860 });
    expect(res.status).toBe(422);
    expect(Refusal.parse(await res.json()).error).toContain('not shipped');
  });

  it('refuses anything but the five files, each of its own type (400)', async () => {
    expect((await uploads(FILES.slice(0, 4))).status).toBe(400);
    expect((await uploads([...FILES, { name: 'notes.txt', bytes: 3, type: 'text/plain' }])).status).toBe(400);
    const wrongType = await uploads(FILES.map((f) => (f.name === 'pitch.mp4' ? { ...f, type: 'video/webm' } : f)));
    expect(wrongType.status).toBe(400);
    expect(Refusal.parse(await wrongType.json()).error).toContain('pitch.mp4');
    expect((await uploads([...FILES.slice(0, 4), FILES[0]])).status).toBe(400);
  });

  it('refuses a file over 50 MB (413), naming it', async () => {
    const res = await uploads(FILES.map((f) => (f.name === 'pitch.mp4' ? { ...f, bytes: 60 * MB } : f)));
    expect(res.status).toBe(413);
    expect(Refusal.parse(await res.json()).error).toContain('pitch.mp4');
  });

  it('refuses a PRD without a dossier, or another workspace\'s (404), and a signed-out call (401)', async () => {
    expect((await uploads(FILES, { prd: 861 })).status).toBe(404);
    expect((await uploads(FILES, { repo: 'other/thing', prd: 5 })).status).toBe(404);
    expect((await uploads(FILES, {}, null)).status).toBe(401);
    expect((await uploads(FILES, {}, 'tok-nobody')).status).toBe(401);
  });

  it('answers 503 where there is no database', async () => {
    expect((await requestPitchUploads(post('/api/pitches/uploads', {}), { connect: null, open: null })).status).toBe(503);
  });
});

describe('POST /api/pitches', () => {
  it('stores the pitch and answers the Pitch tab\'s link and the GIF\'s stable link', async () => {
    const run = await uploadAll();
    const res = await register({ run });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: `${ORIGIN}/prd/${SHIPPED}?tab=pitch`, gif: `${ORIGIN}/api/pitches/${run}/pitch.gif` });
    expect(world.runs).toHaveLength(1);
    expect(world.runs[0]).toMatchObject({ id: run, dossier_id: SHIPPED, audience: 'customers', look: 'arcade', hook: WORDS.hook, kicker: WORDS.kicker });
  });

  it('refuses a file it did not upload (400), naming it', async () => {
    const run = await uploadAll();
    world.files.delete(`${SHIPPED}/${run}/pitch.gif`);
    const res = await register({ run });
    expect(res.status).toBe(400);
    expect(Refusal.parse(await res.json()).error).toContain('pitch.gif');
    expect(world.runs).toHaveLength(0);
  });

  it('refuses another audience, another look, a bad commit and empty or long words (400)', async () => {
    const run = await uploadAll();
    expect((await register({ run, audience: 'everyone' })).status).toBe(400);
    expect((await register({ run, look: 'custom' })).status).toBe(400);
    expect((await register({ run, commit: 'zzz' })).status).toBe(400);
    expect((await register({ run, hook: '  ' })).status).toBe(400);
    expect((await register({ run, kicker: 'K'.repeat(101) })).status).toBe(400);
    expect((await register({ run: 'not-a-uuid' })).status).toBe(400);
    expect(world.runs).toHaveLength(0);
  });

  it('refuses a PRD not shipped (422)', async () => {
    sure(world.dossiers[1], 'the building dossier').shipped = true;
    const res = await uploads(FILES, { prd: 860 });
    const { run, files } = Links.parse(await res.json());
    for (const f of files) world.put(f.path);
    sure(world.dossiers[1], 'the building dossier').shipped = false;
    expect((await register({ run, prd: 860 })).status).toBe(422);
  });

  it('refuses a run registered already (409), and a PRD without a dossier (404) or signed out (401)', async () => {
    const run = await uploadAll();
    expect((await register({ run })).status).toBe(200);
    expect((await register({ run })).status).toBe(409);
    expect((await register({ run, prd: 861 })).status).toBe(404);
    expect((await register({ run }, null)).status).toBe(401);
    expect((await register({ run }, 'tok-eve')).status).toBe(404);
  });
});

describe('GET /api/pitches/<run>/pitch.gif', () => {
  const gif = (run: string) => pitchGif(new Request(`${ORIGIN}/api/pitches/${run}/pitch.gif`), run, deps);

  it('answers 302 to a fresh 5-minute signed link, without sign-in', async () => {
    const run = await uploadAll();
    await register({ run });
    const res = await gif(run);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`https://storage.test/sign/${SHIPPED}/${run}/pitch.gif?ttl=300`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 404 for a run never registered, an unknown run and a malformed id', async () => {
    const run = await uploadAll();
    expect((await gif(run)).status).toBe(404);
    expect((await gif('00000000-0000-4000-8000-00000000ffff')).status).toBe(404);
    expect((await gif('nope')).status).toBe(404);
  });

  it('answers 503 where there is no service key', async () => {
    expect((await pitchGif(new Request(`${ORIGIN}/x`), SHIPPED, { connect: null, open: null })).status).toBe(503);
  });
});
