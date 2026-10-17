import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { constellationOf, SKY, touchesOf, type Filter } from './constellation';
import type { HomeFlight, HomeRepository } from './product-home.service';

// The Constellation's map (PRD 2129 s1), a pure function on fixture repositories: a star each, an edge per
// `consumes` entry from consumer to provider, docked when phase 0 is a pull request, the fixed layout (most
// consumed at the centre, ties by name, the same on two calls), and the two empty states. Since s2, the
// Ledger's states on it: what each PRD touches, each star's state worst first, what crosses each edge, and
// the `?prd=` and `?star=` filters.

const repo = (name: string, over: Partial<HomeRepository> = {}): HomeRepository =>
  ({ repository: name, role: null, consumes: [], phase0: 'server', alsoIn: [], ...over });

/** A PRD of the product: at building on the agent, at home in `a/api` with its stage rows, unless told otherwise. */
const flight = (dossier: string, n: number, over: Partial<HomeFlight> = {}): HomeFlight => ({
  dossier, repo: 'a/api', prd: parsePrd(n), title: `PRD ${String(n)}`, birthplace: 'repo',
  stage: 'building', ledger: { state: 'building', lane: 'on-agent' }, stageRepos: [over.repo ?? 'a/api'], prs: [], ...over,
});
const drifted = (dossier: string, n: number, over: Partial<HomeFlight> = {}) =>
  flight(dossier, n, { stage: 'inbox', ledger: { state: 'drifted', lane: null }, birthplace: 'server', ...over });
const onYou = (dossier: string, n: number, over: Partial<HomeFlight> = {}) =>
  flight(dossier, n, { stage: 'building', ledger: { state: 'question', lane: 'on-you' }, ...over });
const pr = (repoName: string, n: number) => ({ repo: repoName, pr: parsePr(n) });

const stars = (repositories: HomeRepository[], flights: HomeFlight[] = [], filter: Filter = {}) => {
  const map = constellationOf({ repositories, flights }, filter);
  if (map.kind === 'empty') throw new Error('the map has stars');
  return map;
};

describe('the stars', () => {
  it('draws one star per linked repository with its role, phase 0 and the products it is also in, sorted', () => {
    const map = stars([
      repo('a/api', { role: 'api', alsoIn: ['Zeta', 'Alpha'] }),
      repo('a/web', { role: 'web', phase0: 'pr' }),
    ]);
    expect(map.stars.map((s) => [s.repository, s.role, s.phase0, s.alsoIn])).toEqual([
      ['a/api', 'api', 'server', ['Alpha', 'Zeta']],
      ['a/web', 'web', 'pr', []],
    ]);
  });

  it('docks a star whose phase 0 is a pull request, and no other', () => {
    const map = stars([repo('a/api'), repo('a/web', { phase0: 'pr' })]);
    expect(map.stars.map((s) => [s.repository, s.docked])).toEqual([['a/api', false], ['a/web', true]]);
  });
});

describe('the edges', () => {
  it('draws one edge per consumes entry, from the consumer to the provider', () => {
    const map = stars([repo('a/web', { consumes: ['a/api', 'a/auth'] }), repo('a/api', { consumes: ['a/auth'] }), repo('a/auth')]);
    expect(map.kind).toBe('map');
    expect(map.edges.map((e) => `${e.consumer}>${e.provider}`)).toEqual(['a/web>a/api', 'a/web>a/auth', 'a/api>a/auth']);
  });

  it('draws no edge to a repository the product does not hold', () => {
    expect(stars([repo('a/web', { consumes: ['a/gone'] })]).edges).toEqual([]);
  });

  it('bends two edges between the same pair to opposite sides, so they never overlap', () => {
    const map = stars([repo('a/api', { consumes: ['a/web'] }), repo('a/web', { consumes: ['a/api'] })]);
    const [one, two] = map.edges;
    expect(one?.bend).not.toEqual(two?.bend);
  });
});

describe('the layout', () => {
  const six = [
    repo('a/web', { consumes: ['a/api'] }), repo('a/api', { consumes: ['a/auth'] }), repo('a/auth'),
    repo('a/ios', { consumes: ['a/api'] }), repo('a/android', { consumes: ['a/api'] }), repo('a/docs'),
  ];

  it('places every star at the same point on two calls, however the rows are ordered', () => {
    const first = stars(six);
    expect(stars(six)).toEqual(first);
    expect(stars([...six].reverse()).stars).toEqual(first.stars);
  });

  it('puts the most consumed at the centre, then ranks by how many consume it and by name', () => {
    const map = stars(six);
    expect(map.stars.map((s) => s.repository)).toEqual(['a/api', 'a/auth', 'a/android', 'a/docs', 'a/ios', 'a/web']);
    expect(map.stars[0]?.at).toEqual({ x: SKY.width / 2, y: SKY.height / 2 });
  });

  it('puts the second star at the top of the ring, and keeps every star in the sky', () => {
    const map = stars(six);
    expect(map.stars[1]?.at).toEqual({ x: 480, y: 60 });
    for (const s of map.stars) {
      expect(s.at.x).toBeGreaterThan(0);
      expect(s.at.x).toBeLessThan(SKY.width);
      expect(s.at.y).toBeGreaterThan(0);
      expect(s.at.y).toBeLessThan(SKY.height);
    }
  });

  it('uses two rings past 8 stars, none of two stars at one point', () => {
    const many = Array.from({ length: 12 }, (_, i) => repo(`a/r${String(i).padStart(2, '0')}`));
    const points = stars(many).stars.map((s) => `${String(s.at.x)},${String(s.at.y)}`);
    expect(new Set(points).size).toBe(12);
  });

  it('places a lone repository at the centre', () => {
    expect(stars([repo('a/api')]).stars[0]?.at).toEqual({ x: 480, y: 250 });
  });
});

