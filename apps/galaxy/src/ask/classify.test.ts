import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CATEGORIES, classifierFromEnv, isCategory, openRouterClassifier, readCategory, type ClassifyInput } from './classify';
import { readEnv } from '../env';
import { item } from './test/test-item';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The classifier (PRD 144's spec, "Six categories"): one call to OpenRouter, stubbed here, and a reply
// held to the six values. Anything else, an error or a timeout gives null, and nothing retries.

const INPUT: ClassifyInput = {
  questions: [
    {
      question: 'What should a seat cost for a team of ten?',
      header: 'Pricing',
      multiSelect: false,
      options: [{ label: '€12 a seat (Recommended)', description: 'Like today.' }, { label: '€9 a seat', description: 'A volume discount.' }],
    },
  ],
  context: { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/question-history', prd: parsePrd(144), skill: '/omni:brainstorm' },
};

type Sent = { url: string; init: RequestInit };

/** The text a call sent as its body; fails the test for any other body. */
function bodyText(sent: Sent): string {
  const { body } = sent.init;
  if (typeof body !== 'string') throw new Error('the request body was not text');
  return body;
}

// The chat completion request, as the test reads it.
const CompletionRequest = z.looseObject({ model: z.unknown(), messages: z.array(z.looseObject({ content: z.string() })) });

/** A stubbed fetch answering OpenRouter's chat completion with `content`, recording what it sent. */
function stub(answer: (sent: Sent) => Promise<Response> | Response) {
  const calls: Sent[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const sent = { url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, init: init ?? {} };
    calls.push(sent);
    return answer(sent);
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const completion = (content: unknown) => Response.json({ choices: [{ message: { role: 'assistant', content } }] });

describe('the six categories', () => {
  it('are the spec\'s values, in its order', () => {
    expect(CATEGORIES).toEqual(['business', 'product', 'ux-ui', 'architecture', 'harness', 'other']);
  });

  it('knows its own values and nothing else', () => {
    expect(isCategory('ux-ui')).toBe(true);
    expect(isCategory('UX/UI')).toBe(false);
    expect(isCategory(null)).toBe(false);
  });
});

describe('reading the model\'s reply', () => {
  it.each([
    ['business', 'business'],
    ['  Product\n', 'product'],
    ['"ux-ui"', 'ux-ui'],
    ['`architecture`.', 'architecture'],
    ['HARNESS', 'harness'],
    ['other', 'other'],
  ])('maps %j to %s', (reply, category) => {
    expect(readCategory(reply)).toBe(category);
  });

  it.each([
    ['a value outside the six', 'design'],
    ['a label, not a value', 'UX/UI'],
    ['a sentence', 'This is a business question.'],
    ['two values', 'business, product'],
    ['nothing', ''],
    ['not text', 42],
    ['null', null],
  ])('gives null for %s', (_what, reply) => {
    expect(readCategory(reply)).toBeNull();
  });
});

describe('the OpenRouter classifier', () => {
  it('sends one chat completion with the key, the questions, their options and the context', async () => {
    const { calls, fetch } = stub(() => completion('business'));
    const classify = openRouterClassifier({ apiKey: 'sk-or-test', fetch });
    expect(await classify(INPUT)).toBe('business');
    expect(calls).toHaveLength(1);
    expect(item(calls, 0).url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(item(calls, 0).init.method).toBe('POST');
    expect(new Headers(item(calls, 0).init.headers).get('authorization')).toBe('Bearer sk-or-test');
    const body = CompletionRequest.parse(JSON.parse(bodyText(item(calls, 0))));
    expect(typeof body.model).toBe('string');
    const prompt = body.messages.map((m) => m.content).join('\n');
    for (const category of CATEGORIES) expect(prompt).toContain(category);
    expect(prompt).toContain('What should a seat cost for a team of ten?');
    expect(prompt).toContain('€9 a seat');
    expect(prompt).toContain('A volume discount.');
    expect(prompt).toContain('/omni:brainstorm');
    expect(prompt).toContain('PRD 144');
  });

  it('never sends an option\'s preview', async () => {
    const { calls, fetch } = stub(() => completion('architecture'));
    const withPreview = { ...INPUT, questions: [{ question: 'Which table?', options: [{ label: 'A', preview: 'create table secret_preview ();' }] }] };
    await openRouterClassifier({ apiKey: 'k', fetch })(withPreview);
    expect(bodyText(item(calls, 0))).not.toContain('secret_preview');
  });

  it('gives null for a reply outside the six', async () => {
    const { fetch } = stub(() => completion('design'));
    expect(await openRouterClassifier({ apiKey: 'k', fetch })(INPUT)).toBeNull();
  });

  it('gives null, and does not retry, when OpenRouter answers an error', async () => {
    const { calls, fetch } = stub(() => Response.json({ error: { message: 'rate limited' } }, { status: 429 }));
    expect(await openRouterClassifier({ apiKey: 'k', fetch })(INPUT)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('gives null, and does not retry, when the call throws', async () => {
    const { calls, fetch } = stub(() => { throw new TypeError('fetch failed'); });
    expect(await openRouterClassifier({ apiKey: 'k', fetch })(INPUT)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('gives null for a body that is not a completion', async () => {
    const { fetch } = stub(() => new Response('<html>busy</html>', { status: 200 }));
    expect(await openRouterClassifier({ apiKey: 'k', fetch })(INPUT)).toBeNull();
  });

  it('gives null when OpenRouter does not answer in time', async () => {
    const { calls, fetch } = stub(({ init }) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const reason: unknown = init.signal?.reason;
        reject(reason instanceof Error ? reason : new Error('aborted'));
      });
    }));
    expect(await openRouterClassifier({ apiKey: 'k', fetch, timeoutMs: 20 })(INPUT)).toBeNull();
    expect(calls).toHaveLength(1);
  });
});

describe('the classifier from the environment', () => {
  it('is there with OPENROUTER_API_KEY', () => {
    expect(classifierFromEnv(readEnv({ OPENROUTER_API_KEY: 'sk-or-test' }).openrouter)).toBeTypeOf('function');
  });

  it('is not there without it, so rounds stay unsorted', () => {
    expect(classifierFromEnv(readEnv({}).openrouter)).toBeNull();
    expect(classifierFromEnv(readEnv({ OPENROUTER_API_KEY: '  ' }).openrouter)).toBeNull();
  });
});
