import { describe, it, expect } from 'vitest';
import { foldChar, foldName, nameInit, nameReduce, nameValue, NAME_RULE, type NameAction, type NameState } from './name-entry';

const run = (s: NameState, ...actions: NameAction[]) => actions.reduce((st, a) => nameReduce(st, a).state, s);
const type = (text: string): NameAction[] => [...text].map((char) => ({ type: 'type', char }));

describe('folding', () => {
  it('turns a key into a name character, or nothing', () => {
    expect(foldChar('a')).toBe('A');
    expect(foldChar('é')).toBe('E');
    expect(foldChar('7')).toBe('7');
    expect(foldChar('-')).toBe('-');
    for (const k of [' ', '_', '!', 'Shift', 'ß']) expect(foldChar(k)).toBeNull();
  });

  it('folds a Google first name to what the arcade accepts', () => {
    expect(foldName('Pierre')).toBe('PIERRE');
    expect(foldName('Élodie')).toBe('ELODIE');
    expect(foldName('Jean Marc')).toBe('JEAN-MARC');
    expect(foldName('Anne-Sophie Van den Berg')).toBe('ANNE-SOPHI');
    expect(foldName('  ')).toBe('');
    for (const n of ['Pierre', 'Élodie', 'Jean Marc', 'Anne-Sophie Van den Berg']) expect(foldName(n)).toMatch(NAME_RULE);
  });
});

describe('nameReduce', () => {
  it('types into the next slot and stops at 10, with a buzz', () => {
    const s = run(nameInit(''), ...type('ABCDEFGHIJ'));
    expect(nameValue(s)).toBe('ABCDEFGHIJ');
    expect(s.cursor).toBe(10);
    expect(nameReduce(s, { type: 'type', char: 'K' })).toEqual({ state: s, sound: 'buzz' });
  });

  it('erases the character before the cursor, and buzzes on an empty name', () => {
    expect(nameValue(run(nameInit('PIERRE'), { type: 'erase' }, { type: 'erase' }))).toBe('PIER');
    expect(nameValue(run(nameInit('PIERRE'), { type: 'move', dir: -1 }, { type: 'move', dir: -1 }, { type: 'erase' }))).toBe('PIERE');
    expect(nameReduce(nameInit(''), { type: 'erase' }).sound).toBe('buzz');
  });

  it('spins the letter wheel on the cursor, wrapping both ways', () => {
    expect(nameValue(run(nameInit(''), { type: 'spin', dir: 1 }))).toBe('A');
    expect(nameValue(run(nameInit(''), { type: 'spin', dir: -1 }))).toBe('-');
    expect(nameValue(run(nameInit('A'), { type: 'move', dir: -1 }, { type: 'spin', dir: -1 }))).toBe('-');
    expect(nameValue(run(nameInit('Z'), { type: 'move', dir: -1 }, { type: 'spin', dir: 1 }))).toBe('0');
  });

  it('lets the pad build a name with A alone: A starts a slot at A, then moves on', () => {
    const s = run(nameInit(''), { type: 'advance' }, { type: 'spin', dir: 1 }, { type: 'advance' }, { type: 'advance' });
    expect(nameValue(s)).toBe('BA');
  });

  it('keeps the cursor inside the name', () => {
    expect(run(nameInit('AB'), { type: 'move', dir: 1 }, { type: 'move', dir: 1 }).cursor).toBe(2);
    expect(run(nameInit('AB'), { type: 'move', dir: -1 }, { type: 'move', dir: -1 }, { type: 'move', dir: -1 }).cursor).toBe(0);
  });
});
