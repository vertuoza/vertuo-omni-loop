import { describe, expect, it } from 'vitest';
import { CANONICAL_LAYERS, CANONICAL_ROLES, LAYER_ALIASES, ROLE_ALIASES, ROLE_LAYERS, isLayer, isRole, layerList, layerOf, roleList, roleOf } from './layers.ts';

describe('the canonical words', () => {
  it('holds ten layers and nine roles, each with a one-line definition', () => {
    expect(Object.keys(CANONICAL_LAYERS)).toEqual(['ui', 'api', 'schema', 'db', 'auth', 'event', 'cli', 'job', 'infra', 'ci']);
    expect(Object.keys(CANONICAL_ROLES)).toEqual(['api', 'web', 'mobile', 'ui', 'library', 'infra', 'plan', 'doc', 'monorepo']);
    for (const line of [...Object.values(CANONICAL_LAYERS), ...Object.values(CANONICAL_ROLES)]) {
      expect(line).not.toBe('');
      expect(line).not.toContain('\n');
    }
  });

  it('holds the spec alias tables, every alias pointing at a canonical word', () => {
    expect(LAYER_ALIASES).toEqual({ rest: 'api', graphql: 'schema', database: 'db', migration: 'db' });
    expect(ROLE_ALIASES).toEqual({ 'back-end': 'api', backend: 'api', 'front-end': 'web', frontend: 'web', docs: 'doc' });
    for (const target of Object.values(LAYER_ALIASES)) expect(isLayer(target)).toBe(true);
    for (const target of Object.values(ROLE_ALIASES)) expect(isRole(target)).toBe(true);
  });

  it('reads an alias as its word and keeps any other word', () => {
    expect(layerOf('rest')).toBe('api');
    expect(layerOf('db')).toBe('db');
    expect(layerOf('eventz')).toBe('eventz');
    expect(layerOf('constructor')).toBe('constructor');
    expect(roleOf('back-end')).toBe('api');
    expect(roleOf('web')).toBe('web');
    expect(roleOf('toString')).toBe('toString');
  });

  it("names a role's usual layers from the canonical layers only", () => {
    expect(Object.keys(ROLE_LAYERS)).toEqual(Object.keys(CANONICAL_ROLES));
    expect(ROLE_LAYERS['api']).toEqual(['api', 'schema', 'db', 'auth', 'event', 'job']);
    for (const layers of Object.values(ROLE_LAYERS)) for (const layer of layers) expect(isLayer(layer)).toBe(true);
  });

  it('lists the words in order', () => {
    expect(layerList().startsWith('ui, api, schema')).toBe(true);
    expect(roleList().endsWith('doc, monorepo')).toBe(true);
    expect(isLayer('database')).toBe(false);
    expect(isRole('back-end')).toBe(false);
  });
});
