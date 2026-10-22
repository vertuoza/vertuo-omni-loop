// PRD 2346, slice s4: `omni kb graph --paths` resolves its files as `omni kb laws --paths` does (their
// domain and layers, on the repository's knowledge map), and links the decision records of that domain
// or layer through `domain` and `layer` edges. Through `main()` on the knowledge-map fixture.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Neighbourhood } from '../lib/knowledge/neighbourhood.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

/** Every file under `root`, as `{ <path>: text }`. */
function snapshot(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(out, snapshot(root, path));
    else out[path] = readFileSync(join(root, path), 'utf8');
  }
  return out;
}

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni kb graph --paths on a knowledge map (PRD 2346, s4)', () => {
  const MAP = snapshot(join(import.meta.dirname, '../test/fixtures/knowledge-map'));
  const graphOf = async (files: string[]): Promise<Neighbourhood> => {
    const { root } = makeRepo({ git: true, files: MAP });
    return JSON.parse((await omni(root, ['kb', 'graph', '--paths', ...files, '--json'])).out) as Neighbourhood;
  };
  const reached = (built: Neighbourhood, kind: string) => built.edges.filter((edge) => edge.kind === kind).map(({ to }) => to);

  it('reaches the ADR tagged db from a migration through a layer edge, and no ADR of another layer', async () => {
    const built = await graphOf(['supabase/migrations/20261001000000_x.sql']);
    expect(reached(built, 'layer')).toContain('ADR-0001');
    expect(built.nodes.find(({ id }) => id === 'ADR-0001')).toMatchObject({ kind: 'adr', hop: 1 });
    expect(built.nodes.map(({ id }) => id)).not.toContain('ADR-0004');
  });

  it('starts from the rules of the files domain, and reaches the ADR tagged with that domain through a domain edge', async () => {
    const built = await graphOf(['apps/web/src/ask/ask.service.ts']);
    expect(built.start).toContain('BR-PRODUCT-12');
    expect(reached(built, 'domain')).toContain('ADR-0002');
  });

  it('starts from a rule that has no Governs: line, once the map reaches it', async () => {
    const built = await graphOf(['apps/web/src/push/sw.ts']);
    expect(built.start).toContain('N-PRODUCT-18');
  });

  it('prints the edges as text, a rule then its ADR', async () => {
    const { root } = makeRepo({ git: true, files: MAP });
    const { code, out } = await omni(root, ['kb', 'graph', '--paths', 'supabase/migrations/20261001000000_x.sql']);
    expect(code).toBe(0);
    expect(out).toMatch(/side\s+layer\s+ADR-0001\s+adr\s+/);
  });
});
