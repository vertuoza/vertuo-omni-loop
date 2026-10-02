import { describe, expect, it } from 'vitest';
import type { FleetRow } from '../arcade/types';
import { activeFleets, BLANK_COLOR, fleetsReducer, initialState, previewOf, retiredFleets, type FleetsState } from './model';
import { sure } from '../arcade/sure';

// /app/settings/fleets's state (PRD 400 s3): the workspace's fleets, the one form being filled (a new fleet or
// an edit), the retire awaiting its confirmation, and the last refusal. Pure, so every step of the
// owner's page is proven here and the view only draws a state.

const fleet = (name: string, over: Partial<FleetRow> = {}): FleetRow => ({
  name, home: null, label: name.toUpperCase(), color: '#d08a4a', motto: '', mascot: null, sort: 10, retired: false, ...over,
});
const BEAVER = fleet('beaver', { mascot: 'beaver', motto: 'Builds the dam.', sort: 10 });
const OCTOPOD = fleet('octopod', { color: '#b07cff', sort: 20 });
const OLD = fleet('old', { retired: true, sort: 5 });

const start = (fleets: FleetRow[] = [BEAVER, OCTOPOD, OLD]) => initialState(fleets);
const run = (state: FleetsState, ...actions: Parameters<typeof fleetsReducer>[1][]) => actions.reduce(fleetsReducer, state);

describe('the fleets page\'s state', () => {
  it('splits the fleets into active and retired, each in the workspace\'s order', () => {
    const state = start([OCTOPOD, OLD, BEAVER]);
    expect(activeFleets(state).map((f) => f.name)).toEqual(['beaver', 'octopod']);
    expect(retiredFleets(state).map((f) => f.name)).toEqual(['old']);
  });

  it('opens with no form, no confirmation and no refusal', () => {
    expect(start()).toMatchObject({ draft: null, confirming: null, refusal: null, busy: false });
  });

  it('New fleet opens a blank form in the first swatch\'s colour', () => {
    expect(run(start(), { type: 'new' }).draft).toEqual({ name: null, label: '', color: BLANK_COLOR, motto: '', mascot: null });
  });

  it('Edit opens the form on the fleet\'s own look, keeping its name', () => {
    expect(run(start(), { type: 'edit', name: 'beaver' }).draft)
      .toEqual({ name: 'beaver', label: 'BEAVER', color: '#d08a4a', motto: 'Builds the dam.', mascot: 'beaver' });
  });

  it('Edit of a fleet that is not there opens nothing', () => {
    expect(run(start(), { type: 'edit', name: 'ghost' }).draft).toBeNull();
  });

  it('each keystroke changes one field of the form, and the preview follows it', () => {
    const state = run(start(), { type: 'new' },
      { type: 'change', field: 'label', value: 'SHARKS' },
      { type: 'change', field: 'color', value: '#2fc6a4' },
      { type: 'change', field: 'motto', value: 'Bite first.' },
      { type: 'change', field: 'mascot', value: 'octopod' });
    expect(previewOf(sure(state.draft, 'state.draft'))).toMatchObject({ label: 'SHARKS', color: '#2fc6a4', motto: 'Bite first.', mascot: 'octopod' });
  });

  it('the preview of a blank label still reads as a card, and an unfinished colour draws the default', () => {
    const state = run(start(), { type: 'new' }, { type: 'change', field: 'color', value: '#2fc' });
    expect(previewOf(sure(state.draft, 'state.draft'))).toMatchObject({ label: 'NEW FLEET', color: '#cfd4e6' });
  });

  it('an empty mascot is none', () => {
    const state = run(start(), { type: 'edit', name: 'beaver' }, { type: 'change', field: 'mascot', value: '' });
    expect(sure(state.draft, 'state.draft').mascot).toBeNull();
  });

  it('a refusal is kept until the field it names changes', () => {
    const refused = run(start(), { type: 'new' }, { type: 'busy' }, { type: 'refused', refusal: { field: 'label', message: 'Label: 1 to 12 characters.' } });
    expect(refused).toMatchObject({ busy: false, refusal: { field: 'label' } });
    expect(run(refused, { type: 'change', field: 'motto', value: 'x' }).refusal).not.toBeNull();
    expect(run(refused, { type: 'change', field: 'label', value: 'OK' }).refusal).toBeNull();
  });

  it('a saved new fleet joins the list and closes the form', () => {
    const made = fleet('sharks', { sort: 30 });
    const state = run(start(), { type: 'new' }, { type: 'busy' }, { type: 'saved', fleet: made });
    expect(state).toMatchObject({ draft: null, busy: false, refusal: null });
    expect(activeFleets(state).map((f) => f.name)).toEqual(['beaver', 'octopod', 'sharks']);
  });

  it('a saved edit replaces the fleet in place, under the same name', () => {
    const state = run(start(), { type: 'edit', name: 'beaver' }, { type: 'saved', fleet: { ...BEAVER, label: 'DAMS' } });
    expect(activeFleets(state).map((f) => [f.name, f.label])).toEqual([['beaver', 'DAMS'], ['octopod', 'OCTOPOD']]);
  });

  it('Retire asks first, on the page, and Keep takes the question back', () => {
    const asked = run(start(), { type: 'ask-retire', name: 'octopod' });
    expect(asked.confirming).toBe('octopod');
    expect(run(asked, { type: 'keep' }).confirming).toBeNull();
    expect(activeFleets(run(asked, { type: 'keep' })).map((f) => f.name)).toContain('octopod');
  });

  it('a retired fleet moves under the fold, and a restored one comes back', () => {
    const retired = run(start(), { type: 'ask-retire', name: 'octopod' }, { type: 'saved', fleet: { ...OCTOPOD, retired: true } });
    expect(retired.confirming).toBeNull();
    expect(retiredFleets(retired).map((f) => f.name)).toEqual(['old', 'octopod']);
    const restored = run(retired, { type: 'saved', fleet: { ...OCTOPOD, retired: false } });
    expect(activeFleets(restored).map((f) => f.name)).toEqual(['beaver', 'octopod']);
  });

  it('Cancel closes the form and forgets its refusal', () => {
    const state = run(start(), { type: 'new' }, { type: 'refused', refusal: { field: 'form', message: 'x' } }, { type: 'cancel' });
    expect(state).toMatchObject({ draft: null, refusal: null });
  });
});
