import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';

// `server-only` refuses to load outside a server bundle; the loader is exercised here on plain Node.
vi.mock('server-only', () => ({}));
const { checkoutRoot, loadKnowledge } = await import('./load-knowledge');

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const PRINCIPLES = '# Principles\n\n## P-PRODUCT-1\n\nEvery change is reviewed.\n\nWhy: Nobody merges alone.\nSource: PRD #3\n';
const RULES = '# Rules\n\n## BR-PRODUCT-1\n\nOne approval.\n\nServes: P-PRODUCT-1\nSource: PRD #3\nEnforced by: unenforced\nProposed: harvest 2026-09-26\n';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

/** A temporary checkout holding `files`, and the app's folder inside it. */
function checkout(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'omni-knowledge-'));
  roots.push(root);
  for (const [path, text] of Object.entries({ 'apps/galaxy/package.json': '{}\n', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return { root, app: join(root, 'apps/galaxy') };
}

const FULL = {
  '.omni-loop/config.yml': CONFIG,
  '.omni-loop/knowledge/product/principles.md': PRINCIPLES,
  '.omni-loop/knowledge/product/rules.md': RULES,
};

describe('checkoutRoot — the checkout the app runs from', () => {
  it('is the nearest folder above that holds the Omni Loop config', () => {
    const { root, app } = checkout(FULL);
    expect(checkoutRoot(app)).toBe(root);
    expect(checkoutRoot(root)).toBe(root);
  });

  it('is null when no folder above holds one', () => {
    const { app } = checkout({});
    expect(checkoutRoot(app)).toBeNull();
  });
});

describe('loadKnowledge — the graph of the deployed checkout, through the kit', () => {
  it('returns the graph of the checkout the app runs in', () => {
    const { app } = checkout(FULL);
    const log = vi.fn();
    const graph = loadKnowledge({ cwd: app, log });
    expect(log).not.toHaveBeenCalled();
    expect(graph).toMatchObject({ version: 1, repo: 'acme/widgets', loose: [], unserved: [] });
    expect(graph?.domains.map((d) => [d.name, d.counts])).toEqual([['product', { principles: 1, rules: 1, invariants: 0, laws: 1, proposed: 1 }]]);
    expect(graph?.entries.map((e) => `${e.id} ${e.status} ${e.prd}`)).toEqual(['P-PRODUCT-1 law 3', 'BR-PRODUCT-1 proposed 3']);
    expect(graph?.links).toEqual([{ from: 'BR-PRODUCT-1', to: 'P-PRODUCT-1', kind: 'serves' }]);
  });

  it('reads the knowledge folder the config names', () => {
    const { app } = checkout({
      '.omni-loop/config.yml': `${CONFIG}paths:\n  knowledge: truth\n`,
      'truth/product/principles.md': PRINCIPLES,
    });
    expect(loadKnowledge({ cwd: app, log: vi.fn() })?.entries.map((e) => e.id)).toEqual(['P-PRODUCT-1']);
  });

  it('returns null, logging one line, when no config is found', () => {
    const { app } = checkout({ '.omni-loop/knowledge/product/principles.md': PRINCIPLES });
    const log = vi.fn();
    expect(loadKnowledge({ cwd: app, log })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/^knowledge map: out of reach — no \.omni-loop\/config\.yml in .*apps\/galaxy or above$/);
  });

  it('returns null, logging one line, when the config cannot be read', () => {
    const { app } = checkout({ ...FULL, '.omni-loop/config.yml': 'kit: [1\n' });
    const log = vi.fn();
    expect(loadKnowledge({ cwd: app, log })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/^knowledge map: out of reach — \.omni-loop\/config\.yml: not valid YAML/);
  });

  it('returns null, logging one line, when the knowledge folder is missing', () => {
    const { root, app } = checkout({ '.omni-loop/config.yml': CONFIG });
    const log = vi.fn();
    expect(loadKnowledge({ cwd: app, log })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toBe(`knowledge map: out of reach — .omni-loop/knowledge is missing in ${root}`);
  });
});
