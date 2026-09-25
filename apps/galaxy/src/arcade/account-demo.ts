// The demo galaxy's account (and the single-file artifact's): nothing leaves the browser. Signing in
// and linking GitHub are simulated, and the guest player is kept in this browser's storage, so the
// whole onboarding plays without a backend.
import type { Account, Player, PlayerPatch, Session } from './types';

const KEY = 'omni-loop:guest';
const GUEST: Session = { id: 'guest', email: 'guest@vertuoza.com', givenName: 'GUEST', crew: true };

interface Saved { signedIn: boolean; me: Player | null }

function read(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch { /* storage refused: a fresh guest every visit */ }
  return { signedIn: false, me: null };
}

function write(s: Saved) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* per-browser convenience only */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function demoAccount(): Account {
  return {
    kind: 'demo',
    restore() {
      const s = read();
      return { session: s.signedIn ? GUEST : null, me: s.me };
    },
    async signIn() {
      await wait(1400);
      write({ ...read(), signedIn: true });
      return GUEST;
    },
    async linkGithub() {
      await wait(1400);
      const s = read();
      if (!s.me) throw new Error('Choose a fleet first: there is no player to link yet.');
      const login = `${s.me.display_name.toLowerCase()}-gh`;
      write({ ...s, me: { ...s.me, github_login: login } });
      return login;
    },
    async save(patch: PlayerPatch, current: Player | null) {
      const s = read();
      const base: Player = current ?? s.me ?? {
        id: GUEST.id, display_name: GUEST.givenName, team: null, team_since: null,
        hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, github_login: null,
      };
      const me: Player = {
        ...base, ...patch,
        team_since: patch.team && patch.team !== base.team ? new Date().toISOString() : base.team_since,
      };
      write({ ...s, signedIn: true, me });
      return me;
    },
    async signOut() {
      write({ ...read(), signedIn: false });
    },
  };
}
