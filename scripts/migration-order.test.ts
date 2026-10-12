import { describe, expect, it } from 'vitest';
import { outOfOrder, versionOf } from './migration-order.ts';

const BASE = ['20261129110000_product_lookups.sql', '20261201090000_arcade_kart_times.sql'];

describe('a new migration is dated after the base’s newest', () => {
  it('reads the version before the first underscore', () => {
    expect(versionOf('20261202090000_drop_repository_product.sql')).toBe('20261202090000');
  });

  it('refuses a new migration dated before the newest, naming it (PRD 1364 landing 3)', () => {
    const head = [...BASE, '20261129120000_drop_repository_product.sql'];
    expect(outOfOrder(BASE, head)).toEqual([
      { file: '20261129120000_drop_repository_product.sql', newest: '20261201090000_arcade_kart_times.sql' },
    ]);
  });

  it('refuses one on the newest’s own version', () => {
    expect(outOfOrder(BASE, [...BASE, '20261201090000_other.sql'])).toHaveLength(1);
  });

  it('passes a new migration dated after the newest, and the base’s own files', () => {
    expect(outOfOrder(BASE, [...BASE, '20261202090000_drop_repository_product.sql'])).toEqual([]);
    expect(outOfOrder(BASE, BASE)).toEqual([]);
  });

  it('passes anything on an empty base', () => {
    expect(outOfOrder([], ['20261129120000_a.sql'])).toEqual([]);
  });
});
