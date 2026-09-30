import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../arcade/types';

// `server-only` refuses to load outside a server bundle; the reader is exercised here on plain Node.
vi.mock('server-only', () => ({}));
const { readAskDock } = await import('./dock-player');

const ENV = { url: 'https://db.example', key: 'anon-key' };
const WORKSPACE = { id: 'ws-vertuoza', slug: 'vertuoza', name: 'Vertuoza', theme: {} };
const HERO = { v: 1, body: 'boy', skin: 2, hair: 1, suit: 3, cape: 0 } as const;
const ME: Player = { id: 'ada', display_name: 'Ada', team: 'beaver', team_since: null, hero: HERO, github_login: 'Ada-L' };
const XP = { xp: 180, level: 3, unlocked: ['invaders'] };

const user = (github: string | null) =>
  ({ id: 'ada', identities: github ? [{ provider: 'github', identity_data: { user_name: github } }] : [] }) as unknown as User;

/** The reads the dock needs, stubbed: the arcade's workspace, the player row and the XP row. */
function reads(patch: Partial<Parameters<typeof readAskDock>[3]> = {}) {
  const xpFor: string[] = [];
  return {
    xpFor,
    reads: {
      workspace: async () => WORKSPACE,
      me: async () => ME,
      xp: async (_workspace: string, login: string) => { xpFor.push(login); return XP; },
      ...patch,
    },
  };
}

describe('who plays in the /ask tab\'s dock (PRD 757)', () => {
  it('a player: GitHub linked, their XP, hero and fleet in the workspace the arcade plays, and where scores go', async () => {
    const r = reads();
    const dock = await readAskDock({} as never, user('ada-l'), ENV, r.reads);
    expect(dock).toEqual({ player: { linked: true, xp: XP }, hero: HERO, team: 'beaver', workspace: 'ws-vertuoza', supabase: ENV });
    expect(r.xpFor).toEqual(['Ada-L']);
  });

  it('a member with no GitHub linked reads no XP, and the arcade\'s door refuses them', async () => {
    const r = reads({ me: async () => ({ ...ME, github_login: null }) });
    const dock = await readAskDock({} as never, user(null), ENV, r.reads);
    expect(dock.player).toEqual({ linked: false, xp: null });
    expect(r.xpFor).toEqual([]);
  });

  it('someone in no workspace is refused like a visitor, with nowhere to save a score', async () => {
    const r = reads({ workspace: async () => null });
    const dock = await readAskDock({} as never, user('ada-l'), ENV, r.reads);
    expect(dock).toEqual({ player: { linked: true, xp: null }, hero: null, team: null, workspace: null, supabase: ENV });
  });

  it('the game room out of reach shows no level rather than guess one, and never fails the page', async () => {
    const r = reads({ workspace: async () => { throw new Error('connection lost'); } });
    const dock = await readAskDock({} as never, user('ada-l'), ENV, r.reads);
    expect(dock.player).toEqual({ linked: true, xp: 'unreadable' });
  });
});
