import { describe, expect, it } from 'vitest';
import type { ChangeWrite, GlossaryEntry, KnowledgeRead, LegalEntry, Person } from '../product-knowledge/product-knowledge.contract';
import type { KnowledgeRepository } from '../product-knowledge/product-knowledge.repository';
import { knowledgeService } from '../product-knowledge/product-knowledge.service';
import { postKnowledgeChange, type KnowledgeChangesDeps } from './knowledge-api.controller';
import type { ConstituentKey, FoundProduct, KnowledgeApiRepository, Stored } from './knowledge-api.repository';
import { knowledgeApiService } from './knowledge-api.service';

// POST /api/knowledge/changes (PRD 2268 s1): the sign-in first, then the body, then the change, made as the
// caller through the Knowledge tab's own service (its real rules, over a fake of its repository) and the
// constituent functions, on a small world kept in memory the way the database keeps it: who is a workspace
// owner, who answers for Legal, which products each repository is in. No test calls Supabase.

const ORIGIN = 'https://omni.example';
const WS = '00000000-0000-4000-8000-000000000001';
const MOBILE = '00000000-0000-4000-8000-0000000000e1';
const ESTIMATES = '00000000-0000-4000-8000-0000000000e2';

// Olga owns the workspace; Lea is a member who answers for Legal; Mo is a member. Glossary names nobody, so
// the workspace's owners decide it.
const PEOPLE = { 'token-olga': 'olga', 'token-lea': 'lea', 'token-mo': 'mo' } as const;
type Token = keyof typeof PEOPLE;
const OWNERS = new Set(['olga']);
const person = (login: string): Person => ({ user: `u-${login}`, login });

const legal = (entry: string, code: string, number: number, statement: string, source: string, retiredAt: string | null = null): LegalEntry => ({
  entry, id: `L-${code}-${String(number)}`, code, number, statement, source, owner: person('lea'), retiredAt,
  createdBy: person('lea'), createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
});
const term = (entry: string, name: string, meaning: string): GlossaryEntry => ({
  entry, term: name, meaning, avoid: [], removedAt: null, createdBy: person('olga'), createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
});

const GDPR = '00000000-0000-4000-8000-00000000a001';
const OLD = '00000000-0000-4000-8000-00000000a002';
const QUOTE = '00000000-0000-4000-8000-00000000b001';

