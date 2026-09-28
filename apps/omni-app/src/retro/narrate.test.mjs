import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it, vi } from 'vitest';
import { inngest } from '../inngest-client.mjs';
import { widgetScenario } from '../../test/retro-scenario.mjs';
import { LOOK_RULE } from 'vertuo-omni-plan/kit/lib/knowledge/look-rule.mjs';
import {
  CHARS_PER_TOKEN,
  DEFAULT_MODEL,
  JUDGE_VERSION,
  MODEL_CALL,
  NO_MODEL_KEY,
  OPENROUTER_URL,
  REPLY_INVALID,
  checkReply,
  maskSecrets,
  modelInput,
  narrate,
} from './narrate.mjs';
import { createRetro } from './retro.mjs';
import { LIMITS } from './rules.mjs';

const RUN = (n) => `https://github.com/acme/widgets/actions/runs/${n}`;
const PRD = { title: 'Widgets that remember their colour', problem: 'A widget forgets its colour when the page reloads.' };
const KEY = { OPENROUTER_API_KEY: 'sk-or-v1-test-key-not-real-0000000000' };

/** A fact sheet as `detect` makes it: a red check with two log tails (oldest first), and a slow slice. */
function sheetOf(findings = [RED, SLOW]) {
  return { run: 'merge', prd: { number: 7, title: PRD.title }, findings };
}
const RED = {
  ref: 'F1',
  id: 'repeated-red:e2e',
  kind: 'repeated-red',
  source: 'ci',
  title: 'The check e2e went red again and again',
  happened: 'The check e2e was red on 2 commits in 2 slices.',
  evidence: [
    { label: 'run 7001', url: RUN(7001), excerpt: 'FAIL cart.spec.ts > adds an item (older)' },
    { label: 'run 7002', url: RUN(7002), excerpt: 'FAIL cart.spec.ts > adds an item (latest)' },
  ],
};
const SLOW = {
  ref: 'F2',
  id: 'slow-slice:s3',
  kind: 'slow-slice',
  source: 'timeline',
  title: 'Slice s3 took far longer than the others',
  happened: 'Slice s3 took 120 minutes from its claim to its merge.',
  evidence: [{ label: '#15', url: 'https://github.com/acme/widgets/pull/15' }],
};

const REPLY = {
  summary: 'The widgets shipped, but one check kept failing and one slice dragged on.',
  findings: {
    'repeated-red:e2e': {
      title: 'The end-to-end check kept failing',
      whyItMatters: 'Each red run held a slice back.',
      lesson: 'Keep the end-to-end check green between waves.',
      keep: true,
      why: 'No earlier lesson says to hold the end-to-end check green between waves.',
    },
  },
  lessons: [{ text: 'Keep the end-to-end check green between waves.', findings: ['repeated-red:e2e'] }],
  verdict: { worthIt: true, reason: 'One lesson about the end-to-end check is new.' },
};

/** A knowledge summary as the kit's `knowledgeSummary` builds it, and the lessons of earlier retros. */
const KNOWLEDGE = {
  places: { adr: true, knowledge: true },
  domains: [{ name: 'cart', firstLine: 'The cart.' }],
  principles: [{ id: 'PR-PRODUCT-1', place: 'product', statement: 'A widget keeps what it was given.' }],
  decisions: [{ number: 3, title: 'Widgets store their colour on the server' }],
  laws: [{ id: 'BR-CART-2', kind: 'rule', place: 'cart', statement: 'A cart never holds a widget twice.' }],
};
const EARLIER = ['Split a slice that grows past its plan.'];

