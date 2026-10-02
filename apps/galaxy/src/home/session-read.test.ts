import { describe, expect, it } from 'vitest';
import { readSignedIn, type SessionPort } from './session-read';

// The browser's session read behind a port (PRD 1006, s1): a session draws the pill; no session, a
// failed read or no Supabase (the demo) draws nothing, and the page stays today's.

const port = (user: SessionPort['user']): SessionPort => ({ user });

describe('reading who is signed in, in the browser', () => {
  it('a session gives the pill', async () => {
    const read = await readSignedIn(port(async () => ({ user_metadata: { name: 'Ada', avatar_url: 'https://a.example/ada.png' } })));
    expect(read).toEqual({ name: 'Ada', face: { kind: 'photo', url: 'https://a.example/ada.png' } });
  });

  it('no session gives nothing', async () => {
    expect(await readSignedIn(port(async () => null))).toBeNull();
  });

  it('a failed read gives nothing, and never throws', async () => {
    expect(await readSignedIn(port(async () => { throw new Error('network down'); }))).toBeNull();
  });

  it('no Supabase (the demo) gives nothing', async () => {
    expect(await readSignedIn(null)).toBeNull();
  });
});
