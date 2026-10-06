import { describe, expect, it } from 'vitest';
import { faceOf } from '../people/face';
import { signedIn } from './signed-in';

// The signed-in pill's decision (PRD 1006, s1): who the session's user is, and the face drawn beside
// CONTINUE YOUR GAME. The photo or the initial comes from the session alone.

const ADA = {
  email: 'ada@example.com',
  user_metadata: { full_name: 'Ada Lovelace', user_name: 'ada', avatar_url: 'https://avatars.example/ada.png' },
  identities: [{ provider: 'github', identity_data: { user_name: 'ada' } }],
};

describe('the signed-in pill, decided from the session', () => {
  it('a null user gives no pill', () => {
    expect(signedIn(null)).toBeNull();
  });

  it('a user with a GitHub photo gets the photo', () => {
    expect(signedIn(ADA)).toEqual({ name: 'Ada Lovelace', face: { kind: 'photo', url: 'https://avatars.example/ada.png' } });
  });

  it('a user without a photo gets the initial of their name', () => {
    const user = { ...ADA, user_metadata: { full_name: 'ada lovelace', user_name: 'ada' } };
    expect(signedIn(user)).toEqual({ name: 'ada lovelace', face: { kind: 'initial', letter: 'A' } });
  });

  it('with no name, the initial and the name come from the GitHub login', () => {
    const user = { user_metadata: {}, identities: [{ provider: 'github', identity_data: { user_name: 'grace' } }] };
    expect(signedIn(user)).toEqual({ name: 'grace', face: { kind: 'initial', letter: 'G' } });
  });

  it('with no login in the identities, reads the login from the metadata', () => {
    expect(signedIn({ user_metadata: { user_name: 'linus' } })).toEqual({ name: 'linus', face: { kind: 'initial', letter: 'L' } });
  });

  it('a blank photo is no photo', () => {
    const user = { user_metadata: { name: 'Margaret', avatar_url: '  ' } };
    expect(signedIn(user)?.face).toEqual({ kind: 'initial', letter: 'M' });
  });

  it('with nothing to name them by, still draws a pill', () => {
    expect(signedIn({})).toEqual({ name: 'you', face: { kind: 'initial', letter: 'Y' } });
  });
});

// PRD 1006, s3: once the workspace and player reads return, the player's hero comes first, drawn
// through faceOf in their fleet's colour, as the app bar draws it.

const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };

describe('the signed-in pill, once the player is read', () => {
  it('a player with a hero gets the hero, in the colour of their fleet', () => {
    const view = signedIn(ADA, { hero: HERO, color: '#3355ff' });
    expect(view).toEqual({ name: 'Ada Lovelace', face: faceOf({ name: 'Ada Lovelace', hero: HERO, color: '#3355ff' }) });
    expect(view?.face.kind).toBe('hero');
    expect(view?.face).not.toEqual(faceOf({ name: 'Ada Lovelace', hero: HERO, color: '#ff3355' }));
  });

  it('a player whose hero is empty keeps the photo', () => {
    expect(signedIn(ADA, { hero: {}, color: '#3355ff' })?.face).toEqual({ kind: 'photo', url: 'https://avatars.example/ada.png' });
    expect(signedIn(ADA, { hero: null, color: null })?.face).toEqual({ kind: 'photo', url: 'https://avatars.example/ada.png' });
  });

  it('a player read that failed keeps the photo', () => {
    expect(signedIn(ADA, null)?.face).toEqual({ kind: 'photo', url: 'https://avatars.example/ada.png' });
  });

  it('a hero never draws a pill for nobody', () => {
    expect(signedIn(null, { hero: HERO, color: '#3355ff' })).toBeNull();
  });
});
