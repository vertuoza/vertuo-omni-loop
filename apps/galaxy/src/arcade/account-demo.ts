// The demo galaxy's account (and the single-file artifact's): nothing leaves the browser. Signing in
// and linking GitHub are simulated, and the guest player is kept in this browser's storage, so the
// whole onboarding plays without a backend. So are the guest's high scores: their best at each game,
// the only line of the demo's crew table.
import { validHero, type Hero } from '@omni/design';
import { z } from 'zod';
import type { Account, Player, PlayerPatch, ScoreBoard, Session } from './types';

const KEY = 'omni-loop:guest';
const GUEST: Session = { id: 'guest', email: 'guest@vertuoza.com', givenName: 'GUEST', crew: true, github: null };
/** The highest score a game takes, as submit_score() holds it. */
const SCORE_CAP = 9_999_999;

/** The player the demo keeps, as the database would hold their row. */
const PlayerSchema = z.looseObject({
  id: z.string(),
  display_name: z.string(),
  team: z.string().nullable(),
  team_since: z.string().nullable(),
  hero: z.custom<Hero>(validHero, { message: 'not a hero' }),
  github_login: z.string().nullable(),
}) satisfies z.ZodType<Player>;

/** A guest may have linked GitHub before they have a player row: the login is kept apart. */
interface Saved { signedIn: boolean; github?: string | null; me: Player | null; best?: Record<string, number> }

/** What this browser kept, every field it was written with kept too. */
const SavedSchema = z.looseObject({
  signedIn: z.boolean(),
  github: z.string().nullable().optional(),
  me: PlayerSchema.nullable(),
  best: z.record(z.string(), z.number()).optional(),
});

function read(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return SavedSchema.parse(JSON.parse(raw));
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
    save(patch: PlayerPatch, current: Player | null) {
      const s = read();
      // As in Supabase: no GitHub linked, no player row.
      if (!current && !s.me && !s.github) return Promise.reject(new Error('Link your GitHub first: it is what makes you a player.'));
      const base: Player = current ?? s.me ?? {
        id: GUEST.id, display_name: GUEST.givenName, team: null, team_since: null,
        hero: { v: 1, body: 'girl', skin: 1, hair: 0, suit: 0, cape: 1 }, github_login: s.github ?? null,
      };
      const me: Player = {
        ...base, ...patch,
        team_since: patch.team && patch.team !== base.team ? new Date().toISOString() : base.team_since,
      };
      write({ ...s, signedIn: true, me });
      return Promise.resolve(me);
    },
    submitScore(game: string, score: number) {
      // As submit_score() does: a player only, a whole score from 0 to the cap, and the higher kept.
      if (!Number.isInteger(score) || score < 0 || score > SCORE_CAP) return Promise.reject(new Error('A score is a whole number from 0 to 9,999,999.'));
      const s = read();
      if (!s.me) return Promise.reject(new Error('Only a player may post a score: join a fleet first.'));
      const best = Math.max(s.best?.[game] ?? score, score);
      write({ ...s, best: { ...s.best, [game]: best } });
      return Promise.resolve(best);
    },
    scores(game: string): Promise<ScoreBoard> {
      const { me, best } = read();
      const mine = best?.[game] ?? null;
      if (mine === null || !me) return Promise.resolve({ top: [], mine: null });
      return Promise.resolve({ top: [{ id: me.id, name: me.display_name, hero: me.hero, team: me.team, best: mine }], mine });
    },
    signOut() {
      write({ ...read(), signedIn: false });
      return Promise.resolve();
    },
  };
}
