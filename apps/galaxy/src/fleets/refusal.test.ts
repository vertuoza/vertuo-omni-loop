import { describe, expect, it } from 'vitest';
import { refusalOf } from './refusal';

// How /app/settings/fleets reads a refusal from the fleet functions (PRD 400 s1): a field's refusal carries
// SQLSTATE 22023 and the field's name as its hint, so the page shows it next to that field; anything
// else is the form's.

describe('a refusal from the fleet functions', () => {
  it.each(['label', 'color', 'motto', 'mascot', 'fleets'] as const)('names the %s field when its hint does', (field) => {
    const message = `${field}: refused.`;
    expect(refusalOf({ code: '22023', hint: field, message })).toEqual({ field, message });
  });

  it('shows the database\'s own words for a field', () => {
    expect(refusalOf({ code: '22023', hint: 'label', message: 'Label: 1 to 12 characters.' }))
      .toEqual({ field: 'label', message: 'Label: 1 to 12 characters.' });
  });

  it('is the form\'s when the caller is not the owner', () => {
    expect(refusalOf({ code: '42501', message: 'Only the workspace\'s owner can change its fleets.' }))
      .toEqual({ field: 'form', message: 'Only the workspace’s owner can change its fleets.' });
  });

  it('is the form\'s when the fleet is gone', () => {
    expect(refusalOf({ code: 'P0002', hint: 'name', message: 'Fleet: no fleet x in this workspace.' }))
      .toEqual({ field: 'form', message: 'That fleet is no longer in this workspace. Reload the page.' });
  });

  it('is the form\'s for an unknown hint, and never a field it does not know', () => {
    expect(refusalOf({ code: '22023', hint: 'sort', message: 'Sort: no.' })).toEqual({ field: 'form', message: 'Sort: no.' });
  });

  it('says it could not save for anything else, a lost connection included', () => {
    expect(refusalOf({ message: 'TypeError: fetch failed' }))
      .toEqual({ field: 'form', message: 'Couldn’t save this. Try again in a moment.' });
    expect(refusalOf(new Error('boom'))).toEqual({ field: 'form', message: 'Couldn’t save this. Try again in a moment.' });
  });
});
