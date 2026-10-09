import { describe, expect, it } from 'vitest';
import {
  addable, collectionLabel, hasNoAccess, initialState, repositoriesReducer, rowOf, type RepositoryRow,
} from './model';

// Settings → Repositories as pure data (PRD 612 s1): a stored row as the page reads it, the
// collection line of each row, what Add repository offers, which rows the App cannot read, and the
// page's state through its actions.

const NOW = Date.parse('2026-10-08T12:00:00Z');
const row = (fullName: string, over: Partial<RepositoryRow> = {}): RepositoryRow => ({
  fullName, tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false, ...over,
});

describe('a stored repository row', () => {
  it('reads as the page draws it', () => {
    expect(rowOf({ full_name: 'vertuoza/vertuo-apps', tracked: false, collected_at: '2026-10-08T11:57:00Z', collect_error: null }))
      .toEqual({ fullName: 'vertuoza/vertuo-apps', tracked: false, collectedAt: '2026-10-08T11:57:00Z', collectError: null, product: null, publicIdeas: false });
  });

  it('reads the product it serves (PRD 748 s4)', () => {
    expect(rowOf({ full_name: 'a/b', tracked: true, product_id: 'p-2' }).product).toBe('p-2');
  });
});

describe('the collection line', () => {
  it('says a repository never collected is not collected yet', () => {
    expect(collectionLabel(row('a/b'), NOW)).toBe('not collected yet');
  });

  it('says how long ago the last collection finished', () => {
    expect(collectionLabel(row('a/b', { collectedAt: '2026-10-08T11:57:00Z' }), NOW)).toBe('collected 3 min ago');
    expect(collectionLabel(row('a/b', { collectedAt: '2026-10-08T11:59:40Z' }), NOW)).toBe('collected just now');
    expect(collectionLabel(row('a/b', { collectedAt: '2026-10-08T09:00:00Z' }), NOW)).toBe('collected 3 h ago');
    expect(collectionLabel(row('a/b', { collectedAt: '2026-10-06T12:00:00Z' }), NOW)).toBe('collected 2 d ago');
  });

  it('says a failed collection is retried, whether or not one succeeded before', () => {
    expect(collectionLabel(row('a/b', { collectError: 'rate limited' }), NOW)).toBe('last collection failed · retrying');
    expect(collectionLabel(row('a/b', { collectedAt: '2026-10-08T11:57:00Z', collectError: '404' }), NOW)).toBe('last collection failed · retrying');
  });
});

describe('what Add repository offers', () => {
  it('is what the App can see minus what is listed, whatever the case, by name', () => {
    const listed = [row('vertuoza/vertuo-apps'), row('vertuoza/pdf-builder', { tracked: false })];
    expect(addable(listed, ['Vertuoza/zeta', 'vertuoza/Vertuo-Apps', 'vertuoza/alpha', 'vertuoza/pdf-builder'])).toEqual(['vertuoza/alpha', 'Vertuoza/zeta']);
  });

  it('is nothing when every repository the App sees is listed', () => {
    expect(addable([row('a/b')], ['A/B'])).toEqual([]);
  });
});

describe('a repository the App cannot read', () => {
  it('is one the App\'s listing does not hold', () => {
    expect(hasNoAccess(row('vertuoza/secret'), ['vertuoza/vertuo-apps'])).toBe(true);
    expect(hasNoAccess(row('vertuoza/vertuo-apps'), ['Vertuoza/Vertuo-Apps'])).toBe(false);
  });

  it('is none when the listing could not be read', () => {
    expect(hasNoAccess(row('vertuoza/secret'), null)).toBe(false);
  });
});

describe('the page\'s state', () => {
  const start = () => initialState([row('vertuoza/b'), row('vertuoza/a')]);

  it('lists the repositories by name', () => {
    expect(start().repositories.map((r) => r.fullName)).toEqual(['vertuoza/a', 'vertuoza/b']);
  });

  it('opens and closes the Add list', () => {
    const open = repositoriesReducer(start(), { type: 'pick' });
    expect(open.picking).toBe(true);
    expect(repositoriesReducer(open, { type: 'close' }).picking).toBe(false);
  });

  it('adds a saved repository in its place, and closes the Add list', () => {
    const s = [{ type: 'pick' } as const, { type: 'busy' } as const, { type: 'saved', repository: row('vertuoza/aa') } as const]
      .reduce(repositoriesReducer, start());
    expect(s.repositories.map((r) => r.fullName)).toEqual(['vertuoza/a', 'vertuoza/aa', 'vertuoza/b']);
    expect(s.picking).toBe(false);
    expect(s.busy).toBe(false);
  });

  it('replaces a switched repository', () => {
    const s = repositoriesReducer(start(), { type: 'saved', repository: row('vertuoza/a', { tracked: false }) });
    expect(s.repositories.find((r) => r.fullName === 'vertuoza/a')?.tracked).toBe(false);
    expect(s.repositories).toHaveLength(2);
  });

  it('keeps a refusal until the next action', () => {
    const refused = repositoriesReducer(start(), { type: 'refused', message: 'No.' });
    expect(refused.refusal).toBe('No.');
    expect(refused.busy).toBe(false);
    expect(repositoriesReducer(refused, { type: 'pick' }).refusal).toBeNull();
  });
});
