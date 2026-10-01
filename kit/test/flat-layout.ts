// Test-only. Reproduces upstream vertuo-ai-domain's flat layout (docs/outbox/<prd>/, docs/adr,
// docs/knowledge) and its `vertuo-outbox` markers, so ported upstream tests keep their assertions
// byte for byte. Never shipped: kit/lib knows only the folders layout.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { testContext } from './fixture.ts';
import type { Overrides } from './fixture.ts';

const unsupported = () => {
  throw new Error('flat test layout: inbox paths are not supported');
};

export function flatLayout(root: string) {
  return Object.freeze({
    kind: 'flat',
    dirs: { inbox: 'docs/inbox', outbox: 'docs/outbox', shipped: null, archive: null },
    adrDir: 'docs/adr',
    knowledgeRoot: 'docs/knowledge',
    whereIs: () => null,
    specPath: unsupported,
    planPath: unsupported,
    beforeAfterPath: unsupported,
    outboxDir: (prd: number | string) => `docs/outbox/${Number(prd)}`,
    outboxDirs() {
      const dir = join(root, 'docs/outbox');
      if (!existsSync(dir)) return [];
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => ({ prd: Number(entry.name), dir: `docs/outbox/${entry.name}`, shipped: false }))
        .sort((a, b) => a.prd - b.prd);
    },
    specFiles: unsupported,
  });
}

export function flatCtx(rootDir: string | undefined, overrides: Overrides = {}) {
  const root = rootDir as string; // ts-allow: a test hands its fixture's root, set before each case
  const ctx = testContext(root, {
    markers: { prefix: 'vertuo-outbox' },
    laws: { source: 'knowledge' },
    paths: { knowledge: 'docs/knowledge', adr: 'docs/adr', glossary: 'docs/glossary.md' },
    repo: { slug: 'vertuoza/vertuo-ai-domain' },
    ...overrides,
  });
  return Object.freeze({ ...ctx, layout: flatLayout(root) });
}
