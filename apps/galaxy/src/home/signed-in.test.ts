import { describe, expect, it } from 'vitest';
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
