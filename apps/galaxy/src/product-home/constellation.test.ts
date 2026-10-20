import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { constellationOf, NOW_MAX, touchesOf, type Filter } from './constellation';
import { layoutOf } from './layout';
import type { HomeFlight, HomeRepository } from './product-home.service';

// The Constellation's map (PRD 2129 s1, PRD 2174 s3), a pure function on fixture repositories and PRDs: a star
// each, weighted by the PRDs whose targets include it; a plan line per pair of the product's repositories a
// PRD's targets name together, with its weight, its PRDs newest first and whether one is in flight; a target
// outside the product drawn nowhere and counted; declared `consumes` as lines apart; the stars where
// `layoutOf` puts them; the Ledger's states on the stars; Now capped at 8; `?star=` and `?pair=`.

const repo = (name: string, over: Partial<HomeRepository> = {}): HomeRepository =>
  ({ repository: name, role: null, consumes: [], phase0: 'server', alsoIn: [], ...over });

/** A PRD of the product: at building on the agent, at home in `a/api` with its stage rows, unless told otherwise. */
const flight = (dossier: string, n: number, over: Partial<HomeFlight> = {}): HomeFlight => ({
  dossier, repo: 'a/api', prd: parsePrd(n), title: `PRD ${String(n)}`, birthplace: 'repo',
  stage: 'building', ledger: { state: 'building', lane: 'on-agent' }, stageRepos: [over.repo ?? 'a/api'], prs: [], targets: [], ...over,
});
const shipped = (dossier: string, n: number, targets: string[]) => flight(dossier, n, { stage: 'shipped', ledger: null, stageRepos: [], targets });
const drifted = (dossier: string, n: number, over: Partial<HomeFlight> = {}) =>
  flight(dossier, n, { stage: 'inbox', ledger: { state: 'drifted', lane: null }, birthplace: 'server', ...over });
const onYou = (dossier: string, n: number, over: Partial<HomeFlight> = {}) =>
  flight(dossier, n, { stage: 'building', ledger: { state: 'question', lane: 'on-you' }, ...over });
const pr = (repoName: string, n: number) => ({ repo: repoName, pr: parsePr(n) });

const map = (repositories: HomeRepository[], flights: HomeFlight[] = [], filter: Filter = {}) => {
  const drawn = constellationOf({ product: { id: 'p-1', name: 'Widgets' }, repositories, flights }, filter);
  if (drawn.kind === 'empty') throw new Error('the map has stars');
  return drawn;
};

const FOUR = [repo('a/api'), repo('a/web'), repo('a/auth'), repo('a/docs')];

describe('the stars', () => {
  it('draws one star per linked repository with its role, phase 0 and the products it is also in, sorted', () => {
    const drawn = map([repo('a/api', { role: 'api', alsoIn: ['Zeta', 'Alpha'] }), repo('a/web', { role: 'web', phase0: 'pr' })]);
    expect(drawn.stars.map((s) => [s.repository, s.role, s.phase0, s.alsoIn])).toEqual([
      ['a/api', 'api', 'server', ['Alpha', 'Zeta']],
      ['a/web', 'web', 'pr', []],
    ]);
  });

  it('docks a star whose phase 0 is a pull request, and no other', () => {
    const drawn = map([repo('a/api'), repo('a/web', { phase0: 'pr' })]);
    expect(drawn.stars.map((s) => [s.repository, s.docked])).toEqual([['a/api', false], ['a/web', true]]);
  });

  it('answers empty for a product with no repository', () => {
    expect(constellationOf({ product: { id: 'p-1', name: 'W' }, repositories: [], flights: [] })).toEqual({ kind: 'empty' });
  });

  it('places every star where layoutOf puts it, the same on two calls, however the rows are ordered', () => {
    const flights = [shipped('d-1', 1, ['a/api', 'a/web']), shipped('d-2', 2, ['a/web', 'a/auth'])];
    const first = map(FOUR, flights);
    const expected = layoutOf(
      FOUR.map((r) => ({ repository: r.repository, role: r.role })),
      first.lines.map((l) => ({ a: l.a, b: l.b, weight: l.weight })),
      'p-1',
    );
    expect(first.stars.map((s) => [s.repository, s.at])).toEqual([...expected.at].sort(([p], [q]) => p.localeCompare(q)));
    expect(first.sky).toEqual({ width: expected.width, height: expected.height });
    expect(map(FOUR, flights)).toEqual(first);
    expect(map([...FOUR].reverse(), flights).stars).toEqual(first.stars);
  });
});

