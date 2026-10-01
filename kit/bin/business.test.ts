// `omni business show [--json]` (PRD 748), seen from the outside: through `main()` on a fixture
// repository, against the fake contract server, with the sign-in an in-memory token store. Every
// reading outcome exits 0 with one "— agents carry on" line; only a usage error exits 2.
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

const config = (url: string) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`;

const claim = (id: string, value: string, source = 'pick', state = 'confirmed') =>
  ({ id, kind: id.split('#')[0], value, source, state, receipt: null, lastSeen: null });

const FILLED = {
  state: 'ok',
  business: { name: 'Acme' },
  product: null,
  claims: [
    claim('region#1', 'Belgium'),
    claim('offering#2', 'ERP'),
    claim('size#3', '2-50'),
    claim('trade#4', 'construction'),
    claim('rival#5', 'Rival One', 'suggestion'),
    claim('rival#12', 'Rival Two'),
  ],
  personas: [],
};

const persona = (name: string, stance: string, trade: string, who: string, usage: string) => ({ name, stance, trade, who, usage });
const CAST = [
  persona('Marc', 'skeptical', 'plumber', 'Runs a company of five plumbers', 'Mostly the quotes'),
  persona('Lea', 'excited', 'office', 'Keeps the office of a builder', 'The dashboard, every morning'),
];

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A checkout of acme/widgets pointed at the fake server, signed in to it unless `signedIn` is false. */
async function checkout({ business, signedIn = true, url } = {}) {
  server = await startFakeAskServer({ business });
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url === undefined ? server.url : url) } });
  const tokens = memoryTokens(signedIn ? { [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {});
  return { root, tokens };
}

async function show(args: string[], { root, tokens, ...more }) {
  const s = io();
  const code = await main(['business', ...args], { cwd: root, ...s, tokens, env: {}, ...more });
  return { code, out: s.out(), err: s.err() };
}

describe('omni business show', () => {
  it('prints the sentence and one line per claim with its id, and exits 0', async () => {
    const c = await checkout({ business: () => ({ body: FILLED }) });
    const run = await show(['show'], c);
    expect(run).toEqual({
      code: 0,
      err: '',
      out: [
        'We sell ERP to 2–50-person construction in Belgium, up against Rival One and Rival Two.',
        '  region#1    Belgium',
        '  offering#2  ERP',
        '  size#3      2-50',
        '  trade#4     construction',
        '  rival#5     Rival One',
        '  rival#12    Rival Two',
        '',
      ].join('\n'),
    });
    expect(server.calls.map(({ method, path, authorization }) => ({ method, path, authorization }))).toEqual([
      { method: 'GET', path: '/api/business', authorization: 'Bearer access-1' },
    ]);
  });

  it('asks for this repository by its slug', async () => {
    const asked: unknown[] = [];
    const c = await checkout({ business: (repo: any) => { asked.push(repo); return { body: FILLED }; } });
    await show(['show'], c);
    expect(asked).toEqual(['acme/widgets']);
  });

  it('leaves a blank for each kind with no claim', async () => {
    const body = { ...FILLED, claims: [claim('region#1', 'Belgium'), claim('region#2', 'France')] };
    const c = await checkout({ business: () => ({ body }) });
    const run = await show(['show'], c);
    expect(run.out.split('\n')[0]).toBe('We sell ___ to ___-person ___ in Belgium and France, up against ___.');
  });

  it('--json prints exactly the decision-14 shape, state ok', async () => {
    const withProduct = { ...FILLED, product: { name: 'Omni Loop' } };
    const c = await checkout({ business: () => ({ body: withProduct }) });
    const run = await show(['show', '--json'], c);
    expect(run.code).toBe(0);
    expect(run.out.endsWith('\n')).toBe(true);
    const printed = JSON.parse(run.out);
    expect(printed).toEqual(withProduct);
    expect(Object.keys(printed)).toEqual(['state', 'business', 'product', 'claims', 'personas']);
    expect(Object.keys(printed.claims[0])).toEqual(['id', 'kind', 'value', 'source', 'state', 'receipt', 'lastSeen']);
  });

  it('prints a Never line (PRD 839) as never#<seq>, out of the sentence', async () => {
    const line = 'Build for groups of companies, holdings or anyone with more than one legal entity to consolidate';
    const body = { ...FILLED, claims: [...FILLED.claims, claim('never#13', line)] };
    const c = await checkout({ business: () => ({ body }) });
    const run = await show(['show'], c);
    expect(run.code).toBe(0);
    const lines = run.out.split('\n');
    expect(lines[0]).toBe('We sell ERP to 2–50-person construction in Belgium, up against Rival One and Rival Two.');
    expect(lines).toContain(`  never#13    ${line}`);
  });

  it('--json carries a Never line as a claim of kind never', async () => {
    const never = claim('never#13', 'Build for groups of companies');
    const body = { ...FILLED, claims: [never] };
    const c = await checkout({ business: () => ({ body }) });
    const printed = JSON.parse((await show(['show', '--json'], c)).out);
    expect(printed).toEqual({ ...FILLED, claims: [never] });
  });

  it('drops any field outside the contract', async () => {
    const extra = { ...FILLED, secret: 'x', claims: [{ ...claim('region#1', 'Belgium'), seq: 1 }] };
    const c = await checkout({ business: () => ({ body: extra }) });
    const printed = JSON.parse((await show(['show', '--json'], c)).out);
    expect(printed).toEqual({ state: 'ok', business: { name: 'Acme' }, product: null, claims: [claim('region#1', 'Belgium')], personas: [] });
  });

  it('a contradicted claim keeps its state in --json, and is marked, not stated, in the text', async () => {
    const body = { ...FILLED, claims: [
      claim('region#1', 'Belgium'),
      { ...claim('offering#2', 'ERP', 'pick', 'contradicted'), receipt: null },
      { ...claim('region#9', 'France', 'evidence'), receipt: 'acme/widgets:README.md — "offices in France"', lastSeen: '2026-09-28T22:00:00+00:00' },
    ] };
    const c = await checkout({ business: () => ({ body }) });
    expect(JSON.parse((await show(['show', '--json'], c)).out)).toEqual(body);
    expect((await show(['show'], c)).out).toBe([
      'We sell ___ to ___-person ___ in Belgium and France, up against ___.',
      '  region#1    Belgium',
      '  offering#2  ERP  (contradicted: evidence disagrees, nobody answered yet)',
      '  region#9    France',
      '',
    ].join('\n'));
  });

  it('reads a claim from a server that sends no state as confirmed', async () => {
    const { state, ...older } = claim('region#1', 'Belgium');
    const c = await checkout({ business: () => ({ body: { ...FILLED, claims: [older] } }) });
    const printed = JSON.parse((await show(['show', '--json'], c)).out);
    expect(printed.claims).toEqual([claim('region#1', 'Belgium')]);
  });

  it('--json carries the product\'s personas, oldest first, in the contract\'s shape (PRD 799)', async () => {
    const body = { ...FILLED, personas: CAST.map((p) => ({ ...p, avatar: { v: 1 } })) };
    const c = await checkout({ business: () => ({ body }) });
    const printed = JSON.parse((await show(['show', '--json'], c)).out);
    expect(printed.personas).toEqual(CAST);
    expect(Object.keys(printed.personas[0])).toEqual(['name', 'stance', 'trade', 'who', 'usage']);
  });

  it('prints one line per persona under the claims', async () => {
    const body = { ...FILLED, claims: [claim('region#1', 'Belgium')], personas: CAST };
    const c = await checkout({ business: () => ({ body }) });
    expect((await show(['show'], c)).out).toBe([
      'We sell ___ to ___-person ___ in Belgium, up against ___.',
      '  region#1  Belgium',
      '  persona   Marc (skeptical, plumber): Runs a company of five plumbers — uses: Mostly the quotes',
      '  persona   Lea (excited, office): Keeps the office of a builder — uses: The dashboard, every morning',
      '',
    ].join('\n'));
  });

  it('reads a server that sends no personas as none', async () => {
    const { personas, ...older } = FILLED;
    const c = await checkout({ business: () => ({ body: older }) });
    expect(JSON.parse((await show(['show', '--json'], c)).out).personas).toEqual([]);
  });

  it('state stays none without a confirmed claim, and the personas still come back', async () => {
    const body = { state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: [CAST[0]] };
    const c = await checkout({ business: () => ({ body }) });
    expect(JSON.parse((await show(['show', '--json'], c)).out)).toEqual(body);
    const text = await show(['show'], c);
    expect(text).toEqual({ code: 0, err: '', out: [
      'no confirmed claim for acme/widgets yet — agents carry on',
      '  persona  Marc (skeptical, plumber): Runs a company of five plumbers — uses: Mostly the quotes',
      '',
    ].join('\n') });
  });
});

