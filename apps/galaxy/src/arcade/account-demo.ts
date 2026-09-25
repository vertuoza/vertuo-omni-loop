// The demo galaxy's account (and the single-file artifact's): nothing leaves the browser. Signing in
// and linking GitHub are simulated, and the guest player is kept in this browser's storage, so the
// whole onboarding plays without a backend.
import type { Account, Player, PlayerPatch, Session } from './types';

const KEY = 'omni-loop:guest';
const GUEST: Session = { id: 'guest', email: 'guest@vertuoza.com', givenName: 'GUEST', crew: true, github: null };

/** A guest may have linked GitHub before they have a player row: the login is kept apart. */
interface Saved { signedIn: boolean; github?: string | null; me: Player | null }

function read(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch { /* storage refused: a fresh guest every visit */ }
  return { signedIn: false, github: null, me: null };
}

function write(s: Saved) {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* per-browser convenience only */ }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const guest = (s: Saved): Session => ({ ...GUEST, github: s.github ?? s.me?.github_login ?? null });

export function demoAccount(): Account {
  return {
    kind: 'demo',
    restore() {
      const s = read();
      return { session: s.signedIn ? guest(s) : null, me: s.me };
    },
    async signIn() {
      await wait(1400);
      const s = { ...read(), signedIn: true };
      write(s);
      return guest(s);
    },
    async linkGithub() {
      await wait(1400);
      const s = read();
      const login = s.me?.github_login ?? `${(s.me?.display_name ?? GUEST.givenName).toLowerCase()}-gh`;
      write({ ...s, github: login, me: s.me && { ...s.me, github_login: login } });
      return login;
    },
    async save(patch: PlayerPatch, current: Player | null) {
      const s = read();
      // As in Supabase: no GitHub linked, no player row.
      if (!current && !s.me && !s.github) throw new Error('Link your GitHub first: it is what makes you a player.');
      const base: Player = current ?? s.me ?? {
        id: GUEST.id, display_name: GUEST.givenName, team: null, team_since: null,
        hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, github_login: s.github ?? null,
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