describe('the plan lines', () => {
  it('draws one line per pair of the product\'s repositories a PRD\'s targets name', () => {
    const drawn = map(FOUR, [shipped('d-1', 1, ['a/api', 'a/web', 'a/auth'])]);
    expect(drawn.kind).toBe('map');
    expect(drawn.lines.map((l) => [l.a, l.b, l.weight])).toEqual([['a/api', 'a/auth', 1], ['a/api', 'a/web', 1], ['a/auth', 'a/web', 1]]);
  });

  it('weighs a line by the PRDs sharing the pair, lists them newest first, and orders the heaviest line first', () => {
    const drawn = map(FOUR, [shipped('d-3', 3, ['a/web', 'a/api']), shipped('d-2', 2, ['a/auth', 'a/docs']), shipped('d-1', 1, ['a/api', 'a/web'])]);
    expect(drawn.lines.map((l) => [l.a, l.b, l.weight, l.prds.map((p) => p.dossier)])).toEqual([
      ['a/api', 'a/web', 2, ['d-3', 'd-1']],
      ['a/auth', 'a/docs', 1, ['d-2']],
    ]);
  });

  it('is in flight when one of its PRDs is, and its PRDs say which', () => {
    const drawn = map(FOUR, [flight('d-2', 2, { targets: ['a/api', 'a/web'] }), shipped('d-1', 1, ['a/api', 'a/web']), shipped('d-0', 10, ['a/auth', 'a/docs'])]);
    expect(drawn.lines.map((l) => [l.a, l.inFlight])).toEqual([['a/api', true], ['a/auth', false]]);
    expect(drawn.lines[0]?.prds.map((p) => p.inFlight)).toEqual([true, false]);
  });

  it('draws nothing for a target outside the product, and counts it on the star of the PRD', () => {
    const drawn = map(FOUR, [shipped('d-1', 1, ['a/api', 'a/web', 'x/other']), shipped('d-2', 2, ['a/api', 'x/more', 'x/other'])]);
    expect(drawn.lines.map((l) => [l.a, l.b])).toEqual([['a/api', 'a/web']]);
    expect(drawn.stars.map((s) => [s.repository, s.outside])).toEqual([['a/api', 2], ['a/auth', 0], ['a/docs', 0], ['a/web', 1]]);
  });

  it('draws nothing for a PRD with one target in the product, and the stars alone', () => {
    const drawn = map(FOUR, [shipped('d-1', 1, ['a/api']), shipped('d-2', 2, ['a/api', 'x/other'])]);
    expect(drawn.kind).toBe('stars');
    expect(drawn.lines).toEqual([]);
  });

  it('reads a target\'s name in any case, and counts it once', () => {
    const drawn = map(FOUR, [shipped('d-1', 1, ['A/API', 'a/api', 'a/web'])]);
    expect(drawn.lines.map((l) => [l.a, l.b, l.weight])).toEqual([['a/api', 'a/web', 1]]);
  });

  it('keeps declared consumes as lines of their own, consumer to provider, and draws none to a repository the product does not hold', () => {
    const drawn = map([repo('a/web', { consumes: ['a/api', 'a/gone'] }), repo('a/api')]);
    expect(drawn.kind).toBe('stars');
    expect(drawn.consumes).toEqual([{ consumer: 'a/web', provider: 'a/api' }]);
    expect(drawn.lines).toEqual([]);
  });
});

describe('the star weights', () => {
  it('counts the product\'s PRDs whose targets include a star, and sorts the weights into thirds', () => {
    const six = ['a/r1', 'a/r2', 'a/r3', 'a/r4', 'a/r5', 'a/r6'].map((n) => repo(n));
    const flights = [
      shipped('d-1', 1, ['a/r6', 'a/r5']), shipped('d-2', 2, ['a/r6', 'a/r5']), shipped('d-3', 3, ['a/r6', 'a/r4']),
      shipped('d-4', 4, ['a/r6', 'a/r3']), shipped('d-5', 5, ['a/r5', 'a/r3']),
    ];
    const drawn = map(six, flights);
    expect(drawn.stars.map((s) => [s.repository, s.weight, s.size])).toEqual([
      ['a/r1', 0, 'light'], ['a/r2', 0, 'light'], ['a/r3', 2, 'medium'], ['a/r4', 1, 'medium'], ['a/r5', 3, 'heavy'], ['a/r6', 4, 'heavy'],
    ]);
  });

  it('reads every star light when none has a PRD', () => {
    expect(map(FOUR).stars.map((s) => [s.weight, s.size])).toEqual(FOUR.map(() => [0, 'light']));
  });
});

