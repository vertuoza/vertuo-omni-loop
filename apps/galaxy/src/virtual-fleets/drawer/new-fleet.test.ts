import { describe, expect, it } from 'vitest';
import { canCreate, canWorkAlone, demoPort, landingOf, levelDisabled, LEVELS, newFleetReducer, openedWith, refusalUnder, requestOf, roleSwitch, WORDS, type NewFleetState } from './new-fleet';

// The New AI fleet drawer's rules (PRD 2842 s1, PRD 2873 s3, the `fleet-new` screen).

const MASCOTS = ['beaver', 'octopod', 'robot'];
const named = (name: string): NewFleetState => newFleetReducer(openedWith(MASCOTS), { type: 'name', value: name });

describe('the New AI fleet drawer', () => {
  it('opens with Name empty, the first icon selected and every role on, Create fleet disabled until it has a name', () => {
    const opened = openedWith(MASCOTS);
    expect(opened).toEqual({ name: '', mascot: 'beaver', roles: ['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'], level: 'with-you', owner: false, busy: false, refusal: null });
    expect(canCreate(opened)).toBe(false);
    expect(canCreate(named('Night Shift'))).toBe(true);
    expect(canCreate(named('   '))).toBe(false);
  });

  it('disables Create fleet with every switch off, and enables it again with one on', () => {
    let state = named('Night Shift');
    for (const role of ['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'] as const) state = newFleetReducer(state, { type: 'toggle', role });
    expect(state.roles).toEqual([]);
    expect(canCreate(state)).toBe(false);
    state = newFleetReducer(state, { type: 'toggle', role: 'pm' });
    expect(state.roles).toEqual(['pm']);
    expect(canCreate(state)).toBe(true);
  });

  it('keeps the roles in the drawer\'s order whatever order they are switched in', () => {
    let state = named('Night Shift');
    state = newFleetReducer(state, { type: 'toggle', role: 'qa' });
    state = newFleetReducer(state, { type: 'toggle', role: 'engineer' });
    state = newFleetReducer(state, { type: 'toggle', role: 'qa' });
    expect(state.roles).toEqual(['qa', 'reviewer', 'pm', 'architect', 'designer']);
  });

  it('sends the name trimmed, the icon and the roles left on', () => {
    const state = newFleetReducer(named('  Night Shift '), { type: 'mascot', value: 'robot' });
    expect(requestOf(state)).toEqual({ name: 'Night Shift', mascot: 'robot', roles: ['engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'], level: 'with-you' });
  });

  it('creates nothing with a name longer than 12 characters', () => {
    expect(canCreate(named('Twelve chars'))).toBe(true);
    expect(canCreate(named('Thirteen char'))).toBe(false);
    expect(canCreate(named('  Twelve chars  '))).toBe(true);
  });

  it('shows a refusal under its field and clears it when that field changes, leaving the others', () => {
    let state = newFleetReducer(named('Beaver'), { type: 'busy' });
    expect(canCreate(state)).toBe(false);
    state = newFleetReducer(state, { type: 'refused', field: 'name', message: 'Name taken: choose another' });
    expect(state.busy).toBe(false);
    expect(refusalUnder(state, 'name')).toBe('Name taken: choose another');
    expect(refusalUnder(state, 'form')).toBeNull();
    expect(refusalUnder(newFleetReducer(state, { type: 'mascot', value: 'robot' }), 'name')).toBe('Name taken: choose another');
    expect(refusalUnder(newFleetReducer(state, { type: 'toggle', role: 'qa' }), 'name')).toBe('Name taken: choose another');
    expect(refusalUnder(newFleetReducer(state, { type: 'name', value: 'Beavers' }), 'name')).toBeNull();
    const foot = newFleetReducer(state, { type: 'refused', field: 'form', message: 'Try again.' });
    expect(refusalUnder(newFleetReducer(foot, { type: 'toggle', role: 'qa' }), 'form')).toBeNull();
  });

  it('lands on the new fleet in the Fleet section', () => {
    expect(landingOf('night-shift')).toBe('/app/ai-fleet?fleet=night-shift');
    expect(landingOf('a&b')).toBe('/app/ai-fleet?fleet=a%26b');
  });

  it('gives each role its count line, by its role\'s name', () => {
    expect(roleSwitch('engineer')).toEqual({ role: 'engineer', name: 'Engineer', line: 'Runs 11 of 14 skills alone' });
    expect(roleSwitch('qa').line).toBe('Runs 3 of 4 skills alone');
    expect(roleSwitch('reviewer').line).toBe('Runs 1 of 2 skills alone');
    expect(roleSwitch('designer')).toEqual({ role: 'designer', name: 'Designer', line: 'Runs 1 of 3 skills alone' });
  });

  it('makes no fleet in the demo, and says so in the foot', async () => {
    expect(await demoPort.create({ name: 'X', mascot: 'robot', roles: ['qa'], level: 'with-you' })).toEqual({ ok: false, field: 'form', message: WORDS.demo });
  });
});

