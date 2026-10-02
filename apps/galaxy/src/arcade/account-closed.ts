// A build with no sign-in configured (and no demo asked for): nobody gets past INSERT COIN.
import type { Account } from './types';

const CLOSED = 'Sign-in is not open on this arcade yet.';

export function closedAccount(): Account {
  return {
    kind: 'closed',
    restore: () => ({ session: null, me: null }),
    signIn: () => Promise.reject(new Error(CLOSED)),
    linkGithub: () => Promise.reject(new Error(CLOSED)),
    save: () => Promise.reject(new Error(CLOSED)),
    submitScore: () => Promise.reject(new Error(CLOSED)),
    scores: () => Promise.resolve({ top: [], mine: null }), // nobody has played here
    signOut: () => Promise.resolve(), // nobody is signed in
  };
}
