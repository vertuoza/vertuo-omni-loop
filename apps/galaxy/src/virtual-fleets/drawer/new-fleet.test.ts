import { describe, expect, it } from 'vitest';
import { canCreate, demoPort, landingOf, newFleetReducer, openedWith, refusalUnder, requestOf, roleSwitch, WORDS, type NewFleetState } from './new-fleet';

// The New virtual fleet drawer's rules (PRD 2842 s1, the `fleet-new` screen).

const MASCOTS = ['beaver', 'octopod', 'robot'];
const named = (name: string): NewFleetState => newFleetReducer(openedWith(MASCOTS), { type: 'name', value: name });

describe('the New virtual fleet drawer', () => {
  it('opens with Name empty, the first icon selected and every role on, Create fleet disabled until it has a name', () => {
    const opened = openedWith(MASCOTS);
    expect(opened).toEqual({ name: '', mascot: 'beaver', roles: ['engineer', 'qa', 'reviewer', 'pm', 'architect'], busy: false, refusal: null });
    expect(canCreate(opened)).toBe(false);
    expect(canCreate(named('Night Shift'))).toBe(true);
    expect(canCreate(named('   '))).toBe(false);
  });

  it('disables Create fleet with every switch off, and enables it again with one on', () => {
    let state = named('Night Shift');
    for (const role of ['engineer', 'qa', 'reviewer', 'pm', 'architect'] as const) state = newFleetReducer(state, { type: 'toggle', role });
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
    expect(state.roles).toEqual(['qa', 'reviewer', 'pm', 'architect']);
  });

  it('sends the name trimmed, the icon and the roles left on', () => {
    const state = newFleetReducer(named('  Night Shift '), { type: 'mascot', value: 'robot' });
    expect(requestOf(state)).toEqual({ name: 'Night Shift', mascot: 'robot', roles: ['engineer', 'qa', 'reviewer', 'pm', 'architect'] });
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
    expect(landingOf('night-shift')).toBe('/app/fleet?fleet=night-shift');
    expect(landingOf('a&b')).toBe('/app/fleet?fleet=a%26b');
  });

  it('says for each role whether it works alone, by its role\'s name', () => {
    expect(roleSwitch('engineer')).toEqual({ role: 'engineer', name: 'Engineer', line: 'Builds PRDs alone' });
    expect(roleSwitch('qa').line).toBe('Proves the work alone');
    for (const role of ['reviewer', 'pm', 'architect'] as const) expect(roleSwitch(role).line).toBe('A person does this today');
  });

  it('makes no fleet in the demo, and says so in the foot', async () => {
    expect(await demoPort.create({ name: 'X', mascot: 'robot', roles: ['qa'] })).toEqual({ ok: false, field: 'form', message: WORDS.demo });
  });
});
