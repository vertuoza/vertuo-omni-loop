// The `knowledge-embed` job (PRD 2728 s4) with a fake store and a fake embedder: no test calls GitHub, Supabase or
// a model. Every fixture is a fictional product, Acme.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { embedText, knowledgeEntries } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { EMBED_BATCH, EMBED_DIMENSIONS } from 'omni-loop/kit/lib/knowledge/embed-contract.ts';
import type { Embedder } from '../knowledge-embed/embedder.ts';
import type { EmbedStore, ProductRows, VectorRow, WorkspacePack } from '../knowledge-embed/store.ts';
import { EMBED_KIND, embedHandler, embedJob, packEntries, textHash, textsByHash } from './embed.ts';
import type { ClaimedJob, Finish, JobLedger, NewJob } from './ledger.ts';
import { liveWorkers } from './pr-checks.ts';
import { runDue } from './worker.ts';

const SHA = 'c'.repeat(40);
const REPO = 'acme/widgets';

const CONFIG = ['kit: 1', 'laws:', '  owners: [anna]'].join('\n');
const ADR = '# ADR-0007 — Quotes are kept\n\n**Status:** accepted\n\nA quote is never deleted.';
const RULES = ['# Rules', '', '## BR-PRODUCT-3', 'A quote shows its total.', 'Why: the customer must see what they pay.'].join('\n');
const LAWS = ['## BL-QUOTES-1', 'A quote can be sent only when its total is above zero.', 'Why: an empty quote breaks trust.'].join('\n');

const FILES = [
  { path: '.omni-loop/config.yml', content: CONFIG },
  { path: '.omni-loop/knowledge/adr/0007-quotes-are-kept.md', content: ADR },
  { path: '.omni-loop/knowledge/product/rules.md', content: RULES },
  { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: LAWS },
];

const product = (over: Partial<ProductRows> = {}): ProductRows => ({
  lawHome: false,
  legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never stored in clear.', source: 'https://law.example/gdpr-32', owner: null }],
  glossary: [{ term: 'Quote', meaning: 'What a contractor sends before the work.', avoid: ['estimate'] }],
  never: [{ seq: 6, body: 'Never locks a workspace in.' }],
  ...over,
});

const vector = (text: string) => Array.from({ length: EMBED_DIMENSIONS }, (_, i) => (i === text.length % EMBED_DIMENSIONS ? 1 : 0));

/** A store holding `packs`, keeping vectors as knowledge_vectors_put() does, per workspace. */
function memoryStore(packs: WorkspacePack[]) {
  const kept = new Map<string, Set<string>>();
  const puts: { workspace: string; model: string; rows: VectorRow[] }[] = [];
  const asked: { workspace: string; hashes: string[] }[] = [];
  const store: EmbedStore = {
    sources: (repository, sha) => Promise.resolve(repository === REPO && sha === SHA ? packs : []),
    missing: (workspace, _model, hashes) => {
      asked.push({ workspace, hashes: [...hashes] });
      const has = kept.get(workspace) ?? new Set();
      return Promise.resolve([...new Set(hashes)].filter((hash) => !has.has(hash)));
    },
    put: (workspace, model, rows) => {
      puts.push({ workspace, model, rows: [...rows] });
      const has = kept.get(workspace) ?? new Set<string>();
      const before = has.size;
      for (const row of rows) has.add(row.sha256);
      kept.set(workspace, has);
      return Promise.resolve(has.size - before);
    },
  };
  return { store, puts, asked, kept };
}

/** An embedder that answers a vector per text, recording each call's texts. */
function fakeEmbedder() {
  const calls: string[][] = [];
  const embed: Embedder = (texts) => {
    calls.push([...texts]);
    return Promise.resolve(texts.map(vector));
  };
  return { embed, calls };
}

const job = (over: Partial<ClaimedJob> = {}): ClaimedJob => ({
  id: 'j-1',
  kind: EMBED_KIND,
  key: `${REPO}@${SHA}`,
  subject: REPO,
  payload: { repository: REPO, sha: SHA },
  tries: 1,
  claim: 'c-1',
  claimedUntil: '2026-11-12T10:05:00Z',
  ...over,
});