describe('the empty states', () => {
  it('says empty for no repository', () => {
    expect(constellationOf({ repositories: [], flights: [flight('d-1', 1)] })).toEqual({ kind: 'empty' });
  });

  it('keeps the stars alone when no repository consumes another', () => {
    const map = stars([repo('a/api'), repo('a/web')]);
    expect(map.kind).toBe('stars');
    expect(map.edges).toEqual([]);
    expect(map.stars).toHaveLength(2);
  });
});

describe('what a PRD touches (s2)', () => {
  it('touches its home repository, a repository of a stage row, and one where its feature branch or a landing has an open pull request', () => {
    expect(touchesOf(flight('d-1', 1, { repo: 'A/Home', stageRepos: ['a/staged'], prs: [pr('a/web', 4), pr('A/Mobile', 5), pr('a/web', 6)] })))
      .toEqual(['a/home', 'a/staged', 'a/web', 'a/mobile']);
  });

  it('touches nothing once shipped or at retro', () => {
    expect(touchesOf(flight('d-1', 1, { stage: 'shipped', ledger: null, prs: [pr('a/web', 4)] }))).toEqual([]);
    expect(touchesOf(flight('d-1', 1, { stage: 'retro', ledger: null }))).toEqual([]);
  });
});

describe('a star\'s state (s2)', () => {
  const repos = [repo('a/api'), repo('a/web'), repo('a/auth'), repo('a/docs')];
  const stateOf = (flights: HomeFlight[]) => Object.fromEntries(stars(repos, flights).stars.map((s) => [s.repository, s.state]));

  it('is the worst of the PRDs touching it: drifted over on you over building over quiet', () => {
    expect(stateOf([
      flight('d-1', 1, { repo: 'a/api', prs: [pr('a/web', 1), pr('a/auth', 2)] }),
      onYou('d-2', 2, { repo: 'a/web', prs: [pr('a/auth', 3)] }),
      drifted('d-3', 3, { repo: 'a/auth' }),
    ])).toEqual({ 'a/api': 'building', 'a/web': 'on-you', 'a/auth': 'drifted', 'a/docs': 'quiet' });
  });

  it('reads drifted over on you for one PRD both voided and asking you, and quiet for one at inbox or on review', () => {
    expect(stateOf([
      drifted('d-1', 1, { repo: 'a/web', ledger: { state: 'drifted', lane: 'on-you' } }),
      flight('d-2', 2, { repo: 'a/auth', stage: 'inbox', ledger: { state: 'inbox', lane: 'on-agent' } }),
      flight('d-3', 3, { repo: 'a/docs', stage: 'outbox', ledger: { state: 'review', lane: 'on-review' } }),
    ])).toEqual({ 'a/api': 'quiet', 'a/web': 'drifted', 'a/auth': 'quiet', 'a/docs': 'quiet' });
  });

  it('leaves a star touched only by a shipped PRD quiet', () => {
    expect(stateOf([flight('d-1', 1, { stage: 'shipped', ledger: null })])['a/api']).toBe('quiet');
  });

  it('matches a star and what a PRD touches case-insensitively', () => {
    expect(stars([repo('A/Web')], [flight('d-1', 1, { repo: 'a/web' })]).stars[0]?.state).toBe('building');
  });
});

