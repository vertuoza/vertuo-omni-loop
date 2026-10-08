import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bodyOf } from './kit-push';

const Thing = z.strictObject({ title: z.string().min(1) });

describe('bodyOf', () => {
  it('returns what the schema read', () => {
    expect(bodyOf(Thing, { title: 'a' }, 'An idea')).toEqual({ title: 'a' });
  });

  it('refuses a body that is not a JSON object', () => {
    for (const sent of [null, [], 'text', 3]) {
      expect(bodyOf(Thing, sent, 'An idea')).toEqual({ problem: 'The body must be a JSON object.' });
    }
  });

  it('names a key the schema does not know', () => {
    expect(bodyOf(Thing, { title: 'a', extra: 1 }, 'An idea')).toEqual({ problem: 'An idea does not carry extra.' });
  });

  it('names the malformed field', () => {
    const malformed: unknown = expect.stringMatching(/^An idea's `title` is malformed: /);
    expect(bodyOf(Thing, { title: '' }, 'An idea')).toEqual({ problem: malformed });
  });
});
