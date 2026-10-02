import { describe, expect, it } from 'vitest';
import { faceOf } from '../people/face';
import { readSignedIn, type SessionPort } from './session-read';
import type { SignedInView } from './signed-in';

// The browser's session read behind a port (PRD 1006). s1: a session draws the pill; no session, a
// failed read or no Supabase (the demo) draws nothing, and the page stays today's. s3: the photo is
// drawn at once, from the session alone; the hero replaces it once the workspace, then the player and
// the fleets, are read, in the order viewerLive reads them.

const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };
const ADA = { id: 'u-ada', user_metadata: { name: 'Ada', avatar_url: 'https://a.example/ada.png' } };
const PHOTO: SignedInView = { name: 'Ada', face: { kind: 'photo', url: 'https://a.example/ada.png' } };

/** A port with a session only: the member belongs to no workspace. */
const port = (user: SessionPort['user'], more: Partial<SessionPort> = {}): SessionPort => ({
  user,
  workspace: () => Promise.resolve(null),
  player: () => Promise.resolve(null),
  fleets: () => Promise.resolve([]),
  ...more,
});

/** A port for Ada, a player of the octopods with a hero, every read logged. */
function playerPort(log: string[] = [], more: Partial<SessionPort> = {}): SessionPort {
  return port(() => { log.push('user'); return Promise.resolve(ADA); }, {
    workspace: (userId) => { log.push(`workspace ${userId}`); return Promise.resolve({ id: 'w-1' }); },
    player: (userId, workspaceId) => { log.push(`player ${userId} ${workspaceId}`); return Promise.resolve({ hero: HERO, team: 'octopod' }); },
    fleets: (workspaceId) => { log.push(`fleets ${workspaceId}`); return Promise.resolve([{ name: 'beaver', color: '#ff3355' }, { name: 'octopod', color: '#3355ff' }]); },
    ...more,
  });
}

/** What the read resolves with, and every view drawn, in order, once every read has settled. */
async function drawn(p: SessionPort | null) {
  const views: (SignedInView | null)[] = [];
  const first = await readSignedIn(p, (view) => views.push(view));
  await new Promise((done) => setTimeout(done, 0));
  return { first, views };
}

describe('reading who is signed in, in the browser', () => {
  it('a session gives the pill', async () => {
    expect(await readSignedIn(port(() => Promise.resolve(ADA)))).toEqual(PHOTO);
  });

  it('no session gives nothing', async () => {
    expect(await readSignedIn(port(() => Promise.resolve(null)))).toBeNull();
  });

  it('a failed read gives nothing, and never throws', async () => {
    expect(await readSignedIn(port(() => Promise.reject(new Error('network down'))))).toBeNull();
  });

  it('no Supabase (the demo) gives nothing', async () => {
    expect(await readSignedIn(null)).toBeNull();
  });
});

describe('the hero, read after the session', () => {
  it('draws the photo first, then the hero in the colour of their fleet', async () => {
    const { first, views } = await drawn(playerPort());
    expect(first).toEqual(PHOTO);
    expect(views).toEqual([PHOTO, { name: 'Ada', face: faceOf({ name: 'Ada', hero: HERO, color: '#3355ff' }) }]);
    expect(views[1]?.face.kind).toBe('hero');
  });

  it('reads the workspace, then the player and the fleets of that workspace', async () => {
    const log: string[] = [];
    await drawn(playerPort(log));
    expect(log).toEqual(['user', 'workspace u-ada', 'player u-ada w-1', 'fleets w-1']);
  });

  it('a fleet with no colour of its own tints the hero in the default fleet colour', async () => {
    const { views } = await drawn(playerPort([], { fleets: () => Promise.resolve([{ name: 'octopod', color: null }]) }));
    expect(views[1]).toEqual({ name: 'Ada', face: faceOf({ name: 'Ada', hero: HERO, color: '#cfd4e6' }) });
  });

  it('a player in no fleet gets their hero untinted', async () => {
    const { views } = await drawn(playerPort([], { player: () => Promise.resolve({ hero: HERO, team: null }) }));
    expect(views[1]).toEqual({ name: 'Ada', face: faceOf({ name: 'Ada', hero: HERO, color: null }) });
  });

  it('a member of no workspace keeps the photo, and reads no player', async () => {
    const log: string[] = [];
    const { views } = await drawn(playerPort(log, { workspace: () => { log.push('workspace'); return Promise.resolve(null); } }));
    expect(views).toEqual([PHOTO]);
    expect(log).toEqual(['user', 'workspace']);
  });

  it('a member with no player row keeps the photo', async () => {
    const { views } = await drawn(playerPort([], { player: () => Promise.resolve(null) }));
    expect(views).toEqual([PHOTO]);
  });

  it('a player whose hero is empty keeps the photo', async () => {
    const { views } = await drawn(playerPort([], { player: () => Promise.resolve({ hero: {}, team: 'octopod' }) }));
    expect(views).toEqual([PHOTO]);
  });

  it.each([
    ['the workspace', { workspace: () => Promise.reject(new Error('down')) }],
    ['the player', { player: () => Promise.reject(new Error('down')) }],
    ['the fleets', { fleets: () => Promise.reject(new Error('down')) }],
  ] as const)('a failed read of %s keeps the photo, and never throws', async (_, more) => {
    const { first, views } = await drawn(playerPort([], more));
    expect(first).toEqual(PHOTO);
    expect(views).toEqual([PHOTO]);
  });

  it('a session without an id keeps the photo, and reads no workspace', async () => {
    const log: string[] = [];
    const { views } = await drawn(playerPort(log, { user: () => Promise.resolve({ user_metadata: ADA.user_metadata }) }));
    expect(views).toEqual([PHOTO]);
    expect(log).toEqual([]);
  });

  it('no session draws nothing, once', async () => {
    const { first, views } = await drawn(port(() => Promise.resolve(null)));
    expect(first).toBeNull();
    expect(views).toEqual([null]);
  });

  it('the demo draws nothing, once', async () => {
    const { first, views } = await drawn(null);
    expect(first).toBeNull();
    expect(views).toEqual([null]);
  });
});