describe('omni business show never blocks an agent: exit 0 and one line in every other state', () => {
  const NONE_BODY = { state: 'none', business: null, product: null, claims: [], personas: [] };
  const CASES = [
    {
      name: 'no business (none)',
      setup: () => checkout({ business: () => ({ body: NONE_BODY }) }),
      state: 'none', line: 'no business for acme/widgets yet — agents carry on', json: NONE_BODY,
    },
    {
      name: 'a business with no confirmed claim for this repository (none)',
      setup: () => checkout({ business: () => ({ body: { ...NONE_BODY, business: { name: 'Acme' } } }) }),
      state: 'none', line: 'no confirmed claim for acme/widgets yet — agents carry on',
      json: { state: 'none', business: { name: 'Acme' }, product: null, claims: [], personas: [] },
    },
    {
      name: 'no sign-in (no-sign-in)',
      setup: () => checkout({ business: () => ({ body: FILLED }), signedIn: false }),
      state: 'no-sign-in', line: 'no sign-in (omni signin) — agents carry on',
    },
    {
      name: 'a sign-in the app no longer honours (no-sign-in)',
      setup: async () => {
        const c = await checkout({ business: () => ({ body: FILLED }) });
        server.denyAccess();
        return c;
      },
      state: 'no-sign-in', line: 'the sign-in was refused (omni signin) — agents carry on',
    },
    {
      name: 'no Omni page set here (no-sign-in)',
      setup: () => checkout({ business: () => ({ body: FILLED }), url: null }),
      state: 'no-sign-in', line: 'no Omni page is set here (ask.url) — agents carry on',
    },
    {
      name: 'the app unreachable (unreachable)',
      setup: async () => {
        const c = await checkout({ business: () => ({ body: FILLED }) });
        await server.close();
        return c;
      },
      state: 'unreachable', line: 'the Omni page could not be reached — agents carry on',
    },
    {
      name: 'a refusal, with its reason (refused)',
      setup: () => checkout({ business: () => ({ status: 403, body: { error: 'you are not a member of Acme, which owns acme/widgets' } }) }),
      state: 'refused', line: 'refused (403): you are not a member of Acme, which owns acme/widgets — agents carry on',
    },
    {
      name: 'a server older than the call (refused)',
      setup: () => checkout(),
      state: 'refused', line: 'refused (404): no such call — agents carry on',
    },
    {
      name: 'a reply that is not a business (refused)',
      setup: () => checkout({ business: () => ({ body: { state: 'ok', claims: [] } }) }),
      state: 'refused', line: 'refused (the reply is not a business) — agents carry on',
    },
    ...['proposed', 'rejected', 'unknown'].map((claimState) => ({
      name: `a reply carrying a ${claimState} claim (refused)`,
      setup: () => checkout({ business: () => ({ body: { ...FILLED, claims: [claim('rival#3', 'Guessed', 'evidence', claimState)] } }) }),
      state: 'refused', line: 'refused (the reply is not a business) — agents carry on',
    })),
    ...[
      ['a bad stance', { ...CAST[0], stance: 'angry' }],
      ['no name', { ...CAST[0], name: '' }],
      ['not a persona', 'Marc'],
    ].map(([what, bad]) => ({
      name: `a reply carrying a persona with ${what} (refused)`,
      setup: () => checkout({ business: () => ({ body: { ...FILLED, personas: [bad] } }) }),
      state: 'refused', line: 'refused (the reply is not a business) — agents carry on',
    })),
  ];

  for (const { name, setup, state, line, json } of CASES) {
    it(name, async () => {
      const c = await setup();
      const text = await show(['show'], c);
      expect(text).toEqual({ code: 0, out: `${line}\n`, err: '' });
      const asJson = await show(['show', '--json'], c);
      expect(asJson.code).toBe(0);
      expect(asJson.err).toBe('');
      expect(JSON.parse(asJson.out)).toEqual(json ?? { state, business: null, product: null, claims: [], personas: [] });
    });
  }
});

