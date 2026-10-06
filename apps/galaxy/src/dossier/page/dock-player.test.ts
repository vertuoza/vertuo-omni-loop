import { describe, expect, it } from 'vitest';
import { readDockPlayer } from './dock-player';

// Who is at the dossier page, as the play dock needs it (PRD 757, s4): whether GitHub is linked, their
// XP in the dossier's workspace, and their hero and fleet, read as them. A read that fails never takes
// the page with it: XP unread reads 'unreadable' (the arcade's own refusal), a player row unread draws
// the default hero.

const WS = '00000000-0000-4000-8000-00000000a0a0';
const HERO = { v: 1, body: 'boy', skin: 2, hair: 1, suit: 3, cape: 0 };
const github = (login: string) => ({ identities: [{ provider: 'github', identity_data: { user_name: login } }] });

type Rows = { players?: unknown; player_xp?: unknown; fail?: string[] };
function db({ players = null, player_xp = null, fail = [] }: Rows) {
  const seen: string[] = [];
  return {
    seen,
    from(table: string) {
      const q = {
        select: () => q,
        eq: (col: string, v: string) => { seen.push(`${table}.${col}=${v}`); return q; },
        maybeSingle: () => Promise.resolve(fail.includes(table)
          ? { data: null, error: { message: 'down' } }
          : { data: table === 'players' ? players : player_xp, error: null }),
      };
      return q;
    },
  };
}

describe('readDockPlayer', () => {
  it('reads a linked player\'s XP by lower-cased login, and their hero and fleet, in the dossier\'s workspace', async () => {
    const d = db({ players: { team: 'beaver', hero: HERO, github_login: 'Ada' }, player_xp: { xp: 180, level: 3, unlocked: ['invaders'] } });
    const got = await readDockPlayer(d as never, { id: 'u1', ...github('Ada') } as never, WS);
    expect(got).toEqual({ player: { linked: true, xp: { xp: 180, level: 3, unlocked: ['invaders'] } }, hero: HERO, team: 'beaver', workspace: WS });
    expect(d.seen).toContain('player_xp.github_login=ada');
    expect(d.seen).toContain(`player_xp.workspace_id=${WS}`);
  });

  it('reads no XP for someone without GitHub linked: the arcade refuses them', async () => {
    const d = db({});
    const got = await readDockPlayer(d as never, { id: 'u1', identities: [] }, WS);
    expect(got.player).toEqual({ linked: false, xp: null });
    expect(d.seen.some((s) => s.startsWith('player_xp'))).toBe(false);
  });

  it('keeps the page when the reads fail: XP unreadable, no hero', async () => {
    const d = db({ fail: ['players', 'player_xp'] });
    const got = await readDockPlayer(d as never, { id: 'u1', ...github('ada') } as never, WS);
    expect(got).toEqual({ player: { linked: true, xp: 'unreadable' }, hero: null, team: null, workspace: WS });
  });
});
