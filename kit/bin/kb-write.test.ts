// `omni kb legal add | edit` and `omni kb glossary add | edit` (PRD 2268, s2), seen from the outside:
// through `main()` on a fixture repository, against the fake contract server, with the sign-in an
// in-memory token store. Nothing here calls the network beyond the fake.
import { afterEach, describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

type Answered = { status?: number; body: unknown };

/** A checkout of acme/widgets pointed at a fake server that answers each change with `answer`, and the bodies it received. */
async function checkout(answer: (body: unknown) => Answered, { signedIn = true }: { signedIn?: boolean } = {}) {
  const bodies: unknown[] = [];
  const server = await startFakeAskServer({ change: (body) => { bodies.push(body); return answer(body); } });
  started.push(server);
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n` } });
  const store: Record<string, Tokens> = signedIn ? { [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {};
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  return { root, tokens, bodies, server };
}

async function omni(args: string[], { root, tokens }: { root: string; tokens: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['kb', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, env: {} });
  return { code, out: out.join(''), err: err.join('') };
}

const APPLIED = (id: string) => ({ body: { done: 'applied', id, url: `https://omni.test/entry/${id}` } });

describe('omni kb legal add', () => {
  it('sends the entry and prints `added <id> · <url>`', async () => {
    const run = await checkout(() => APPLIED('L-VAT-1'));
    const result = await omni(['legal', 'add', '--code', 'VAT', '--statement', 'Invoices are kept ten years.', '--source', 'Belgian VAT Code art. 60'], run);
    expect(result).toEqual({ code: 0, out: 'added L-VAT-1 · https://omni.test/entry/L-VAT-1\n', err: '' });
    expect(run.bodies).toEqual([{
      repo: 'acme/widgets', kind: 'legal', action: 'add',
      fields: { code: 'VAT', statement: 'Invoices are kept ten years.', source: 'Belgian VAT Code art. 60' },
    }]);
  });

  it('sends --product', async () => {
    const run = await checkout(() => APPLIED('L-VAT-1'));
    await omni(['legal', 'add', '--code', 'VAT', '--statement', 's', '--source', 'src', '--product', 'Invoicing'], run);
    expect(run.bodies[0]).toMatchObject({ product: 'Invoicing' });
  });

  it('prints who the proposal waits for', async () => {
    const run = await checkout(() => ({ body: { done: 'proposed', url: 'https://omni.test/legal', owner: 'jane' } }));
    const result = await omni(['legal', 'add', '--code', 'VAT', '--statement', 's', '--source', 'src'], run);
    expect(result).toEqual({ code: 0, out: 'proposed · waits for @jane · https://omni.test/legal\n', err: '' });
  });

  it('prints the route’s answer with --json', async () => {
    const run = await checkout(() => APPLIED('L-VAT-1'));
    const result = await omni(['legal', 'add', '--code', 'VAT', '--statement', 's', '--source', 'src', '--json'], run);
    expect(JSON.parse(result.out)).toEqual({ done: 'applied', id: 'L-VAT-1', url: 'https://omni.test/entry/L-VAT-1' });
    expect(result.code).toBe(0);
  });

  it.each([
    ['no --code', ['--statement', 's', '--source', 'src']],
    ['no --statement', ['--code', 'VAT', '--source', 'src']],
    ['no --source', ['--code', 'VAT', '--statement', 's']],
    ['a blank --source', ['--code', 'VAT', '--statement', 's', '--source', '  ']],
    ['an unknown flag', ['--code', 'VAT', '--statement', 's', '--source', 'src', '--meaning', 'm']],
  ])('exits 2 with the usage on %s, and calls nothing', async (_, flags) => {
    const run = await checkout(() => APPLIED('x'));
    const result = await omni(['legal', 'add', ...flags], run);
    expect(result.code).toBe(2);
    expect(result.err).toContain('usage');
    expect(run.bodies).toEqual([]);
  });
});

describe('omni kb legal edit', () => {
  it('sends only the fields given and prints `edited <id> · <url>`', async () => {
    const run = await checkout(() => APPLIED('L-VAT-1'));
    const result = await omni(['legal', 'edit', 'L-VAT-1', '--statement', 'Kept ten years.'], run);
    expect(result).toEqual({ code: 0, out: 'edited L-VAT-1 · https://omni.test/entry/L-VAT-1\n', err: '' });
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', kind: 'legal', action: 'edit', entry: 'L-VAT-1', fields: { statement: 'Kept ten years.' } }]);
  });

  it('exits 2 on an edit with no field, or no id', async () => {
    const run = await checkout(() => APPLIED('x'));
    expect((await omni(['legal', 'edit', 'L-VAT-1'], run)).code).toBe(2);
    expect((await omni(['legal', 'edit', '--statement', 's'], run)).code).toBe(2);
    expect((await omni(['legal', 'edit', 'L-VAT-1', '--code', 'X'], run)).code).toBe(2);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 naming an unknown id', async () => {
    const run = await checkout(() => ({ status: 404, body: { error: 'No Legal entry L-VAT-9 in Invoicing.' } }));
    const result = await omni(['legal', 'edit', 'L-VAT-9', '--source', 'src'], run);
    expect(result).toEqual({ code: 1, out: '', err: 'omni kb legal edit: No Legal entry L-VAT-9 in Invoicing.\n' });
  });
});

describe('omni kb glossary add | edit', () => {
  it('adds a term with its avoid words', async () => {
    const run = await checkout(() => APPLIED('credit note'));
    const result = await omni(['glossary', 'add', '--term', 'Credit note', '--meaning', 'Cancels part of an invoice.', '--avoid', 'refund, rebate'], run);
    expect(result).toEqual({ code: 0, out: 'added credit note · https://omni.test/entry/credit note\n', err: '' });
    expect(run.bodies).toEqual([{
      repo: 'acme/widgets', kind: 'glossary', action: 'add',
      fields: { term: 'Credit note', meaning: 'Cancels part of an invoice.', avoid: ['refund', 'rebate'] },
    }]);
  });

  it('leaves avoid out when not named', async () => {
    const run = await checkout(() => APPLIED('quote'));
    await omni(['glossary', 'add', '--term', 'Quote', '--meaning', 'A priced offer.'], run);
    expect(run.bodies[0]).toMatchObject({ fields: { term: 'Quote', meaning: 'A priced offer.' } });
    expect(run.bodies[0]).not.toHaveProperty('fields.avoid');
  });

  it('edits a term by name, only the fields given', async () => {
    const run = await checkout(() => APPLIED('quote'));
    const result = await omni(['glossary', 'edit', 'Quote', '--avoid', 'estimate'], run);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/^edited quote · /);
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', kind: 'glossary', action: 'edit', entry: 'Quote', fields: { avoid: ['estimate'] } }]);
  });

  it('exits 2 on an add with no meaning and on an edit with no field', async () => {
    const run = await checkout(() => APPLIED('x'));
    expect((await omni(['glossary', 'add', '--term', 'Quote'], run)).code).toBe(2);
    expect((await omni(['glossary', 'edit', 'Quote'], run)).code).toBe(2);
    expect(run.bodies).toEqual([]);
  });

  it('proposes for a member who is not the owner', async () => {
    const run = await checkout(() => ({ body: { done: 'proposed', url: 'https://omni.test/glossary' } }));
    const result = await omni(['glossary', 'add', '--term', 'Quote', '--meaning', 'A priced offer.'], run);
    expect(result.out).toBe("proposed · waits for the section's owner · https://omni.test/glossary\n");
  });
});

describe('refusals', () => {
  const add = ['legal', 'add', '--code', 'VAT', '--statement', 's', '--source', 'src'];

  it.each([
    [403, 'Only the Legal owner may do that.', 'Only the Legal owner may do that.'],
    [409, 'This repository is in two products: Invoicing, Quotes. Name one with --product.', 'This repository is in two products: Invoicing, Quotes. Name one with --product.'],
    [422, 'A Statement is one line of at most 400 characters.', 'A Statement is one line of at most 400 characters.'],
    [404, 'No product Foo.', 'No product Foo.'],
  ])('exits 1 with the server’s words on a %s', async (status, error, line) => {
    const run = await checkout(() => ({ status, body: { error } }));
    const result = await omni(add, run);
    expect(result).toEqual({ code: 1, out: '', err: `omni kb legal add: ${line}\n` });
  });

  it('exits 1 with {error} on stdout under --json', async () => {
    const run = await checkout(() => ({ status: 403, body: { error: 'No.' } }));
    const result = await omni([...add, '--json'], run);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out)).toEqual({ error: 'No.' });
  });

  it('exits 1 when signed out', async () => {
    const run = await checkout(() => APPLIED('x'), { signedIn: false });
    const result = await omni(add, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/no sign-in for .* \(omni signin\)/);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 when the page is unreachable', async () => {
    const run = await checkout(() => APPLIED('x'));
    await run.server.close();
    const result = await omni(add, run);
    expect(result).toEqual({ code: 1, out: '', err: 'omni kb legal add: the Omni page could not be reached\n' });
  });

  it('exits 1 on a reply that is no change', async () => {
    const run = await checkout(() => ({ body: { nothing: true } }));
    expect((await omni(add, run)).code).toBe(1);
  });
});