describe('omni business: usage errors exit 2', () => {
  for (const args of [[], ['list'], ['show', 'extra'], ['show', '--yaml']]) {
    it(`omni business ${args.join(' ')}`, async () => {
      const c = await checkout({ business: () => ({ body: FILLED }) });
      const run = await show(args, c);
      expect(run.code).toBe(2);
      expect(run.out).toBe('');
      expect(run.err).toMatch(/omni business/);
      expect(server.calls).toEqual([]);
    });
  }
});

describe('omni business cited', () => {
  /** A checkout whose fake server logs citations with `cite`, or answers 404 without it. */
  async function citing({ cite, signedIn = true, url } = {}) {
    server = await startFakeAskServer({ cite });
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url === undefined ? server.url : url) } });
    const tokens = memoryTokens(signedIn ? { [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {});
    return { root, tokens };
  }

  it('appends one citation through POST /api/business/citations, and says so', async () => {
    const sent: unknown[] = [];
    const c = await citing({ cite: (body) => { sent.push(body); return { body: { cited: body.ids.length } }; } });
    const run = await show(['cited', 'rival#4', '--by', 'think-big', '--ref', 'concept #9'], c);
    expect(run).toEqual({ code: 0, err: '', out: 'cited rival#4 (think-big, concept #9)\n' });
    expect(sent).toEqual([{ repo: 'acme/widgets', ids: ['rival#4'], by: 'think-big', ref: 'concept #9' }]);
    expect(server.calls.map(({ method, path, authorization }) => ({ method, path, authorization }))).toEqual([
      { method: 'POST', path: '/api/business/citations', authorization: 'Bearer access-1' },
    ]);
  });

  it('cites several ids in one call, and --ref may be left out', async () => {
    const sent: unknown[] = [];
    const c = await citing({ cite: (body) => { sent.push(body); return { body: { cited: body.ids.length } }; } });
    const run = await show(['cited', 'region#1', 'rival#4', '--by', 'think-big'], c);
    expect(run).toEqual({ code: 0, err: '', out: 'cited region#1, rival#4 (think-big)\n' });
    expect(sent).toEqual([{ repo: 'acme/widgets', ids: ['region#1', 'rival#4'], by: 'think-big', ref: null }]);
  });

  const SKIPS = [
    {
      name: 'a refusal, with its reason',
      setup: () => citing({ cite: () => ({ status: 404, body: { error: 'Ids: this business holds no rival#4.' } }) }),
      line: 'citation skipped: refused (404): Ids: this business holds no rival#4. — agents carry on',
    },
    {
      name: 'a server older than the call',
      setup: () => citing(),
      line: 'citation skipped: refused (404): no such call — agents carry on',
    },
    {
      name: 'no sign-in',
      setup: () => citing({ cite: () => ({ body: { cited: 1 } }), signedIn: false }),
      line: 'citation skipped: no sign-in (omni signin) — agents carry on',
    },
    {
      name: 'a sign-in the app no longer honours',
      setup: async () => {
        const c = await citing({ cite: () => ({ body: { cited: 1 } }) });
        server.denyAccess();
        return c;
      },
      line: 'citation skipped: the sign-in was refused (omni signin) — agents carry on',
    },
    {
      name: 'no Omni page set here',
      setup: () => citing({ cite: () => ({ body: { cited: 1 } }), url: null }),
      line: 'citation skipped: no Omni page is set here (ask.url) — agents carry on',
    },
    {
      name: 'the app unreachable',
      setup: async () => {
        const c = await citing({ cite: () => ({ body: { cited: 1 } }) });
        await server.close();
        return c;
      },
      line: 'citation skipped: the Omni page could not be reached — agents carry on',
    },
  ];

  for (const { name, setup, line } of SKIPS) {
    it(`a failed call prints a skip line and exits 0: ${name}`, async () => {
      const c = await setup();
      const run = await show(['cited', 'rival#4', '--by', 'think-big', '--ref', 'concept #9'], c);
      expect(run).toEqual({ code: 0, out: `${line}\n`, err: '' });
    });
  }

  for (const args of [['cited'], ['cited', 'rival#4'], ['cited', '--by', 'think-big'], ['cited', 'rival#4', '--by', 'think-big', '--json']]) {
    it(`a usage error exits 2: omni business ${args.join(' ')}`, async () => {
      const c = await citing({ cite: () => ({ body: { cited: 1 } }) });
      const run = await show(args, c);
      expect(run.code).toBe(2);
      expect(run.out).toBe('');
      expect(run.err).toMatch(/omni business/);
      expect(server.calls).toEqual([]);
    });
  }
});

