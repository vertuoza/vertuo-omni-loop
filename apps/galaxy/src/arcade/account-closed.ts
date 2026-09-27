// A build with no sign-in configured (and no demo asked for): nobody gets past INSERT COIN.
import type { Account } from './types';

const CLOSED = 'Sign-in is not open on this arcade yet.';

export function closedAccount(): Account {
  return {
    kind: 'closed',
    restore: () => ({ session: null, me: null }),
    async signIn() { throw new Error(CLOSED); },
    async linkGithub() { throw new Error(CLOSED); },
    async save() { throw new Error(CLOSED); },
    async submitScore() { throw new Error(CLOSED); },
    async scores() { return { top: [], mine: null }; }, // nobody has played here
    async signOut() { /* nobody is signed in */ },
  };
}
