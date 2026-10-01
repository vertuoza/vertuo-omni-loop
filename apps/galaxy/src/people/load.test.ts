import { describe, expect, it, vi } from 'vitest';
import { loadPeople, peopleOf } from './load';

// The people directory (PRD 652), on a fake client: one roster read and one fleets read per page, then
// every person a screen names resolves by account id or by GitHub login, with their face and fleet.
// A failed read never fails the page: every lookup falls back to the GitHub photo or the initial.

const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };
const ROSTER = [
  { user_id: 'u-ada', name: 'ADA', github_login: 'ada-gh', avatar_url: 'https://a.test/ada.png', fleet: 'octo', hero: HERO },
  { user_id: 'u-paul', name: 'Paul Etienne', github_login: 'paetienne', avatar_url: null, fleet: null, hero: null },
  { user_id: 'u-sol', name: null, github_login: null, avatar_url: null, fleet: 'gone', hero: null },
];
const FLEETS = [{ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod', home: null, motto: '', sort: 1, retired_at: null }];

function fakeDb({ roster = ROSTER as unknown, rosterError = null as { message: string } | null, fleetsError = null as { message: string } | null } = {}) {
  const rpc = vi.fn(async () => ({ data: rosterError ? null : roster, error: rosterError }));
  const eq = vi.fn(async () => ({ data: fleetsError ? null : FLEETS, error: fleetsError }));
  const from = vi.fn(() => ({ select: () => ({ eq }) }));
  return { db: { rpc, from } as never, rpc, from, eq };
}

describe('loadPeople', () => {
  it('reads the roster and the fleets once, for the workspace', async () => {
    const { db, rpc, from, eq } = fakeDb();
    await loadPeople(db, 'w-1');
    expect(rpc).toHaveBeenCalledWith('workspace_roster', { workspace: 'w-1' });
    expect(from).toHaveBeenCalledWith('teams');
    expect(eq).toHaveBeenCalledWith('workspace_id', 'w-1');
  });

  it('resolves a member by account id: the name the screen prints, their hero, their fleet with its mascot', async () => {
    const people = await loadPeople(fakeDb().db, 'w-1');
    const ada = people.byId('u-ada', 'Ada L.');
    expect(ada.name).toBe('Ada L.');
    expect(ada.face.kind).toBe('hero');
    expect(ada.fleet).toEqual({ name: 'octo', label: 'OCTO', color: '#3355ff', mascot: 'octopod' });
    expect(people.byId('u-paul', 'Paul').fleet).toBe('solo');
    expect(people.byId('u-sol', 'Sol').fleet).toEqual({ name: 'gone', label: 'GONE', color: null, mascot: null });
  });

  it('resolves a member by login, ignoring case, the login as the name by default', async () => {
    const people = await loadPeople(fakeDb().db, 'w-1');
    expect(people.byLogin('PaEtienne')).toEqual({
      name: 'PaEtienne', face: { kind: 'photo', url: 'https://github.com/paetienne.png?size=48' }, fleet: 'solo', login: 'paetienne',
    });
    expect(people.byLogin('ADA-GH', 'ada').face.kind).toBe('hero');
  });

  it('gives someone outside the workspace their GitHub photo, and an unknown account its initial', async () => {
    const people = await loadPeople(fakeDb().db, 'w-1');
    expect(people.byLogin('stranger')).toEqual({ name: 'stranger', face: { kind: 'photo', url: 'https://github.com/stranger.png?size=48' }, fleet: null });
    expect(people.byId('u-nobody', 'nobody')).toEqual({ name: 'nobody', face: { kind: 'initial', letter: 'N' }, fleet: null });
  });

  it('with the roster out of reach, logs it and falls back for everyone: never an error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const people = await loadPeople(fakeDb({ rosterError: { message: 'boom' } }).db, 'w-1');
    expect(people.byLogin('ada-gh').face).toEqual({ kind: 'photo', url: 'https://github.com/ada-gh.png?size=48' });
    expect(people.byId('u-ada', 'ADA').face).toEqual({ kind: 'initial', letter: 'A' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('with the fleets out of reach, the members keep their faces and their fleets by name', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const people = await loadPeople(fakeDb({ fleetsError: { message: 'boom' } }).db, 'w-1');
    const ada = people.byId('u-ada', 'ADA');
    expect(ada.face.kind).toBe('hero');
    expect(ada.fleet).toEqual({ name: 'octo', label: 'OCTO', color: null, mascot: null });
    log.mockRestore();
  });

  it('carries a member\'s login in lower case, by id or by login, so their chip links to their profile (PRD 698)', async () => {
    const people = peopleOf([{ ...ROSTER[0]!, github_login: 'Ada-GH' }, ...ROSTER.slice(1)], FLEETS);
    expect(people.byId('u-ada', 'ADA').login).toBe('ada-gh');
    expect(people.byLogin('ADA-gh').login).toBe('ada-gh');
    expect(people.byId('u-sol', 'Sol')).not.toHaveProperty('login');
    expect(people.byLogin('stranger')).not.toHaveProperty('login');
    expect(people.byId('u-nobody', 'nobody')).not.toHaveProperty('login');
  });

  it('peopleOf builds the same directory from rows already read', () => {
    const people = peopleOf([], []);
    expect(people.byLogin('x').face).toEqual({ kind: 'photo', url: 'https://github.com/x.png?size=48' });
  });
});