describe('the New AI fleet drawer, once the fleet is made (#2866)', () => {
  it('stops being busy and names where it lands, so the drawer closes on the new fleet instead of staying on Creating…', () => {
    const busy = newFleetReducer(named('Invincibles'), { type: 'busy' });
    expect(busy.busy).toBe(true);
    const made = newFleetReducer(busy, { type: 'made', fleet: 'invincibles' } as never);
    expect({ busy: made.busy, landing: (made as NewFleetState & { landing?: string | null }).landing }).toEqual({ busy: false, landing: landingOf('invincibles') });
  });
});

describe('the New AI fleet drawer\'s level (PRD 2896 s1)', () => {
  const owned = (): NewFleetState => newFleetReducer(openedWith(MASCOTS, true), { type: 'name', value: 'Night Shift' });

  it('offers the three levels with their lines, Reviews with you selected as it opens', () => {
    expect(LEVELS.map((l) => [l.level, l.name, l.line])).toEqual([
      ['with-you', 'Reviews with you', 'You merge each PRD'],
      ['own-branch', 'Own branch', 'You land the mission'],
      ['alone', 'Works alone', 'Asks you when needed'],
    ]);
    expect(openedWith(MASCOTS).level).toBe('with-you');
  });

  it('lets a member who is not an owner keep Reviews with you only, and ignores a choice of another', () => {
    const state = named('Night Shift');
    expect(LEVELS.map((l) => levelDisabled(state, l.level))).toEqual([false, true, true]);
    expect(newFleetReducer(state, { type: 'level', level: 'alone' })).toBe(state);
  });

  it('lets an owner choose each level while the PM, the Architect and the Reviewer are on', () => {
    let state = owned();
    expect(LEVELS.map((l) => levelDisabled(state, l.level))).toEqual([false, false, false]);
    state = newFleetReducer(state, { type: 'level', level: 'alone' });
    expect(state.level).toBe('alone');
    expect(requestOf(state).level).toBe('alone');
  });

  it('disables Works alone without a PM, an Architect or a Reviewer, and drops it to Own branch when one is switched off', () => {
    expect(canWorkAlone(['pm', 'architect', 'reviewer'])).toBe(true);
    expect(canWorkAlone(['pm', 'reviewer'])).toBe(false);
    for (const role of ['pm', 'architect', 'reviewer'] as const) {
      const alone = newFleetReducer(owned(), { type: 'level', level: 'alone' });
      const without = newFleetReducer(alone, { type: 'toggle', role });
      expect(levelDisabled(without, 'alone')).toBe(true);
      expect(without.level).toBe('own-branch');
    }
    const kept = newFleetReducer(newFleetReducer(owned(), { type: 'level', level: 'own-branch' }), { type: 'toggle', role: 'pm' });
    expect(kept.level).toBe('own-branch');
  });

  it('shows a level refusal under Level, and clears it when the level changes', () => {
    const refused = newFleetReducer(owned(), { type: 'refused', field: 'level', message: 'Level: x' });
    expect(refusalUnder(refused, 'level')).toBe('Level: x');
    expect(refusalUnder(newFleetReducer(refused, { type: 'level', level: 'own-branch' }), 'level')).toBeNull();
  });
});
