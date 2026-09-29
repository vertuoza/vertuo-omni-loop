import { describe, expect, it } from 'vitest';
import { chooseFleet } from './pick';

// Which fleet /app/fleet shows (PRD 572): yours by default, any by `?fleet`, the picker otherwise.

const FLEETS = ['octo', 'beaver'];

describe('chooseFleet', () => {
  it('shows your fleet with no ?fleet', () => {
    expect(chooseFleet({ asked: null, mine: 'octo', fleets: FLEETS })).toEqual({ kind: 'fleet', fleet: 'octo' });
  });

  it('shows the fleet ?fleet names, yours or not', () => {
    expect(chooseFleet({ asked: 'beaver', mine: 'octo', fleets: FLEETS })).toEqual({ kind: 'fleet', fleet: 'beaver' });
    expect(chooseFleet({ asked: 'beaver', mine: null, fleets: FLEETS })).toEqual({ kind: 'fleet', fleet: 'beaver' });
  });

  it('asks to pick with no fleet of your own and no ?fleet', () => {
    expect(chooseFleet({ asked: null, mine: null, fleets: FLEETS })).toEqual({ kind: 'pick' });
  });

  it('asks to pick when ?fleet names no fleet of the workspace, even with one of your own', () => {
    expect(chooseFleet({ asked: 'ghosts', mine: 'octo', fleets: FLEETS })).toEqual({ kind: 'pick' });
  });

  it('says the workspace has no fleet yet, whatever was asked', () => {
    expect(chooseFleet({ asked: null, mine: null, fleets: [] })).toEqual({ kind: 'none' });
    expect(chooseFleet({ asked: 'octo', mine: 'octo', fleets: [] })).toEqual({ kind: 'none' });
  });

  it('with the fleets unreadable, takes a named fleet at its word', () => {
    expect(chooseFleet({ asked: 'octo', mine: null, fleets: 'unreadable' })).toEqual({ kind: 'fleet', fleet: 'octo' });
    expect(chooseFleet({ asked: null, mine: 'beaver', fleets: 'unreadable' })).toEqual({ kind: 'fleet', fleet: 'beaver' });
    expect(chooseFleet({ asked: null, mine: null, fleets: 'unreadable' })).toEqual({ kind: 'pick' });
  });
});