describe('embedJob', () => {
  it('is keyed as the pack job is, under its own kind, holding no text', () => {
    expect(embedJob({ repository: 'Acme/Widgets', sha: SHA })).toEqual({
      kind: 'knowledge-embed',
      key: `acme/widgets@${SHA}`,
      subject: 'acme/widgets',
      payload: { repository: 'acme/widgets', sha: SHA },
    });
  });
});

describe('packEntries and textsByHash', () => {
  it('builds the repository\'s ADRs and rules with the kit\'s builder, and no business law outside the law home', () => {
    const ids = packEntries(REPO, { files: FILES, products: [] }).map((entry) => entry.id);
    expect(ids).toEqual(['widgets/ADR-0007', 'widgets/BR-PRODUCT-3']);
  });

  it('adds the law home\'s business laws, and each product\'s Legal entries, Glossary terms and Never lines', () => {
    const ids = packEntries(REPO, { files: FILES, products: [product({ lawHome: true })] }).map((entry) => `${entry.kind} ${entry.id}`);
    expect(ids).toEqual([
      'adr widgets/ADR-0007',
      'rule widgets/BR-PRODUCT-3',
      'business-law BL-QUOTES-1',
      'legal L-GDPR-2',
      'never never#6',
      'term term:Quote',
    ]);
  });

  it('hashes the same texts the product\'s MCP builds, so a search finds the vectors this job made', () => {
    const { legal, glossary, never } = product();
    const mcp = knowledgeEntries({ repositories: [{ repo: REPO, files: FILES }], lawHome: { repo: REPO, files: FILES }, legal, glossary, never });
    const job = textsByHash(packEntries(REPO, { files: FILES, products: [product({ lawHome: true })] }));
    expect(new Set(job.keys())).toEqual(new Set(mcp.map((entry) => textHash(embedText(entry)))));
  });

  it('embeds no owner: no text holds an `Owner:` line, the business laws\' included', () => {
    const texts = [...textsByHash(packEntries(REPO, { files: FILES, products: [product({ lawHome: true })] })).values()];
    expect(texts.some((text) => text.includes('BL-QUOTES-1') || text.includes('above zero'))).toBe(true);
    expect(texts.filter((text) => /Owner:/.test(text))).toEqual([]);
  });

  it('keeps a text two products share once', () => {
    const one = textsByHash(packEntries(REPO, { files: FILES, products: [product()] }));
    const two = textsByHash(packEntries(REPO, { files: FILES, products: [product(), product()] }));
    expect(two.size).toBe(one.size);
  });

  it('hashes as lower-case hex sha256 of the text\'s UTF-8 bytes', () => {
    expect(textHash('Été')).toBe(createHash('sha256').update(Buffer.from('Été', 'utf8')).digest('hex'));
    expect(textHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('embedHandler — the eval runs it adds (PRD omni-loop-8 s4)', () => {
  const packs = [
    { workspace: 'w-1', files: FILES, products: [product()] },
    { workspace: 'w-2', files: FILES, products: [] },
  ];

  function evalRuns(products: Record<string, string[]>) {
    const asked: { repository: string; workspaces: string[] }[] = [];
    const added: NewJob[] = [];
    return {
      asked,
      added,
      evalRuns: {
        products: (repository: string, workspaces: readonly string[]) => {
          asked.push({ repository, workspaces: [...workspaces] });
          return Promise.resolve(workspaces.flatMap((w) => products[w] ?? []));
        },
        add: (newJob: NewJob) => {
          added.push(newJob);
          return Promise.resolve(true);
        },
      },
    };
  }

  it('adds one search-eval-run job for each product of each workspace that stored vectors, keyed by product and commit', async () => {
    const { store } = memoryStore(packs);
    const runs = evalRuns({ 'w-1': ['p-1', 'p-2'], 'w-2': ['p-3'] });
    const lines: string[] = [];
    await embedHandler({ store, embed: fakeEmbedder().embed, evalRuns: runs.evalRuns, log: (line) => lines.push(line) })(job());
    expect(runs.asked).toEqual([{ repository: REPO, workspaces: ['w-1', 'w-2'] }]);
    expect(runs.added).toEqual(['p-1', 'p-2', 'p-3'].map((p) => ({ kind: 'search-eval-run', key: `${p}@${SHA}`, subject: p, payload: { productId: p, slot: SHA }, lane: 'search-eval-run', maxTries: 3 })));
    expect(lines).toEqual([`knowledge embed: ${REPO}@ccccccc embedded 7 of 7 texts in 2 workspaces, 3 eval runs added`]);
  });

  it('adds none when it stored no vector, a second run of the pack included', async () => {
    const { store } = memoryStore(packs);
    const runs = evalRuns({ 'w-1': ['p-1'] });
    const handler = embedHandler({ store, embed: fakeEmbedder().embed, evalRuns: runs.evalRuns });
    await handler(job());
    runs.added.length = 0;
    runs.asked.length = 0;
    await handler(job());
    expect(runs.asked).toEqual([]);
    expect(runs.added).toEqual([]);
  });

  it('names only the workspaces that stored vectors', async () => {
    const { store, kept } = memoryStore(packs);
    const first = fakeEmbedder();
    await embedHandler({ store, embed: first.embed })(job());
    // w-2 loses its vectors: only it stores new ones on the next run
    kept.delete('w-2');
    const runs = evalRuns({ 'w-1': ['p-1'], 'w-2': ['p-3'] });
    await embedHandler({ store, embed: fakeEmbedder().embed, evalRuns: runs.evalRuns })(job());
    expect(runs.asked).toEqual([{ repository: REPO, workspaces: ['w-2'] }]);
    expect(runs.added.map((added) => added.subject)).toEqual(['p-3']);
  });

  it('never fails the embed when the runs cannot be added: the vectors are kept, one line says so', async () => {
    const { store, puts } = memoryStore(packs);
    const lines: string[] = [];
    const evalRuns = { products: () => Promise.reject(new Error('the database refused: permission denied (42501)')), add: () => Promise.resolve(true) };
    expect(await embedHandler({ store, embed: fakeEmbedder().embed, evalRuns, log: (line) => lines.push(line) })(job())).toEqual({ outcome: 'done' });
    expect(puts).toHaveLength(2);
    expect(lines[0]).toBe('knowledge embed: the eval runs were not added: the database refused: permission denied (42501)');
  });
});

describe('embedHandler', () => {
  it('embeds every text of the pack once, in each workspace that keeps it, then nothing on a second run', async () => {
    const packs = [
      { workspace: 'w-1', files: FILES, products: [product({ lawHome: true })] },
      { workspace: 'w-2', files: FILES, products: [] },
    ];
    const { store, puts } = memoryStore(packs);
    const { embed, calls } = fakeEmbedder();
    const lines: string[] = [];
    const handler = embedHandler({ store, embed, log: (line) => lines.push(line) });

    expect(await handler(job())).toEqual({ outcome: 'done' });
    expect(puts.map(({ workspace, model, rows }) => [workspace, model, rows.length])).toEqual([['w-1', 'gte-small', 6], ['w-2', 'gte-small', 2]]);
    expect(puts[0]?.rows.every((row) => row.vector.length === EMBED_DIMENSIONS)).toBe(true);
    expect(calls.flat()).toHaveLength(8);
    expect(lines).toEqual([`knowledge embed: ${REPO}@ccccccc embedded 8 of 8 texts in 2 workspaces`]);

    expect(await handler(job())).toEqual({ outcome: 'done' });
    expect(calls).toHaveLength(2);
    expect(puts).toHaveLength(2);
  });

  it('keeps each vector under the hash of the text it was made from', async () => {
    const { store, puts } = memoryStore([{ workspace: 'w-1', files: FILES, products: [] }]);
    await embedHandler({ store, embed: fakeEmbedder().embed, log: () => undefined })(job());
    const texts = textsByHash(packEntries(REPO, { files: FILES, products: [] }));
    for (const row of puts[0]?.rows ?? []) expect(row.vector).toEqual(vector(texts.get(row.sha256) ?? ''));
  });

  it(`embeds only the missing hashes, in batches of ${String(EMBED_BATCH)}`, async () => {
    const many = { ...product(), never: Array.from({ length: 140 }, (_, i) => ({ seq: i + 1, body: `Never line ${String(i + 1)}.` })), legal: [], glossary: [] };
    const { store, kept } = memoryStore([{ workspace: 'w-1', files: FILES, products: [many] }]);
    const all = [...textsByHash(packEntries(REPO, { files: FILES, products: [many] })).keys()];
    kept.set('w-1', new Set(all.slice(0, 10)));
    const { embed, calls } = fakeEmbedder();

    await embedHandler({ store, embed, log: () => undefined })(job());
    expect(all).toHaveLength(142);
    expect(calls.map((texts) => texts.length)).toEqual([...Array.from({ length: Math.floor(132 / EMBED_BATCH) }, () => EMBED_BATCH), ...(132 % EMBED_BATCH ? [132 % EMBED_BATCH] : [])]);
  });

  it('skips a pack no workspace keeps, embedding nothing', async () => {
    const { store } = memoryStore([]);
    const { embed, calls } = fakeEmbedder();
    expect(await embedHandler({ store, embed, log: () => undefined })(job())).toEqual({ outcome: 'skipped', reason: 'no workspace keeps its pack' });
    expect(calls).toEqual([]);
  });

  it('asks to run again a minute later once its time is spent, keeping what it embedded', async () => {
    const many = { ...product(), never: Array.from({ length: 140 }, (_, i) => ({ seq: i + 1, body: `Never ${String(i)}.` })) };
    const { store, puts } = memoryStore([{ workspace: 'w-1', files: FILES, products: [many] }]);
    let now = 0;
    const embed: Embedder = (texts) => {
      now += 1000;
      return Promise.resolve(texts.map(vector));
    };
    const result = await embedHandler({ store, embed, clock: () => now, budgetMs: 1500, log: () => undefined })(job());
    expect(result).toEqual({ outcome: 'later', at: new Date(2000 + 60_000), progress: { embedded: 2 * EMBED_BATCH } });
    expect(puts.map(({ rows }) => rows.length)).toEqual([EMBED_BATCH, EMBED_BATCH]);
  });

  it('throws a malformed payload, naming its field', async () => {
    const { store } = memoryStore([]);
    await expect(embedHandler({ store, embed: fakeEmbedder().embed })(job({ payload: { repository: REPO, sha: 'short' } }))).rejects.toThrow('The embed job is malformed: sha');
  });

  it('is a retry for the ledger when the embedder fails, keeping nothing', async () => {
    const { store, puts } = memoryStore([{ workspace: 'w-1', files: FILES, products: [] }]);
    const embed: Embedder = () => Promise.reject(new Error('embed answered 503'));
    const finishes: Finish[] = [];
    let claimed = false;
    const ledger: JobLedger = {
      claim: () => {
        if (claimed) return Promise.resolve([]);
        claimed = true;
        return Promise.resolve([job()]);
      },
      finish: (finish) => {
        finishes.push(finish);
        return Promise.resolve('queued');
      },
    };
    const summary = await runDue({ ledger, handlers: { [EMBED_KIND]: embedHandler({ store, embed, log: () => undefined }) }, clock: () => 0, log: () => undefined });
    expect(summary.retry).toBe(1);
    expect(finishes).toEqual([{ id: 'j-1', claim: 'c-1', outcome: 'retry', reason: 'embed answered 503', retryAt: new Date(60_000).toISOString() }]);
    expect(puts).toEqual([]);
  });

  it('has a handler in the worker every runner of the ledger runs', () => {
    const { handlers } = liveWorkers({ supabase: { url: 'https://db.example', key: 'service-key' } }, () => Promise.reject(new Error('unused')));
    expect(typeof handlers[EMBED_KIND]).toBe('function');
    expect(typeof handlers['search-eval-promote']).toBe('function');
    expect(typeof handlers['search-eval-run']).toBe('function');
  });
});
