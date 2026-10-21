import { describe, expect, it } from 'vitest';
import { mapViolations } from './check.ts';

const FILES = ['supabase/migrations/1.sql', 'kit/bin/omni.ts'];
const BASE = { contracts: { kinds: ['api', 'db'] } };

describe('mapViolations', () => {
  it('says nothing of a config with no map', () => {
    expect(mapViolations(BASE, FILES)).toEqual([]);
  });

  it('names a contract kind that is no layer, with the list', () => {
    const [line, ...rest] = mapViolations({ contracts: { kinds: ['api', 'eventz'] } }, FILES);
    expect(rest).toEqual([]);
    expect(line).toMatch(/^contracts\.kinds: eventz is not a layer \(ui, api, schema/);
  });

  it('names a target role that is no role, and accepts the nine', () => {
    const plan = { targets: [{ repo: 'a/b', role: 'api' }, { repo: 'a/c', role: 'legacy' }] };
    const lines = mapViolations({ ...BASE, plan }, FILES);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/a\/c has the role legacy, which is not a role \(api, web/);
  });

  it('names a layers or flow-area pattern that matches no tracked file', () => {
    const lines = mapViolations(
      { ...BASE, layers: { db: ['^supabase/migrations/', '^db/'], cli: ['^kit/bin/'] }, flow: { areas: { ask: { paths: ['^kit/lib/ask/'] } } } },
      FILES,
    );
    expect(lines).toEqual([
      'layers.db: ^db/ matches no tracked file — fix or remove it',
      'flow.areas.ask.paths: ^kit/lib/ask/ matches no tracked file — fix or remove it',
    ]);
  });
});