describe('omni business claim add (PRD 822)', () => {
  /** A checkout whose fake server stores claims with `claim`, or answers 404 without it. */
  async function claiming({ claim: store, signedIn = true, url } = {}) {
    server = await startFakeAskServer({ claim: store });
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url === undefined ? server.url : url) } });
    const tokens = memoryTokens(signedIn ? { [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {});
    return { root, tokens };
  }
  const ADD = ['claim', 'add', '--kind', 'size', '--value', '20-50', '--ref', 'brainstorm · PRD 822'];
  const stored = (sent: unknown[]) => (body) => {
    sent.push(body);
    return { body: { id: 'size#12', state: body.state, added: true } };
  };

  for (const state of ['proposed', 'confirmed']) {
    it(`stores a ${state} claim through POST /api/business/claims, and says so`, async () => {
      const sent: never[] = [];
      const c = await claiming({ claim: stored(sent) });
      const run = await show([...ADD, '--state', state], c);
      expect(run).toEqual({ code: 0, err: '', out: `claim saved: size#12 (${state})\n` });
      expect(sent).toEqual([{ repo: 'acme/widgets', kind: 'size', value: '20-50', state, ref: 'brainstorm · PRD 822' }]);
      expect(server.calls.map(({ method, path, authorization }) => ({ method, path, authorization }))).toEqual([
        { method: 'POST', path: '/api/business/claims', authorization: 'Bearer access-1' },
      ]);
    });
  }

  it('says when the business already held that value, in the state it now has', async () => {
    const c = await claiming({ claim: () => ({ body: { id: 'size#3', state: 'confirmed', added: false } }) });
    const run = await show([...ADD, '--state', 'proposed'], c);
    expect(run).toEqual({ code: 0, err: '', out: 'claim already held: size#3 (confirmed)\n' });
  });

  it('a value the business once rejected is named as rejected, not stored again', async () => {
    const c = await claiming({ claim: () => ({ body: { id: 'rival#7', state: 'rejected', added: false } }) });
    const run = await show(['claim', 'add', '--kind', 'rival', '--value', 'Old Rival', '--state', 'proposed', '--ref', 'r'], c);
    expect(run).toEqual({ code: 0, err: '', out: 'claim already held: rival#7 (rejected)\n' });
  });

  const SKIPS = [
    {
      name: 'a refusal, with its reason',
      setup: () => claiming({ claim: () => ({ status: 403, body: { error: 'you are not a member of Acme, which owns acme/widgets' } }) }),
      line: 'claim skipped: refused (403): you are not a member of Acme, which owns acme/widgets — agents carry on',
    },
    {
      name: 'a server older than the call',
      setup: () => claiming(),
      line: 'claim skipped: refused (404): no such call — agents carry on',
    },
    {
      name: 'a reply that is not a claim',
      setup: () => claiming({ claim: () => ({ body: { cited: 1 } }) }),
      line: 'claim skipped: refused (the reply is not a claim) — agents carry on',
    },
    {
      name: 'no sign-in',
      setup: () => claiming({ claim: stored([]), signedIn: false }),
      line: 'claim skipped: no sign-in (omni signin) — agents carry on',
    },
    {
      name: 'a sign-in the app no longer honours',
      setup: async () => {
        const c = await claiming({ claim: stored([]) });
        server.denyAccess();
        return c;
      },
      line: 'claim skipped: the sign-in was refused (omni signin) — agents carry on',
    },
    {
      name: 'no Omni page set here',
      setup: () => claiming({ claim: stored([]), url: null }),
      line: 'claim skipped: no Omni page is set here (ask.url) — agents carry on',
    },
    {
      name: 'the app unreachable',
      setup: async () => {
        const c = await claiming({ claim: stored([]) });
        await server.close();
        return c;
      },
      line: 'claim skipped: the Omni page could not be reached — agents carry on',
    },
  ];

  for (const { name, setup, line } of SKIPS) {
    it(`a failed call prints a skip line and exits 0: ${name}`, async () => {
      const c = await setup();
      const run = await show([...ADD, '--state', 'proposed'], c);
      expect(run).toEqual({ code: 0, out: `${line}\n`, err: '' });
    });
  }

  const flags = (without: string | null, extra = []) => {
    const all = { '--kind': 'size', '--value': '20-50', '--state': 'proposed', '--ref': 'brainstorm · PRD 822' };
    return ['claim', 'add', ...Object.entries(all).filter(([flag]) => flag !== without).flat(), ...extra];
  };
  for (const args of [
    ['claim'], ['claim', 'remove'], flags('--kind'), flags('--value'), flags('--state'), flags('--ref'),
    flags(null, ['extra']), flags(null, ['--json']),
    ['claim', 'add', '--kind', 'colour', '--value', 'red', '--state', 'proposed', '--ref', 'r'],
    ['claim', 'add', '--kind', 'size', '--value', '20-50', '--state', 'rejected', '--ref', 'r'],
    ['claim', 'add', '--kind', 'size', '--value', '  ', '--state', 'proposed', '--ref', 'r'],
    ['claim', 'add', '--kind', 'size', '--value', '20-50', '--state', 'proposed', '--ref', ' '],
  ]) {
    it(`a usage error exits 2: omni business ${args.join(' ')}`, async () => {
      const c = await claiming({ claim: stored([]) });
      const run = await show(args, c);
      expect(run.code).toBe(2);
      expect(run.out).toBe('');
      expect(run.err).toMatch(/omni business/);
      expect(server.calls).toEqual([]);
    });
  }
});