/** The database, in memory: one product's knowledge, constituents, and every write as who made it. */
function world() {
  const products: Record<string, FoundProduct> = {
    [MOBILE]: { id: MOBILE, workspace: WS, name: 'Mobile' },
    [ESTIMATES]: { id: ESTIMATES, workspace: WS, name: 'Estimates' },
  };
  const repositories: Record<string, string[]> = { 'kp-org/solo': [MOBILE], 'kp-org/api': [MOBILE, ESTIMATES], 'kp-org/lone': [] };
  const entries: Record<string, LegalEntry[]> = {
    [MOBILE]: [legal(GDPR, 'GDPR', 1, 'Members alone read it.', 'GDPR art. 5'), legal(OLD, 'GDPR', 2, 'Gone.', 'GDPR art. 6', '2026-10-02T09:00:00Z')],
    [ESTIMATES]: [],
  };
  const terms: Record<string, GlossaryEntry[]> = { [MOBILE]: [term(QUOTE, 'Quote', 'A priced offer.')], [ESTIMATES]: [] };
  const constituents: { id: string; product: string; kind: 'statement' | 'never'; seq: number | null; text: string }[] = [
    { id: 'c-statement', product: MOBILE, kind: 'statement', seq: null, text: 'Mobile, for crews.' },
    { id: 'c-never-1', product: MOBILE, kind: 'never', seq: 1, text: 'We never sell data.' },
  ];
  const written: string[] = [];
  let made = 0;
  const BAD_CODE = { ok: false, code: '22023', message: 'Code: one word of letters and digits, starting with a letter, at most 40 (INVOICING).' } as const;

  /** product_legal_add(): the next number of its code, retired entries counted. */
  const addLegal = (product: string, f: ChangeWrite['fields']) => {
    if (!/^[A-Z][A-Z0-9]*$/i.test(f.code ?? '')) return BAD_CODE;
    const code = (f.code ?? '').toUpperCase();
    const listed = entries[product] ?? [];
    const next = Math.max(0, ...listed.filter((e) => e.code === code).map((e) => e.number)) + 1;
    made += 1;
    listed.push(legal(`00000000-0000-4000-8000-00000000c00${String(made)}`, code, next, f.statement ?? '', f.source ?? ''));
    return { ok: true } as const;
  };

  /** product_glossary_add(). */
  const addTerm = (product: string, f: ChangeWrite['fields']) => {
    made += 1;
    terms[product]?.push(term(`00000000-0000-4000-8000-00000000d00${String(made)}`, f.term ?? '', f.meaning ?? ''));
    return { ok: true } as const;
  };

  /** The Knowledge tab's repository as `who` (product-knowledge.repository.ts): the tab's rules decide. */
  const knowledgeAs = (who: string): KnowledgeRepository => {
    const decides = { legal: who === 'lea', glossary: OWNERS.has(who) };
    const read = (product: string): KnowledgeRead => ({
      product: { id: product, name: products[product]?.name ?? '' }, canName: OWNERS.has(who), latestEventId: null,
      legal: { owner: person('lea'), delegate: null, decides: decides.legal, entries: entries[product] ?? [], proposals: [] },
      glossary: { owner: null, delegate: null, decides: decides.glossary, entries: terms[product] ?? [], proposals: [] },
    });
    return {
      product: (id) => Promise.resolve(products[id] ? { id, workspace_id: WS, name: products[id].name } : null),
      read: (_workspace, product) => Promise.resolve({ ok: true, read: read(product) }),
      roster: () => Promise.resolve([]),
      apply: (_workspace, product, change: ChangeWrite) => {
        written.push(`${who} applies ${change.kind} ${change.action} ${change.entry ?? '-'} ${JSON.stringify(change.fields)}`);
        if (change.action !== 'add') return Promise.resolve({ ok: true });
        return Promise.resolve(change.kind === 'legal' ? addLegal(product, change.fields) : addTerm(product, change.fields));
      },
      propose: (_workspace, _product, change) => {
        written.push(`${who} proposes ${change.kind} ${change.action} ${change.entry ?? '-'} ${JSON.stringify(change.fields)}`);
        return Promise.resolve({ ok: true });
      },
      decide: () => Promise.resolve({ ok: true }),
      name: () => Promise.resolve({ ok: true }),
    };
  };

  const NOT_OWNER = { ok: false, code: '42501', message: 'Only an owner of the workspace can change its constituents.' } as const;

  /** This route's repository as `who` (knowledge-api.repository.ts): knowledge_product_for_repo() and the constituent functions. */
  const apiAs = (who: string, { failing = false }: { failing?: boolean } = {}): KnowledgeApiRepository => ({
    productFor: (repo, named) => {
      if (failing) return Promise.resolve({ ok: false, code: 'XX000', message: 'connection reset' });
      if (repo.startsWith('other-org/')) return Promise.resolve({ ok: false, code: '42501', message: `you are not a member of Other, which owns ${repo}` });
      const listed = (repositories[repo] ?? []).map((id) => products[id]).filter((p) => p !== undefined);
      if (named) {
        const picked = listed.find((p) => p.name.toLowerCase() === named.toLowerCase());
        return Promise.resolve(picked ? { ok: true, value: picked } : { ok: false, code: 'P0002', message: `Product: ${named} is not one of ${repo}'s products.` });
      }
      if (listed.length > 1) return Promise.resolve({ ok: false, code: '21000', message: `${repo} is in 2 products: Mobile, Estimates; pass --product to name one.` });
      const [only] = listed;
      return Promise.resolve(only ? { ok: true, value: only } : { ok: false, code: 'P0002', message: `${repo} is in no product yet: link it on a product's page.` });
    },
    constituent: (product, key) =>
      Promise.resolve({ ok: true, value: constituents.find((c) => c.product === product && c.kind === key.kind && c.seq === key.seq)?.id ?? null }),
    addConstituent: (_workspace, product, kind, text): Promise<Stored<ConstituentKey>> => {
      written.push(`${who} adds constituent ${kind} ${text}`);
      if (!OWNERS.has(who)) return Promise.resolve(NOT_OWNER);
      const seq = kind === 'never' ? Math.max(0, ...constituents.map((c) => c.seq ?? 0)) + 1 : null;
      constituents.push({ id: `c-${kind}-${String(seq)}`, product, kind, seq, text });
      return Promise.resolve({ ok: true, value: { kind, seq } });
    },
    editConstituent: (_workspace, id, text): Promise<Stored<ConstituentKey>> => {
      written.push(`${who} edits constituent ${id} ${text}`);
      if (!OWNERS.has(who)) return Promise.resolve(NOT_OWNER);
      const row = constituents.find((c) => c.id === id);
      return Promise.resolve(row ? { ok: true, value: { kind: row.kind, seq: row.seq } } : { ok: false, code: 'P0002', message: 'Constituent: no such line.' });
    },
  });

  const lines: string[] = [];
  const tokens: string[] = [];
  const deps = ({ database = true, failing = false }: { database?: boolean; failing?: boolean } = {}): KnowledgeChangesDeps => ({
    connect: database
      ? (token: string) => {
        tokens.push(token);
        const who = PEOPLE[token as Token] as string | undefined;
        return {
          auth: { getUser: (jwt: string) => Promise.resolve(jwt in PEOPLE ? { data: { user: { id: `u-${String(who)}`, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } }) },
          service: knowledgeApiService(apiAs(who ?? 'nobody', { failing }), knowledgeService(knowledgeAs(who ?? 'nobody'))),
        };
      }
      : null,
    log: (line) => lines.push(line),
  });
  return { deps, written, lines, tokens };
}

const post = (body: unknown, token: string | null = 'token-olga') =>
  new Request(`${ORIGIN}/api/knowledge/changes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as unknown, cache: response.headers.get('cache-control') };
}

const mobile = (path: string) => `${ORIGIN}/app/products/${MOBILE}/knowledge/${path}`;
const vatAdd = { repo: 'kp-org/solo', kind: 'legal', action: 'add', fields: { code: 'vat', statement: 'Invoices are kept ten years.', source: 'Belgian VAT Code, art. 60' } };

describe('POST /api/knowledge/changes: Legal and glossary, the page\'s rules (PRD 2268)', () => {
  it('the Legal owner adds an entry directly: applied, its id and its page, never cached, recorded as theirs', async () => {
    const { deps, written, tokens } = world();
    expect(await answer(await postKnowledgeChange(post(vatAdd, 'token-lea'), deps()))).toEqual({
      status: 200,
      cache: 'no-store',
      body: { done: 'applied', id: 'L-VAT-1', url: mobile('legal/L-VAT-1'), waitsFor: null },
    });
    expect(written).toEqual(['lea applies legal add - {"code":"vat","statement":"Invoices are kept ten years.","source":"Belgian VAT Code, art. 60"}']);
    expect(tokens).toEqual(['token-lea', 'token-lea']);
  });

  it('numbers an addition after the code\'s entries, retired ones too', async () => {
    const { deps } = world();
    const added = await answer(await postKnowledgeChange(post({ ...vatAdd, fields: { ...vatAdd.fields, code: 'GDPR' } }, 'token-lea'), deps()));
    expect(added.body).toEqual({ done: 'applied', id: 'L-GDPR-3', url: mobile('legal/L-GDPR-3'), waitsFor: null });
  });

  it('a member who does not answer for Legal proposes it: no id, the Legal list, and who it waits for', async () => {
    const { deps, written } = world();
    expect(await answer(await postKnowledgeChange(post(vatAdd, 'token-mo'), deps()))).toEqual({
      status: 200,
      cache: 'no-store',
      body: { done: 'proposed', id: null, url: mobile('legal'), waitsFor: 'lea' },
    });
    expect(written).toEqual([expect.stringMatching(/^mo proposes legal add - /)]);
  });

  it('a section that names nobody is the workspace owners\': an owner adds a term, a member proposes one waiting for nobody named', async () => {
    const { deps, written } = world();
    const term = { repo: 'kp-org/solo', kind: 'glossary', action: 'add', fields: { term: 'Credit note', meaning: 'An invoice undone.' } };
    expect((await answer(await postKnowledgeChange(post(term, 'token-olga'), deps()))).body).toEqual({
      done: 'applied', id: 'Credit note', url: expect.stringMatching(new RegExp(`^${mobile('glossary/')}[0-9a-f-]{36}$`)) as unknown, waitsFor: null,
    });
    expect((await answer(await postKnowledgeChange(post({ ...term, fields: { term: 'Order', meaning: 'A quote accepted.' } }, 'token-mo'), deps()))).body).toEqual({
      done: 'proposed', id: null, url: mobile('glossary'), waitsFor: null,
    });
    expect(written.map((w) => w.split(' {')[0])).toEqual(['olga applies glossary add -', 'mo proposes glossary add -']);
  });

  it('an edit names its item as the reads print it, and sends only the fields given', async () => {
    const { deps, written } = world();
    const edit = { repo: 'kp-org/solo', kind: 'legal', action: 'edit', entry: 'l-gdpr-1', fields: { source: 'GDPR art. 5(1)(f)' } };
    expect((await answer(await postKnowledgeChange(post(edit, 'token-lea'), deps()))).body).toEqual({
      done: 'applied', id: 'L-GDPR-1', url: mobile('legal/L-GDPR-1'), waitsFor: null,
    });
    const termEdit = { repo: 'kp-org/solo', kind: 'glossary', action: 'edit', entry: 'QUOTE', fields: { avoid: ['estimate', 'offer'] } };
    expect((await answer(await postKnowledgeChange(post(termEdit, 'token-olga'), deps()))).body).toEqual({
      done: 'applied', id: 'Quote', url: mobile(`glossary/${QUOTE}`), waitsFor: null,
    });
    expect(written).toEqual([
      `lea applies legal edit ${GDPR} {"source":"GDPR art. 5(1)(f)"}`,
      `olga applies glossary edit ${QUOTE} {"avoid":["estimate","offer"]}`,
    ]);
  });

  it('a member\'s edit is proposed on the entry it names', async () => {
    const { deps, written } = world();
    const edit = { repo: 'kp-org/solo', kind: 'legal', action: 'edit', entry: 'L-GDPR-1', fields: { statement: 'Only members read it.' } };
    expect((await answer(await postKnowledgeChange(post(edit, 'token-mo'), deps()))).body).toEqual({ done: 'proposed', id: null, url: mobile('legal'), waitsFor: 'lea' });
    expect(written).toEqual([`mo proposes legal edit ${GDPR} {"statement":"Only members read it."}`]);
  });

  it('an unknown or retired item is 404, naming it, and nothing is written', async () => {
    const { deps, written } = world();
    const edit = (entry: string, kind = 'legal') => post({ repo: 'kp-org/solo', kind, action: 'edit', entry, fields: kind === 'legal' ? { statement: 'x' } : { meaning: 'x' } }, 'token-lea');
    expect(await answer(await postKnowledgeChange(edit('L-NOPE-1'), deps()))).toEqual({ status: 404, cache: 'no-store', body: { error: 'No Legal entry L-NOPE-1 in Mobile.' } });
    expect((await answer(await postKnowledgeChange(edit('L-GDPR-2'), deps()))).status).toBe(404);
    expect(await answer(await postKnowledgeChange(edit('Invoice', 'glossary'), deps()))).toEqual({ status: 404, cache: 'no-store', body: { error: 'No term Invoice in Mobile\'s glossary.' } });
    expect(written).toEqual([]);
  });

  it('a value the database refuses is 422, in its words', async () => {
    const { deps } = world();
    expect(await answer(await postKnowledgeChange(post({ ...vatAdd, fields: { ...vatAdd.fields, code: 'two words' } }, 'token-lea'), deps()))).toEqual({
      status: 422, cache: 'no-store', body: { error: 'Code: one word of letters and digits, starting with a letter, at most 40 (INVOICING).' },
    });
  });
});

describe('POST /api/knowledge/changes: constituents, a workspace owner\'s alone (PRD 2268)', () => {
  it('an owner adds a Never line and the Statement\'s edit: applied, the display id and the item\'s page', async () => {
    const { deps, written } = world();
    expect(await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'add', fields: { never: 'We never store card numbers.' } }), deps()))).toEqual({
      status: 200, cache: 'no-store', body: { done: 'applied', id: 'never#2', url: mobile('constituents/never-2'), waitsFor: null },
    });
    expect((await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'edit', entry: 'statement', fields: { text: 'Mobile, for crews on site.' } }), deps()))).body).toEqual({
      done: 'applied', id: 'statement', url: mobile('constituents/statement'), waitsFor: null,
    });
    expect((await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'edit', entry: 'never#1', fields: { text: 'We never sell data, ever.' } }), deps()))).body).toEqual({
      done: 'applied', id: 'never#1', url: mobile('constituents/never-1'), waitsFor: null,
    });
    expect(written).toEqual(['olga adds constituent never We never store card numbers.', 'olga edits constituent c-statement Mobile, for crews on site.', 'olga edits constituent c-never-1 We never sell data, ever.']);
  });

  it('a member changing a constituent is 403, in the database\'s words, with no proposal', async () => {
    const { deps } = world();
    const refused = { status: 403, cache: 'no-store', body: { error: 'Only an owner of the workspace can change its constituents.' } };
    expect(await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'add', fields: { statement: 'x' } }, 'token-mo'), deps()))).toEqual(refused);
    expect(await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'edit', entry: 'never#1', fields: { text: 'x' } }, 'token-lea'), deps()))).toEqual(refused);
  });

  it('a Never line the product does not have is 404', async () => {
    const { deps, written } = world();
    expect(await answer(await postKnowledgeChange(post({ repo: 'kp-org/solo', kind: 'constituent', action: 'edit', entry: 'never#9', fields: { text: 'x' } }), deps()))).toEqual({
      status: 404, cache: 'no-store', body: { error: 'No never#9 in Mobile\'s constituents.' },
    });
    expect(written).toEqual([]);
  });
});

describe('POST /api/knowledge/changes: the product, from the repository (PRD 2268)', () => {
  it('a repository in several products and none named is 409, naming them; named, the change lands on that product', async () => {
    const { deps, written } = world();
    expect(await answer(await postKnowledgeChange(post({ ...vatAdd, repo: 'kp-org/api' }, 'token-lea'), deps()))).toEqual({
      status: 409, cache: 'no-store', body: { error: 'kp-org/api is in 2 products: Mobile, Estimates; pass --product to name one.' },
    });
    expect(written).toEqual([]);
    const landed = await answer(await postKnowledgeChange(post({ ...vatAdd, repo: 'kp-org/api', product: 'estimates' }, 'token-lea'), deps()));
    expect(landed.body).toEqual({ done: 'applied', id: 'L-VAT-1', url: `${ORIGIN}/app/products/${ESTIMATES}/knowledge/legal/L-VAT-1`, waitsFor: null });
  });

  it('a repository in no product, or a product it is not in, is 404 in the database\'s words', async () => {
    const { deps } = world();
    expect(await answer(await postKnowledgeChange(post({ ...vatAdd, repo: 'kp-org/lone' }), deps()))).toEqual({
      status: 404, cache: 'no-store', body: { error: 'kp-org/lone is in no product yet: link it on a product\'s page.' },
    });
    expect((await answer(await postKnowledgeChange(post({ ...vatAdd, product: 'Field' }), deps()))).status).toBe(404);
  });

  it('another workspace\'s repository is 403, and nothing is written (BR-PRODUCT-63)', async () => {
    const { deps, written } = world();
    expect(await answer(await postKnowledgeChange(post({ ...vatAdd, repo: 'other-org/api' }), deps()))).toEqual({
      status: 403, cache: 'no-store', body: { error: 'you are not a member of Other, which owns other-org/api' },
    });
    expect(written).toEqual([]);
  });
});

describe('POST /api/knowledge/changes: the edge (PRD 2268)', () => {
  it('refuses a caller signed out, or with a sign-in no longer valid, before reading anything', async () => {
    const { deps, written, tokens } = world();
    expect(await answer(await postKnowledgeChange(post(vatAdd, null), deps()))).toEqual({
      status: 401, cache: 'no-store', body: { error: 'Sign in first: this call needs an Authorization: Bearer token.' },
    });
    expect((await postKnowledgeChange(post(vatAdd, 'token-gone'), deps())).status).toBe(401);
    expect(written).toEqual([]);
    expect(tokens).toEqual(['token-gone']);
  });

  it('refuses a malformed change, naming what is wrong, before changing anything', async () => {
    const { deps, written } = world();
    const malformed = async (body: unknown) => answer(await postKnowledgeChange(post(body), deps()));
    expect(await malformed('not json')).toEqual({ status: 400, cache: 'no-store', body: { error: 'The body must be a JSON object.' } });
    expect((await malformed({ ...vatAdd, kind: 'persona' })).body).toEqual({ error: 'A knowledge change names its kind (legal, glossary or constituent) and its action (add or edit).' });
    expect((await malformed({ ...vatAdd, action: 'retire' })).status).toBe(400);
    expect((await malformed({ ...vatAdd, entry: 'L-VAT-1' })).body).toEqual({ error: 'A knowledge change does not carry entry.' });
    expect((await malformed({ ...vatAdd, repo: 'kp-org' })).body).toEqual({ error: 'A knowledge change\'s `repo` is malformed: the repository as owner/name.' });
    expect((await malformed({ repo: 'kp-org/solo', kind: 'legal', action: 'edit', entry: 'L-GDPR-1', fields: {} })).body).toEqual({ error: 'A knowledge change\'s `fields` is malformed: name at least one field to change.' });
    expect((await malformed({ repo: 'kp-org/solo', kind: 'legal', action: 'edit', fields: { source: 'x' } })).status).toBe(400);
    expect((await malformed({ repo: 'kp-org/solo', kind: 'legal', action: 'edit', entry: 'L-GDPR-1', fields: { code: 'X' } })).status).toBe(400);
    expect((await malformed({ repo: 'kp-org/solo', kind: 'legal', action: 'add', fields: { code: 'VAT', statement: 'x' } })).status).toBe(400);
    expect((await malformed({ repo: 'kp-org/solo', kind: 'constituent', action: 'add', fields: { statement: 'x', never: 'y' } })).status).toBe(400);
    expect((await malformed({ repo: 'kp-org/solo', kind: 'constituent', action: 'edit', entry: 'never#0', fields: { text: 'x' } })).status).toBe(400);
    expect((await malformed({ repo: 'kp-org/solo', kind: 'glossary', action: 'add', fields: { term: 'x'.repeat(81), meaning: 'y' } })).status).toBe(400);
    expect(written).toEqual([]);
  });

  it('refuses a body over 16 KiB', async () => {
    const { deps } = world();
    expect((await postKnowledgeChange(post({ ...vatAdd, pad: 'x'.repeat(17 * 1024) }), deps())).status).toBe(413);
  });

  it('answers 503 with no database here', async () => {
    const { deps } = world();
    expect(await answer(await postKnowledgeChange(post(vatAdd), deps({ database: false })))).toEqual({
      status: 503, cache: 'no-store', body: { error: 'Knowledge changes are not available here: this deployment has no database.' },
    });
  });

  it('answers 500 in plain words when the database fails, and logs why', async () => {
    const { deps, lines } = world();
    const given = deps({ failing: true });
    expect(await answer(await postKnowledgeChange(post(vatAdd), given))).toEqual({
      status: 500, cache: 'no-store', body: { error: 'The change could not be saved. Try again.' },
    });
    expect(lines).toEqual(['knowledge-changes: kp-org/solo legal add: connection reset']);
  });
});
