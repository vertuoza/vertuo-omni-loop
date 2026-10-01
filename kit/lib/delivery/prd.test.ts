// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { whereIs } from './prd.ts';

const D = '.omni-loop/delivery';

describe('whereIs', () => {
  it('describes a PRD in flight', () => {
    const { ctx } = makeRepo({ files: { [`${D}/inbox/0042-a/spec.md`]: 'x', [`${D}/outbox/0042-a/s1-01-x.md`]: 'y' } });
    expect(whereIs(ctx, '42')).toEqual({
      prd: 42, name: '0042-a', state: 'inbox', dir: `${D}/inbox/0042-a`,
      files: [`${D}/inbox/0042-a/spec.md`],
      outboxDir: `${D}/outbox/0042-a`,
      openItems: [`${D}/outbox/0042-a/s1-01-x.md`],
      repos: [],
    });
  });
  it('is null for an unknown PRD', () => {
    expect(whereIs(makeRepo().ctx, 1)).toBeNull();
  });
});
