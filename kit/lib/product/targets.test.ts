// A product's targets (PRD 1364, s4): the server's links read as `plan.targets` entries, a link with no
// role refused by name, and the last-read copy kept in `.omni-loop/local/product-targets.json` for when
// the server cannot be reached. The server is a stub: nothing here calls the network.
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AskCallError } from '../ask/client.ts';
import { lastReadLine, PRODUCT_TARGETS_FILE, productTargets, targetsOfProduct } from './targets.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const REPLY = {
  product: { name: 'Mobile' },
  targets: [
    { repo: 'acme/api', role: 'api', knowledge: 'imported', readAt: SHA, readOnly: false, consumes: [] },
    { repo: 'acme/app', role: 'mobile', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/api'] },
    { repo: 'acme/docs', role: 'docs', knowledge: 'none', readAt: null, readOnly: true, consumes: [] },
  ],
};
const TARGETS = [
  { repo: 'acme/api', role: 'api', knowledge: 'imported', readAt: SHA, readOnly: false, consumes: [] },
  { repo: 'acme/app', role: 'mobile', knowledge: 'own', readAt: null, readOnly: false, consumes: ['api'] },
  { repo: 'acme/docs', role: 'docs', knowledge: 'none', readAt: null, readOnly: true, consumes: [] },
];
const NOW = new Date('2026-10-10T09:30:12Z');

const root = () => mkdtempSync(join(tmpdir(), 'product-targets-'));
const unreachable = () => Promise.reject(new AskCallError('GET /api/products/targets: timed out'));
const failMessage = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('it did not fail');
};

describe('targetsOfProduct', () => {
  it("reads each link as a plan target, in the server's order, consumes as short names", () => {
    expect(targetsOfProduct(REPLY, 'Mobile')).toEqual(TARGETS);
  });

  it('refuses a link with no role, by name', () => {
    const noRole = { ...REPLY, targets: [REPLY.targets[0], { ...REPLY.targets[1], role: null }] };
    expect(() => targetsOfProduct(noRole, 'Mobile')).toThrow('acme/app has no role in product Mobile: set it on the product page');
  });

  it('refuses a reply that is not a product with its links, naming the product', () => {
    expect(() => targetsOfProduct({ product: { name: 'Mobile' } }, 'Mobile')).toThrow(/^the server answered no targets for product Mobile: /);
    expect(() => targetsOfProduct({ ...REPLY, targets: [{ ...REPLY.targets[0], knowledge: 'copied' }] }, 'Mobile')).toThrow(/product Mobile/);
  });
});

describe('productTargets', () => {
  it("reads the server's links and keeps them as the last read", async () => {
    const dir = root();
    const read = await productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: () => Promise.resolve(REPLY) });
    expect(read).toEqual({ from: 'server', targets: TARGETS });
    expect(JSON.parse(readFileSync(join(dir, PRODUCT_TARGETS_FILE), 'utf8'))).toEqual({ product: 'Mobile', readAt: NOW.toISOString(), targets: TARGETS });
    expect(readFileSync(join(dir, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('keeps no copy of a reply it refuses', async () => {
    const dir = root();
    const noRole = { ...REPLY, targets: [{ ...REPLY.targets[0], role: null }] };
    expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: () => Promise.resolve(noRole) }))).toBe(
      'acme/api has no role in product Mobile: set it on the product page',
    );
    expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: unreachable }))).toBe(
      'no targets: the server is unreachable and nothing was read yet',
    );
  });

  it('reads the last copy when the server cannot be reached, or fails on its side', async () => {
    const dir = root();
    await productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: () => Promise.resolve(REPLY) });
    const later = () => new Date('2026-10-11T00:00:00Z');
    expect(await productTargets({ product: 'Mobile', root: dir, now: later, fetchTargets: unreachable })).toEqual({
      from: 'copy',
      readAt: NOW.toISOString(),
      targets: TARGETS,
    });
    const down = () => Promise.reject(new AskCallError('GET: 503', { status: 503 }));
    expect((await productTargets({ product: 'Mobile', root: dir, now: later, fetchTargets: down })).from).toBe('copy');
  });

  it('stops when the server cannot be reached and nothing was read yet, or only for another product', async () => {
    const dir = root();
    expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: unreachable }))).toBe(
      'no targets: the server is unreachable and nothing was read yet',
    );
    await productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: () => Promise.resolve(REPLY) });
    expect(await failMessage(productTargets({ product: 'Estimates', root: dir, now: () => NOW, fetchTargets: unreachable }))).toBe(
      'no targets: the server is unreachable and nothing was read yet',
    );
  });

  it('reads a copy that is half-written or of another shape as none', async () => {
    for (const text of ['{"product": "Mobile"', '{"product":"Mobile","readAt":"yesterday","targets":[]}', '{"product":"Mobile","readAt":"2026-10-10T09:30:12.000Z","targets":[{"repo":"x"}]}']) {
      const dir = root();
      mkdirSync(join(dir, '.omni-loop/local'), { recursive: true });
      writeFileSync(join(dir, PRODUCT_TARGETS_FILE), text);
      expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: unreachable })), text).toBe(
        'no targets: the server is unreachable and nothing was read yet',
      );
    }
  });

  it("never reads the copy when the server refuses: its reason stops the read", async () => {
    const dir = root();
    await productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: () => Promise.resolve(REPLY) });
    const refused = () => Promise.reject(new AskCallError('GET: 404', { status: 404, reason: 'No product Mobile in the workspace of acme/plan.' }));
    expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: refused }))).toBe(
      'the server refused the targets of product Mobile (404): No product Mobile in the workspace of acme/plan.',
    );
    const bare = () => Promise.reject(new AskCallError('GET: 401 sign-in refused', { status: 401 }));
    expect(await failMessage(productTargets({ product: 'Mobile', root: dir, now: () => NOW, fetchTargets: bare }))).toBe(
      'the server refused the targets of product Mobile (401): GET: 401 sign-in refused',
    );
  });

  it('lets any other failure through as it is', async () => {
    const boom = () => Promise.reject(new TypeError('boom'));
    expect(await failMessage(productTargets({ product: 'Mobile', root: root(), now: () => NOW, fetchTargets: boom }))).toBe('boom');
  });
});

describe('lastReadLine', () => {
  it('says when the copy was read, to the minute, and why it is used', () => {
    expect(lastReadLine('2026-10-10T09:30:12.000Z')).toBe('targets from the last read, 2026-10-10 09:30 UTC · server unreachable');
  });
});