describe('what crosses an edge (s2)', () => {
  const repos = [repo('a/web', { consumes: ['a/api'] }), repo('a/api', { consumes: ['a/auth'] }), repo('a/auth')];

  it('counts and lists the PRDs in flight touching both of its ends, newest first, and none that touch one end or shipped', () => {
    const map = stars(repos, [
      flight('d-3', 3, { repo: 'a/web', prs: [pr('a/api', 1)] }),
      flight('d-2', 2, { repo: 'a/api' }),
      flight('d-1', 1, { repo: 'a/api', prs: [pr('a/web', 2)], stage: 'shipped', ledger: null }),
      onYou('d-0', 4, { repo: 'a/web', prs: [pr('a/api', 3), pr('a/auth', 4)] }),
    ]);
    expect(map.edges.map((e) => [`${e.consumer}>${e.provider}`, e.crossing.map((f) => f.dossier)])).toEqual([
      ['a/web>a/api', ['d-3', 'd-0']],
      ['a/api>a/auth', ['d-0']],
    ]);
  });

  it('flows only between two building stars', () => {
    const map = stars(repos, [flight('d-1', 1, { repo: 'a/web', prs: [pr('a/api', 1)] }), onYou('d-2', 2, { repo: 'a/auth' })]);
    expect(map.edges.map((e) => [`${e.consumer}>${e.provider}`, e.flowing])).toEqual([['a/web>a/api', true], ['a/api>a/auth', false]]);
  });
});

describe('Now in the product (s2)', () => {
  it('lists the PRDs in flight touching a star, worst first, each with its word and its stars', () => {
    const map = stars([repo('a/api'), repo('a/web')], [
      flight('d-4', 4, { repo: 'a/web', stage: 'inbox', ledger: { state: 'inbox', lane: 'on-agent' } }),
      flight('d-3', 3, { repo: 'a/api', prs: [pr('a/web', 1)] }),
      onYou('d-2', 2),
      drifted('d-1', 1, { repo: 'a/web' }),
      flight('d-0', 9, { repo: 'a/other' }),
      flight('d-9', 8, { stage: 'shipped', ledger: null }),
    ]);
    expect(map.now.map((f) => [f.prd, f.word, f.stars])).toEqual([
      [1, 'drifted', ['a/web']], [2, 'waits on you', ['a/api']], [3, 'building', ['a/api', 'a/web']], [4, 'inbox', ['a/web']],
    ]);
    expect(map.flights.map((f) => f.prd)).toEqual([4, 3, 2, 1, 9]);
  });
});

describe('the filters (s2)', () => {
  const repos = [repo('a/web', { consumes: ['a/api'] }), repo('a/api', { consumes: ['a/auth'] }), repo('a/auth')];
  const flights = [flight('d-1', 1, { repo: 'a/web', prs: [pr('a/api', 1)] }), flight('d-2', 2, { repo: 'a/auth' })];
  const litOf = (filter: Filter) => {
    const map = stars(repos, flights, filter);
    return { lit: map.lit, stars: map.stars.filter((s) => s.lit).map((s) => s.repository), edges: map.edges.filter((e) => e.lit).map((e) => e.consumer) };
  };

  it('lights everything with no filter', () => {
    expect(litOf({})).toEqual({ lit: null, stars: ['a/api', 'a/auth', 'a/web'], edges: ['a/web', 'a/api'] });
  });

  it('keeps one PRD\'s stars and the edges between them lit with ?prd=, and fades the rest', () => {
    expect(litOf({ dossier: 'd-1' })).toEqual({ lit: 'd-1', stars: ['a/api', 'a/web'], edges: ['a/web'] });
  });

  it('reads an unknown ?prd=, or a shipped PRD\'s, as no filter', () => {
    expect(litOf({ dossier: 'd-404' })).toEqual(litOf({}));
    const map = stars(repos, [flight('d-9', 9, { stage: 'shipped', ledger: null })], { dossier: 'd-9' });
    expect(map.lit).toBeNull();
  });

  it('selects one star with ?star=, and none for an unknown one', () => {
    expect(stars(repos, flights, { star: 'a/api' }).selected?.repository).toBe('a/api');
    expect(stars(repos, flights, { star: 'A/API' }).selected?.repository).toBe('a/api');
    expect(stars(repos, flights, { star: 'a/gone' }).selected).toBeNull();
    expect(stars(repos, flights).selected).toBeNull();
  });
});

describe('the tethers (s3)', () => {
  const repos = [repo('a/api', { role: 'api' }), repo('a/web', { phase0: 'pr', consumes: ['a/api'] }), repo('a/app', { phase0: 'server' })];
  const tethers = [pr('a/web', 31), pr('A/Web', 35), pr('a/api', 7), pr('a/app', 8), pr('a/gone', 9)];

  it('gives a docked star one tether per open phase-0 pull request in its repository', () => {
    const map = constellationOf({ repositories: repos, flights: [], tethers });
    if (map.kind === 'empty') throw new Error('the map has stars');
    expect(map.stars.find((s) => s.repository === 'a/web')?.tethers).toEqual([pr('a/web', 31), pr('A/Web', 35)]);
  });

  it('gives a docked star with none no tether, and a star that is not docked never one', () => {
    const map = constellationOf({ repositories: repos, flights: [], tethers: [pr('a/api', 7), pr('a/app', 8)] });
    if (map.kind === 'empty') throw new Error('the map has stars');
    expect(map.stars.map((s) => [s.repository, s.tethers])).toEqual([['a/api', []], ['a/app', []], ['a/web', []]]);
  });
});