/** OpenRouter's streamed reply: a keep-alive comment, the content in pieces, split mid-line, then [DONE]. */
function streamed(content, { error = null } = {}) {
  const pieces = [content.slice(0, 10), content.slice(10, 25), content.slice(25)];
  const events = [
    ': OPENROUTER PROCESSING\n\n',
    ...pieces.map((piece) => `data: ${JSON.stringify({ model: DEFAULT_MODEL, choices: [{ delta: { content: piece } }] })}\n\n`),
    ...(error ? [`data: ${JSON.stringify({ error, choices: [{ delta: { content: '' }, finish_reason: 'error' }] })}\n\n`] : []),
    'data: [DONE]\n\n',
  ];
  const text = events.join('');
  const chunks = [text.slice(0, 37), text.slice(37, 90), text.slice(90)];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const failed = (status) => new Response(JSON.stringify({ error: { code: status, message: 'no' } }), { status });

/** A stubbed fetch answering each call with the next response (the last one repeats). */
function stubFetch(...answers) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const answer = answers[Math.min(calls.length, answers.length) - 1];
    if (answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer(init) : answer.clone();
  });
  return Object.assign(fn, { calls });
}

const noSleep = vi.fn(async () => {});
const ask = (fetch, over = {}) => narrate({ sheet: sheetOf(), prd: PRD, env: KEY, fetch, sleep: noSleep, ...over });

describe('narrate — no key', () => {
  it('asks no model without OPENROUTER_API_KEY, and says so', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    expect(await narrate({ sheet: sheetOf(), prd: PRD, env: {}, fetch })).toEqual({ model: null, reply: null, reason: NO_MODEL_KEY });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('narrate — one call to OpenRouter', () => {
  it('streams one request to OpenRouter with Claude Opus 5.5, and returns the reply', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    const out = await ask(fetch);
    expect(out).toEqual({ model: DEFAULT_MODEL, reply: REPLY, reason: null });
    expect(DEFAULT_MODEL).toBe('anthropic/claude-opus-5.5');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [{ url, init, body }] = fetch.calls;
    expect(url).toBe(OPENROUTER_URL);
    expect(OPENROUTER_URL).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe(`Bearer ${KEY.OPENROUTER_API_KEY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body).toMatchObject({ model: DEFAULT_MODEL, stream: true });
    expect(body.messages.map((message) => message.role)).toEqual(['system', 'user']);
  });

  it('asks the model OPENROUTER_MODEL names instead', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    const out = await ask(fetch, { env: { ...KEY, OPENROUTER_MODEL: 'anthropic/claude-sonnet-5' } });
    expect(out.model).toBe('anthropic/claude-sonnet-5');
    expect(fetch.calls[0].body.model).toBe('anthropic/claude-sonnet-5');
  });

  it('reads a reply fenced as a code block, and a reply that was not streamed', async () => {
    const fenced = await ask(stubFetch(streamed(`\`\`\`json\n${JSON.stringify(REPLY)}\n\`\`\``)));
    expect(fenced.reply).toEqual(REPLY);
    const plain = new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(REPLY) } }] }), {
      headers: { 'content-type': 'application/json' },
    });
    expect((await ask(stubFetch(plain))).reply).toEqual(REPLY);
  });

  it('keeps only the fields of the reply’s shape', async () => {
    const extra = { ...REPLY, mood: 'fine', findings: { 'repeated-red:e2e': { ...REPLY.findings['repeated-red:e2e'], score: 'high' } } };
    expect((await ask(stubFetch(streamed(JSON.stringify(extra))))).reply).toEqual(REPLY);
  });
});

