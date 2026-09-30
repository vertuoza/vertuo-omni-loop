// A round's category (PRD 144's spec, "Six categories"): one of six, picked by a model after the
// round is created. One call to OpenRouter with the questions, their options and the context, and a
// reply held to the six values: any other reply, an error or a timeout gives null (shown as
// **unsorted**), and nothing retries. Without OPENROUTER_API_KEY there is no classifier at all, and
// rounds stay unsorted. Any member may set or change a category on the page, so a wrong guess costs
// a click. Pure apart from the one fetch, which a test stubs.

/** The six values, in the spec's order. Stored as they are; the page shows CATEGORY_LABELS. */
export const CATEGORIES = ['business', 'product', 'ux-ui', 'architecture', 'harness', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = Object.freeze({
  business: 'Business',
  product: 'Product',
  'ux-ui': 'UX/UI',
  architecture: 'Architecture',
  harness: 'Harness',
  other: 'Other',
});

/** What each category holds, as the model is told (and Jev, PRD 812). */
export const HOLDS: Readonly<Record<Category, string>> = {
  business: 'pricing, priorities, customers, contracts, anything a business owner decides',
  product: 'scope, features, behaviour, what the product does',
  'ux-ui': 'screens, copy, flows, look',
  architecture: 'design, data, interfaces, dependencies',
  harness: 'Omni Loop itself, CI, tooling, process',
  other: 'the rest',
};

export const isCategory = (value: unknown): value is Category => (CATEGORIES as readonly unknown[]).includes(value);

/** The model's reply as one of the six, or null: case, spaces, quotes and a final full stop aside,
 * it must be a value exactly. */
export function readCategory(reply: unknown): Category | null {
  if (typeof reply !== 'string') return null;
  const value = reply.trim().toLowerCase().replace(/\.$/, '').replace(/^["'`]+|["'`]+$/g, '').trim();
  return isCategory(value) ? value : null;
}

/** What the classifier reads: the round's questions as AskUserQuestion took them, and its context. */
export type ClassifyInput = {
  questions: unknown[];
  context: { repo?: string | null; branch?: string | null; prd?: number | null; skill?: string | null };
};

export type Classifier = (input: ClassifyInput) => Promise<Category | null>;

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** A small, cheap model: sorting a question into six takes little. */
export const CLASSIFIER_MODEL = 'anthropic/claude-haiku-4.5';
/** How long the call may take before the round stays unsorted. */
export const CLASSIFY_TIMEOUT_MS = 15_000;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The questions and their options as plain lines; never an option's preview. What Haiku reads, and
 * the state Jev is given for the question category (PRD 812). */
export function describeRound(input: ClassifyInput): string {
  const lines: string[] = [];
  for (const q of input.questions.map(record)) {
    const header = str(q.header);
    lines.push(`Question${header ? ` (${header})` : ''}: ${str(q.question)}`);
    for (const option of (Array.isArray(q.options) ? q.options : []).map(record)) {
      const description = str(option.description);
      lines.push(`- ${str(option.label)}${description ? `: ${description}` : ''}`);
    }
  }
  const { repo, branch, prd, skill } = input.context;
  const where = [repo && `repository ${repo}`, branch && `branch ${branch}`, prd && `PRD ${prd}`, skill && `asked by ${skill}`].filter(Boolean);
  if (where.length) lines.push(`Context: ${where.join(', ')}.`);
  return lines.join('\n');
}

const SYSTEM = [
  'You sort one question a coding agent asked a person into exactly one category.',
  'The categories:',
  ...CATEGORIES.map((c) => `- ${c}: ${HOLDS[c]}`),
  `Reply with the category's value alone, one of: ${CATEGORIES.join(', ')}. No other word.`,
].join('\n');

type Options = { apiKey: string; fetch?: typeof globalThis.fetch; model?: string; timeoutMs?: number };

/** The classifier through OpenRouter: one call, no retry, null on anything but one of the six. */
export function openRouterClassifier({ apiKey, fetch = globalThis.fetch, model = CLASSIFIER_MODEL, timeoutMs = CLASSIFY_TIMEOUT_MS }: Options): Classifier {
  return async (input) => {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 8,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: describeRound(input) },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      const body = record(await response.json());
      const choice = record(Array.isArray(body.choices) ? body.choices[0] : null);
      return readCategory(record(choice.message).content);
    } catch {
      return null;
    }
  };
}

/** The classifier when OPENROUTER_API_KEY is set, and null otherwise: rounds then stay unsorted. */
export function classifierFromEnv(env: Record<string, string | undefined>): Classifier | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  return apiKey ? openRouterClassifier({ apiKey }) : null;
}