describe('the Ledger on the stars', () => {
  it('reads what each PRD touches: its home, its stage rows and the repositories of its pull requests, none once shipped', () => {
    expect(touchesOf(flight('d-1', 1, { repo: 'A/Api', stageRepos: ['a/web'], prs: [pr('a/auth', 3)] })).sort()).toEqual(['a/api', 'a/auth', 'a/web']);
    expect(touchesOf(shipped('d-0', 10, []))).toEqual([]);
  });

  it('rings a star with the worst state of the PRDs touching it: drifted, then waits on you, then building, else quiet', () => {
    const drawn = map(FOUR, [
      drifted('d-3', 3, { repo: 'a/web', stageRepos: ['a/web'] }),
      onYou('d-2', 2, { repo: 'a/web', stageRepos: ['a/web', 'a/auth'] }),
      flight('d-1', 1, { stageRepos: ['a/api', 'a/auth'] }),
    ]);
    expect(drawn.stars.map((s) => [s.repository, s.state])).toEqual([['a/api', 'building'], ['a/auth', 'on-you'], ['a/docs', 'quiet'], ['a/web', 'drifted']]);
  });

  it('tethers a docked star\'s open phase-0 pull requests, and no other star\'s', () => {
    const drawn = constellationOf({
      product: { id: 'p-1', name: 'W' }, flights: [], tethers: [pr('a/web', 31), pr('a/api', 32)],
      repositories: [repo('a/api'), repo('a/web', { phase0: 'pr' })],
    });
    if (drawn.kind === 'empty') throw new Error('stars');
    expect(drawn.stars.map((s) => [s.repository, s.tethers])).toEqual([['a/api', []], ['a/web', [pr('a/web', 31)]]]);
  });
});

describe('Now', () => {
  const nine = Array.from({ length: 10 }, (_, i) => flight(`d-${String(i)}`, 100 + i, { stageRepos: ['a/api'] }));

  it('holds the first 8 PRDs in flight touching a star, worst first, and counts the rest', () => {
    const drawn = map(FOUR, [...nine, drifted('d-x', 200, { stageRepos: ['a/web'], repo: 'a/web' })]);
    expect(NOW_MAX).toBe(8);
    expect(drawn.now).toHaveLength(8);
    expect(drawn.now[0]?.dossier).toBe('d-x');
    expect(drawn.now.slice(1).map((f) => f.dossier)).toEqual(nine.slice(0, 7).map((f) => f.dossier));
    expect(drawn.moreNow).toBe(3);
  });

  it('counts no more when 8 or fewer touch a star, and leaves out a PRD touching none or shipped', () => {
    const drawn = map(FOUR, [flight('d-1', 1), flight('d-2', 2, { repo: 'x/other', stageRepos: [] }), shipped('d-3', 3, ['a/api'])]);
    expect(drawn.now.map((f) => f.dossier)).toEqual(['d-1']);
    expect(drawn.moreNow).toBe(0);
  });

  it('says what each PRD is: drifted, waits on you, building, else its Ledger state', () => {
    const drawn = map(FOUR, [drifted('d-1', 1), onYou('d-2', 2), flight('d-3', 3), flight('d-4', 4, { stage: 'outbox', ledger: { state: 'review', lane: 'on-review' } })]);
    expect(drawn.now.map((f) => [f.dossier, f.word])).toEqual([['d-1', 'drifted'], ['d-2', 'waits on you'], ['d-3', 'building'], ['d-4', 'review']]);
  });
});

describe('?star= and ?pair=', () => {
  const flights = [shipped('d-1', 1, ['a/api', 'a/web']), shipped('d-2', 2, ['a/web', 'a/auth'])];

  it('selects a star by name, in any case, and an unknown one none', () => {
    expect(map(FOUR, flights, { star: 'a/api' }).selected?.repository).toBe('a/api');
    expect(map(FOUR, flights, { star: 'A/WEB' }).selected?.repository).toBe('a/web');
    expect(map(FOUR, flights, { star: 'a/gone' }).selected).toBeNull();
    expect(map(FOUR, flights, { star: null }).selected).toBeNull();
  });

  it('selects a plan line by its pair in either order, and an unknown one none', () => {
    expect(map(FOUR, flights, { pair: 'a/api,a/web' }).selectedLine?.prds.map((p) => p.dossier)).toEqual(['d-1']);
    expect(map(FOUR, flights, { pair: 'a/web,a/api' }).selectedLine?.a).toBe('a/api');
    expect(map(FOUR, flights, { pair: 'a/api,a/auth' }).selectedLine).toBeNull();
    expect(map(FOUR, flights, { pair: 'a/api' }).selectedLine).toBeNull();
    expect(map(FOUR, flights, { pair: 'a/api,a/web,a/auth' }).selectedLine).toBeNull();
    expect(map(FOUR, flights, { pair: null }).selectedLine).toBeNull();
  });

  it('reads a ?prd= as nothing: there is no PRD filter', () => {
    const drawn = map(FOUR, flights, { prd: 'd-1' } as Filter);
    expect(drawn.selected).toBeNull();
    expect(drawn.selectedLine).toBeNull();
    expect(drawn.stars).toEqual(map(FOUR, flights).stars);
  });
});