describe('narrate — the model unavailable', () => {
  it('tries a 500 again, and after its retries goes out facts only: "model unavailable (500)"', async () => {
    const sleep = vi.fn(async () => {});
    const fetch = stubFetch(failed(500));
    const out = await ask(fetch, { sleep });
    expect(out).toEqual({ model: DEFAULT_MODEL, reply: null, reason: 'model unavailable (500)' });
    expect(fetch).toHaveBeenCalledTimes(MODEL_CALL.attempts);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(MODEL_CALL.backoffMs.slice(0, MODEL_CALL.attempts - 1));
  });

  it('takes the reply of a retry that succeeds', async () => {
    const fetch = stubFetch(failed(503), failed(429), streamed(JSON.stringify(REPLY)));
    expect(await ask(fetch)).toEqual({ model: DEFAULT_MODEL, reply: REPLY, reason: null });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('does not try a refused key again', async () => {
    const fetch = stubFetch(failed(401));
    expect((await ask(fetch)).reason).toBe('model unavailable (401)');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('names a network error, and an error OpenRouter sends inside the stream', async () => {
    expect((await ask(stubFetch(new TypeError('fetch failed')))).reason).toBe('model unavailable (network error)');
    const midStream = stubFetch(streamed('{"summary": "The wid', { error: { code: 502, message: 'provider down' } }));
    expect((await ask(midStream)).reason).toBe('model unavailable (502)');
    expect(midStream).toHaveBeenCalledTimes(MODEL_CALL.attempts);
  });

  it('gives up when the call outlasts its time budget', async () => {
    const hang = (init) =>
      new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    const out = await ask(stubFetch(hang), { call: { ...MODEL_CALL, budgetMs: 20 } });
    expect(out).toEqual({ model: DEFAULT_MODEL, reply: null, reason: 'model unavailable (timeout)' });
  });
});

describe('narrate — a reply that fails its schema', () => {
  it('is repaired once: the second request shows the model its reply and what is wrong with it', async () => {
    const broken = JSON.stringify({ summary: 7, findings: {}, lessons: [], verdict: { worthIt: false, reason: 'Nothing new.' } });
    const fetch = stubFetch(streamed(broken), streamed(JSON.stringify(REPLY)));
    expect(await ask(fetch)).toEqual({ model: DEFAULT_MODEL, reply: REPLY, reason: null });
    expect(fetch).toHaveBeenCalledTimes(2);
    const repair = fetch.calls[1].body.messages;
    expect(repair.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(repair[2].content).toBe(broken);
    expect(repair[3].content).toContain('summary must be a string');
  });

  it('is dropped after one repair: the retro goes out facts only', async () => {
    const fetch = stubFetch(streamed('not json at all'), streamed('{"summary": "still no lessons", "findings": {}}'));
    expect(await ask(fetch)).toEqual({ model: DEFAULT_MODEL, reply: null, reason: REPLY_INVALID });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('names what is wrong with a reply', () => {
    expect(checkReply(REPLY).errors).toEqual([]);
    expect(checkReply([]).errors).toEqual(['the reply must be a JSON object']);
    expect(
      checkReply({ summary: 'ok', findings: { a: 'no', b: { title: 3 } }, lessons: [{ text: 'x' }, 'y'] }).errors,
    ).toEqual([
      'findings["a"] must be an object',
      'findings["b"].title must be a string',
      'lessons[0].findings must be a list of finding ids',
      'lessons[1] must be an object',
      'verdict must be an object: { worthIt, reason }',
    ]);
  });
});

describe('narrate — the verdict and what each finding keeps', () => {
  it('accepts a verdict and a keep and why per finding, and keeps their types', () => {
    const { errors, reply } = checkReply(REPLY);
    expect(errors).toEqual([]);
    expect(reply.verdict).toEqual(REPLY.verdict);
    expect(reply.findings['repeated-red:e2e']).toMatchObject({ keep: true, why: REPLY.findings['repeated-red:e2e'].why });
  });

  it('accepts a finding without keep or why: it is not kept', () => {
    const reply = { ...REPLY, findings: { 'slow-slice:s3': { title: 'One slice dragged on' } } };
    expect(checkReply(reply)).toEqual({ errors: [], reply });
  });

  it('rejects a reply without a verdict', () => {
    const { verdict, ...rest } = REPLY;
    expect(checkReply(rest)).toEqual({ errors: ['verdict must be an object: { worthIt, reason }'], reply: null });
  });

  it('rejects a verdict, a keep or a why of the wrong type', () => {
    const wrong = {
      ...REPLY,
      verdict: { worthIt: 'yes', reason: 4 },
      findings: { 'repeated-red:e2e': { title: 'Red', keep: 'true', why: ['new'] } },
    };
    expect(checkReply(wrong).errors).toEqual([
      'findings["repeated-red:e2e"].keep must be true or false',
      'findings["repeated-red:e2e"].why must be a string',
      'verdict.worthIt must be true or false',
      'verdict.reason must be a string',
    ]);
    expect(checkReply({ ...REPLY, verdict: [] }).errors).toEqual(['verdict must be an object: { worthIt, reason }']);
  });

  it('repairs a reply with no verdict once, like any other broken reply', async () => {
    const { verdict, ...rest } = REPLY;
    const fetch = stubFetch(streamed(JSON.stringify(rest)), streamed(JSON.stringify(REPLY)));
    expect(await ask(fetch)).toEqual({ model: DEFAULT_MODEL, reply: REPLY, reason: null });
    expect(fetch.calls[1].body.messages[3].content).toContain('verdict must be an object');
  });
});

describe('narrate — the judge', () => {
  it('has a version of its own, apart from the rules', () => {
    expect(JUDGE_VERSION).toBe(1);
  });

  it('gives the knowledge summary, one line per entry, and the lessons of earlier retros', () => {
    const input = JSON.parse(modelInput({ sheet: sheetOf(), prd: PRD, knowledge: KNOWLEDGE, lessons: EARLIER }).user);
    expect(input.knowledge).toEqual([
      { id: 'PR-PRODUCT-1', line: 'A widget keeps what it was given.' },
      { id: 'BR-CART-2', line: 'A cart never holds a widget twice.' },
      { id: 'ADR-0003', line: 'Widgets store their colour on the server' },
    ]);
    expect(input.earlierLessons).toEqual(EARLIER);
  });

  it('gives an empty knowledge summary and no earlier lessons when it has none', () => {
    const input = JSON.parse(modelInput({ sheet: sheetOf(), prd: PRD }).user);
    expect(input.knowledge).toEqual([]);
    expect(input.earlierLessons).toEqual([]);
  });

  it('quotes the look rule word for word, and asks for new lessons about behaviour only', () => {
    const { system } = modelInput({ sheet: sheetOf(), prd: PRD, knowledge: KNOWLEDGE, lessons: EARLIER });
    expect(system).toContain(LOOK_RULE);
    for (const word of ['"verdict"', '"worthIt"', '"reason"', '"keep"', '"why"', 'new', 'behaviour']) expect(system).toContain(word);
  });

  it('masks the knowledge and the earlier lessons too', () => {
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const { user } = modelInput({
      sheet: sheetOf(),
      prd: PRD,
      knowledge: { ...KNOWLEDGE, laws: [{ id: 'BR-CART-3', statement: `never log ${token}` }] },
      lessons: [`rotate ${token}`],
    });
    expect(user).not.toContain(token);
  });

  it('cuts the earlier lessons, then the knowledge, before any finding', () => {
    const cap = LIMITS.modelInputTokens * CHARS_PER_TOKEN;
    const many = Array.from({ length: 400 }, (_, i) => `LESSON-${i} ${'x'.repeat(cap / 400)}`);
    const laws = Array.from({ length: 400 }, (_, i) => ({ id: `BR-CART-${i}`, statement: `LAW-${i} ${'y'.repeat(cap / 400)}` }));
    const out = modelInput({ sheet: sheetOf(), prd: PRD, knowledge: { ...KNOWLEDGE, laws }, lessons: many });
    expect(out.system.length + out.user.length).toBeLessThanOrEqual(cap);
    const input = JSON.parse(out.user);
    expect(input.findings.map((finding) => finding.id)).toEqual([RED.id, SLOW.id]);
    expect(input.earlierLessons).toEqual([]);
    expect(input.knowledge.length).toBeGreaterThan(0);
  });

  it('sends the knowledge and the earlier lessons narrate is given', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    await ask(fetch, { knowledge: KNOWLEDGE, lessons: EARLIER });
    const sent = JSON.parse(fetch.calls[0].body.messages[1].content);
    expect(sent.earlierLessons).toEqual(EARLIER);
    expect(sent.knowledge).toHaveLength(3);
  });
});

describe('narrate — what the model is given', () => {
  it('gives the PRD’s title and problem, and per finding its id, its facts and its evidence', () => {
    const { user } = modelInput({ sheet: sheetOf(), prd: PRD });
    const input = JSON.parse(user);
    expect(input.prd).toEqual(PRD);
    expect(input.findings).toEqual([
      { id: RED.id, kind: RED.kind, title: RED.title, happened: RED.happened, evidence: RED.evidence },
      { id: SLOW.id, kind: SLOW.kind, title: SLOW.title, happened: SLOW.happened, evidence: SLOW.evidence },
    ]);
  });

  it('masks every token-shaped string before anything is sent', async () => {
    const secrets = [
      'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'ghs_ABCDEFGHIJKLMNOPQRSTUVWX0123456789ab',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz',
      'sk-or-v1-0123456789abcdef0123456789abcdef',
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      'AKIAIOSFODNN7EXAMPLE',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ];
    const leaky = {
      ...RED,
      evidence: [{ label: 'run 7001', url: RUN(7001), excerpt: `curl -H "Authorization: Bearer abc.def-ghi" ${secrets.join(' ')}` }],
    };
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    await narrate({ sheet: sheetOf([leaky]), prd: { ...PRD, problem: `token ${secrets[0]}` }, env: KEY, fetch, sleep: noSleep });
    const sent = fetch.calls[0].init.body;
    for (const secret of [...secrets, 'abc.def-ghi']) expect(sent).not.toContain(secret);
    expect(sent).toContain('Bearer [masked]');
    expect(maskSecrets('a task-list and sk-short stay')).toBe('a task-list and sk-short stay');
  });

  it('caps the input: older logs go first, and the latest failure of each check stays', () => {
    const cap = LIMITS.modelInputTokens * CHARS_PER_TOKEN;
    const log = (tag, size) => `${tag}\n${'x'.repeat(size)}`;
    const big = {
      ...RED,
      evidence: [1, 2, 3, 4].map((n) => ({ label: `run ${n}`, url: RUN(n), excerpt: log(`LOG-${n}`, cap / 4) })),
    };
    const churn = {
      ref: 'F3',
      id: 'churn:src/cart.ts:1-40',
      kind: 'churn',
      source: 'churn',
      title: 'One range was rewritten again and again',
      happened: 'Lines of src/cart.ts were rewritten in 3 commits.',
      evidence: [{ label: 'commit abc', url: 'https://github.com/acme/widgets/commit/abc', excerpt: log('HUNK', cap / 10) }],
    };
    const size = ({ system, user }) => system.length + user.length;

    const mild = modelInput({ sheet: sheetOf([big, churn]), prd: PRD });
    expect(size(mild)).toBeLessThanOrEqual(cap);
    expect(mild.user).not.toContain('LOG-1');
    expect(mild.user).toContain('LOG-4');
    expect(mild.user).toContain('HUNK');

    const huge = { ...churn, evidence: [{ ...churn.evidence[0], excerpt: log('HUNK', (cap * 9) / 10) }] };
    const tight = modelInput({ sheet: sheetOf([big, huge]), prd: PRD });
    expect(size(tight)).toBeLessThanOrEqual(cap);
    for (const cut of ['LOG-1', 'LOG-2', 'LOG-3', 'HUNK']) expect(tight.user).not.toContain(cut);
    expect(tight.user).toContain('LOG-4');

    const one = { ...RED, evidence: [{ label: 'run 9', url: RUN(9), excerpt: `${log('HEAD', cap * 2)}\nLAST LINE` }] };
    const trimmed = modelInput({ sheet: sheetOf([one]), prd: PRD });
    expect(size(trimmed)).toBeLessThanOrEqual(cap);
    expect(trimmed.user).toContain('LAST LINE');
    expect(trimmed.user).not.toContain('HEAD');
  });

  it('sends the capped input as it is', async () => {
    const fetch = stubFetch(streamed(JSON.stringify(REPLY)));
    await ask(fetch);
    const { system, user } = modelInput({ sheet: sheetOf(), prd: PRD });
    expect(fetch.calls[0].body.messages).toEqual([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
  });
});

describe('the function’s time limit', () => {
  it('gives api/inngest.mjs a maxDuration above a minute, with room for the model’s whole budget', () => {
    const vercel = JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8'));
    const seconds = vercel.functions['api/inngest.mjs'].maxDuration;
    expect(seconds).toBeGreaterThan(60);
    expect(MODEL_CALL.budgetMs).toBeLessThan(seconds * 1000);
  });

  it('names every function under api/, so none falls back to the platform’s default', () => {
    const app = new URL('../../', import.meta.url);
    const vercel = JSON.parse(readFileSync(fileURLToPath(new URL('vercel.json', app)), 'utf8'));
    const files = readdirSync(fileURLToPath(new URL('api/', app))).filter((name) => name.endsWith('.mjs') && !name.includes('.test.'));
    expect(Object.keys(vercel.functions).sort()).toEqual(files.map((name) => `api/${name}`).sort());
    expect(vercel.functions['api/github.mjs'].maxDuration).toBe(60);
  });
});

describe('narrate and guard in the retro function', () => {
  const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
  const BRANCH = 'docs/retro-widget';

  /** Runs the real function against the stubbed GitHub, with `fetch` stubbed; the pauses between tries skipped. */
  async function runRetro(fetch) {
    const scenario = widgetScenario();
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env: KEY });
    vi.stubGlobal('fetch', fetch);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let settled = false;
      const run = new InngestTestEngine({ function: fn, events: [scenario.event] }).execute().finally(() => {
        settled = true;
      });
      while (!settled) await vi.advanceTimersByTimeAsync(1000);
      const { error } = await run;
      expect(error).toBeUndefined();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
    const files = scenario.github.filesAt(BRANCH, [`${FOLDER}/retro.md`, `${FOLDER}/retro.json`]);
    return { scenario, md: files[`${FOLDER}/retro.md`], json: JSON.parse(files[`${FOLDER}/retro.json`]) };
  }

  it('a stubbed 500 after the retries: the retro still goes out, "Facts only: model unavailable (500)"', async () => {
    const fetch = stubFetch(failed(500));
    const { scenario, md, json } = await runRetro(fetch);
    expect(fetch).toHaveBeenCalledTimes(MODEL_CALL.attempts);
    expect(md).toContain('\nFacts only: model unavailable (500)\n');
    expect(md).toContain(`model: ${DEFAULT_MODEL}`);
    expect(json.runs[0].narration).toEqual({ model: DEFAULT_MODEL, reason: 'model unavailable (500)', dropped: [] });
    expect(scenario.github.state.comments).toEqual([]);
  });

  it('a stubbed reply: each field kept or dropped on its own, and the drop recorded in retro.json', async () => {
    const reply = {
      summary: 'The widgets shipped in the waves planned, but one slice ran far past the others.',
      findings: {
        'slow-slice:s3': {
          title: 'One slice ran far past the others',
          whyItMatters: 'It took 120 minutes, which held the whole feature back.',
          lesson: 'Split a slice that grows past its plan.',
        },
      },
      lessons: [{ text: 'Split a slice that grows past its plan.', findings: ['slow-slice:s3'] }],
      verdict: { worthIt: false, reason: 'Splitting a long slice is an earlier lesson.' },
    };
    const { md, json } = await runRetro(stubFetch(streamed(JSON.stringify(reply))));
    expect(md).toContain(`\n${reply.summary}\n`);
    expect(md).toContain('### F1 · One slice ran far past the others — `slow-slice:s3`');
    expect(md).toContain('- **Why it matters:** _Dropped: it holds a digit._');
    expect(md).toContain('- **Proposed lesson:** Split a slice that grows past its plan.');
    expect(md).toContain('- Split a slice that grows past its plan. (F1)');
    expect(json.runs[0].narration).toEqual({
      model: DEFAULT_MODEL,
      reason: null,
      dropped: [{ field: 'findings.slow-slice:s3.whyItMatters', reason: 'it holds a digit' }],
    });
  });
});
