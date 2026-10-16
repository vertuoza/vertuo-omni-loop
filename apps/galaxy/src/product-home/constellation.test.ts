import { describe, expect, it } from 'vitest';
import { constellationOf, SKY } from './constellation';
import type { HomeRepository } from './product-home.service';

// The Constellation's map (PRD 2129 s1), a pure function on fixture repositories: a star each, an edge per
// `consumes` entry from consumer to provider, docked when phase 0 is a pull request, the fixed layout (most
// consumed at the centre, ties by name, the same on two calls), and the two empty states.

const repo = (name: string, over: Partial<HomeRepository> = {}): HomeRepository =>
  ({ repository: name, role: null, consumes: [], phase0: 'server', alsoIn: [], ...over });

const stars = (repositories: HomeRepository[]) => {
  const map = constellationOf(repositories);
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
    expect(constellationOf([])).toEqual({ kind: 'empty' });
  });

  it('keeps the stars alone when no repository consumes another', () => {
    const map = stars([repo('a/api'), repo('a/web')]);
    expect(map.kind).toBe('stars');
    expect(map.edges).toEqual([]);
    expect(map.stars).toHaveLength(2);
  });
});
