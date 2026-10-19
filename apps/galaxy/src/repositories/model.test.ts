import { describe, expect, it } from 'vitest';
import {
  addable, collectionLabel, hasNoAccess, initialState, listedOf, phase0Of, removeConfirm, repositoriesReducer, repositoryRowOf, SavedRepository,
  type RepositoryRow,
} from './model';

// Settings → Repositories as pure data (PRD 612 s1): a stored row as the page reads it, the
// collection line of each row, what Add repository offers, which rows the App cannot read, and the
// page's state through its actions.

const NOW = Date.parse('2026-10-08T12:00:00Z');
const row = (fullName: string, over: Partial<RepositoryRow> = {}): RepositoryRow => ({
  fullName, tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, ...over,
});

describe('a stored repository row', () => {
  it('reads as the page draws it', () => {
    expect(repositoryRowOf({ full_name: 'vertuoza/vertuo-apps', tracked: false, collected_at: '2026-10-08T11:57:00Z', collect_error: null }))
      .toEqual({ fullName: 'vertuoza/vertuo-apps', tracked: false, collectedAt: '2026-10-08T11:57:00Z', collectError: null, products: [], publicIdeas: false, phase0: 'pr', removedAt: null, planProducts: [] });
  });

  it('reads when it was removed, and the products that plan in it (PRD 2188 s1)', () => {
    const r = repositoryRowOf({ full_name: 'a/b', tracked: false, removed_at: '2026-10-19T10:00:00Z' }, [], [{ id: 'p-1', name: 'Mobile' }]);
    expect(r.removedAt).toBe('2026-10-19T10:00:00Z');
    expect(r.planProducts).toEqual([{ id: 'p-1', name: 'Mobile' }]);
    expect(repositoryRowOf({ full_name: 'a/b', tracked: true, removed_at: null }).removedAt).toBeNull();
  });

  it('parses a saved row only with its removed_at, a time or null (PRD 2188 s1)', () => {
    const saved = {
      workspace_id: 'ws-1', full_name: 'a/b', tracked: false, added_at: '2026-10-08T09:00:00Z', added_by: null,
      collected_at: null, collected_until: null, collect_error: null, public_ideas: false, phase0: 'pr', removed_at: '2026-10-19T10:00:00Z',
    };
    expect(SavedRepository.safeParse(saved).success).toBe(true);
    expect(SavedRepository.safeParse({ ...saved, removed_at: null }).success).toBe(true);
    expect(SavedRepository.safeParse({ ...saved, removed_at: undefined }).success).toBe(false);
  });

  it('carries the products that link it, read beside the row (PRD 1364 s11)', () => {
    expect(repositoryRowOf({ full_name: 'a/b', tracked: true }, [{ id: 'p-2', name: 'Omni Loop' }]).products).toEqual([{ id: 'p-2', name: 'Omni Loop' }]);
  });

  it('reads where its phase 0 is approved, pr when the row does not say (PRD 1299 s1)', () => {
    expect(repositoryRowOf({ full_name: 'a/b', tracked: true, phase0: 'server' }).phase0).toBe('server');
    expect(repositoryRowOf({ full_name: 'a/b', tracked: true, phase0: 'pr' }).phase0).toBe('pr');
    expect(repositoryRowOf({ full_name: 'a/b', tracked: true }).phase0).toBe('pr');
    expect(phase0Of(row('a/b'))).toBe('pr');
    expect(phase0Of(row('a/b', { phase0: 'server' }))).toBe('server');
  });

  it('parses a saved row only with a phase 0 it knows (PRD 1299 s1)', () => {
    const saved = {
      workspace_id: 'ws-1', full_name: 'a/b', tracked: true, added_at: '2026-10-08T09:00:00Z', added_by: null,
      collected_at: null, collected_until: null, collect_error: null, public_ideas: false, phase0: 'server', removed_at: null,
    };
    expect(SavedRepository.safeParse(saved).success).toBe(true);
    expect(SavedRepository.safeParse({ ...saved, phase0: 'both' }).success).toBe(false);
    expect(SavedRepository.safeParse({ ...saved, phase0: undefined }).success).toBe(false);
  });

  it('parses a saved row with no product: its products are its links (PRD 1364)', () => {
    const saved = {
      workspace_id: 'ws-1', full_name: 'a/b', tracked: true, added_at: '2026-10-08T09:00:00Z', added_by: null,
      collected_at: null, collected_until: null, collect_error: null, public_ideas: false, phase0: 'pr', removed_at: null,
    };
    expect(SavedRepository.safeParse(saved).success).toBe(true);
    expect(SavedRepository.safeParse({ ...saved, product_id: null }).success).toBe(false);
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

  it('offers a removed repository again (PRD 2188 s1)', () => {
    expect(addable([row('a/b', { removedAt: '2026-10-19T10:00:00Z' }), row('a/c')], ['a/b', 'a/c'])).toEqual(['a/b']);
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

  it('keeps a repository\'s products when a save answers its row, which carries none (PRD 1364 s11)', () => {
    const chips = [{ id: 'p-1', name: 'Vertuoza' }];
    const s = repositoriesReducer(initialState([row('vertuoza/a', { products: chips })]), { type: 'saved', repository: row('vertuoza/a', { tracked: false }) });
    expect(s.repositories).toEqual([row('vertuoza/a', { tracked: false, products: chips })]);
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

  it('draws only the listed repositories, never a removed one (PRD 2188 s1)', () => {
    const s = initialState([row('vertuoza/b'), row('vertuoza/gone', { removedAt: '2026-10-19T10:00:00Z' }), row('vertuoza/a', { removedAt: null })]);
    expect(listedOf(s.repositories).map((r) => r.fullName)).toEqual(['vertuoza/a', 'vertuoza/b']);
  });

  it('takes a removed repository off the list, out of its products and its plans (PRD 2188 s1)', () => {
    const chips = [{ id: 'p-1', name: 'Vertuoza' }];
    const before = initialState([row('vertuoza/a', { products: chips, planProducts: chips }), row('vertuoza/b', { products: chips })]);
    const s = [{ type: 'busy' } as const, { type: 'removed', repository: row('vertuoza/a', { tracked: false, removedAt: '2026-10-19T10:00:00Z' }) } as const]
      .reduce(repositoriesReducer, before);
    expect(s.busy).toBe(false);
    expect(listedOf(s.repositories).map((r) => r.fullName)).toEqual(['vertuoza/b']);
    expect(s.repositories.find((r) => r.fullName === 'vertuoza/a')).toEqual(
      row('vertuoza/a', { tracked: false, removedAt: '2026-10-19T10:00:00Z', products: [], planProducts: [] }));
    expect(s.repositories.find((r) => r.fullName === 'vertuoza/b')?.products).toEqual(chips);
  });

  it('keeps the products that plan in a repository when a save answers its row (PRD 2188 s1)', () => {
    const plans = [{ id: 'p-1', name: 'Mobile' }];
    const s = repositoriesReducer(initialState([row('vertuoza/a', { planProducts: plans })]), { type: 'saved', repository: row('vertuoza/a', { tracked: false, planProducts: [] }) });
    expect(s.repositories[0]?.planProducts).toEqual(plans);
  });

  it('keeps a refusal until the next action', () => {
    const refused = repositoriesReducer(start(), { type: 'refused', message: 'No.' });
    expect(refused.refusal).toBe('No.');
    expect(refused.busy).toBe(false);
    expect(repositoriesReducer(refused, { type: 'pick' }).refusal).toBeNull();
  });
});

describe('the confirm before a remove (PRD 2188 s1)', () => {
  const KEEP = 'Remove vertuoza/vertuobuild? Its ideas and history are kept, and adding it again brings them back.';

  it('says what is kept, and how to bring it back', () => {
    expect(removeConfirm(row('vertuoza/vertuobuild'))).toBe(KEEP);
  });

  it('names the products it leaves, and each product that will have no plan repository', () => {
    const r = row('vertuoza/vertuobuild', {
      products: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Mobile' }],
      planProducts: [{ id: 'p-2', name: 'Mobile' }],
    });
    expect(removeConfirm(r)).toBe(`${KEEP}\nIt leaves Vertuoza, Mobile.\nMobile will have no plan repository.`);
    expect(removeConfirm(row('vertuoza/vertuobuild', { products: [{ id: 'p-1', name: 'Vertuoza' }] }))).toBe(`${KEEP}\nIt leaves Vertuoza.`);
  });
});
