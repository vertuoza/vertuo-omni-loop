// The little of GitHub Actions' expression language the gates of the acceptance workflows use (PRD
// 2898, s5): `checks` and `preview-debounce` decide from the event whether a draft labelled
// `omni:ready-check` runs its full checks, and their tests read those very `if:` and `concurrency`
// lines with this, event by event, instead of comparing strings. Nothing here runs a workflow.
//
// What it reads: a context path (`github.event.pull_request.draft`, `needs.settle.outputs.stale`), an
// object filter (`labels.*.name`), a quoted string (`''` for a quote), a number, `true`, `false`,
// `null`, `!`, `==`, `!=`, `&&` and `||` (which return an operand, as GitHub's do), parentheses, and the
// functions `contains`, `startsWith`, `endsWith`, `always`, `success`, `failure` and `cancelled`.
// Strings compare ignoring case, and values of two types compare as numbers, as GitHub's do.

/** What a workflow run sees: its contexts, and how its earlier jobs went for the status functions. */
export type ExpressionContext = Record<string, unknown> & { status?: 'success' | 'failure' | 'cancelled' };

type Token = { kind: 'string' | 'number' | 'word' | 'op'; text: string };

const TOKEN = /\s*(?:'((?:[^']|'')*)'|(\d+(?:\.\d+)?)|([A-Za-z_][\w-]*(?:\.(?:\*|[A-Za-z_][\w-]*))*)|(==|!=|&&|\|\||[!(),]))/y;

function tokens(text: string): Token[] {
  const out: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.trimEnd().length) {
    const at = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (!match) throw new Error(`cannot read the expression at ${String(at)}: ${text.slice(at)}`);
    const [, string, number, word, op] = match;
    if (string !== undefined) out.push({ kind: 'string', text: string.replaceAll("''", "'") });
    else if (number !== undefined) out.push({ kind: 'number', text: number });
    else if (word !== undefined) out.push({ kind: 'word', text: word });
    else out.push({ kind: 'op', text: op ?? '' });
  }
  return out;
}

/** GitHub's truthiness: `false`, `0`, `''` and `null` are false. */
const truthy = (value: unknown): boolean => !(value === false || value === 0 || value === '' || value === null || value === undefined);

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim() === '' ? 0 : Number(value);
  return Number.NaN;
}

/** GitHub's loose equality: strings ignoring case, other types as numbers. */
function equal(left: unknown, right: unknown): boolean {
  if (typeof left === 'string' && typeof right === 'string') return left.toLowerCase() === right.toLowerCase();
  if ((left ?? null) === null && (right ?? null) === null) return true;
  if (typeof left === typeof right && typeof left !== 'object') return left === right;
  return asNumber(left) === asNumber(right);
}

/** The value of a context path; `*` filters an array (or an object's values) down to one property. */
function lookup(path: string, context: ExpressionContext): unknown {
  let values: unknown[] = [context];
  let filtered = false;
  for (const part of path.split('.')) {
    if (part === '*') {
      values = values.flatMap((value): unknown[] => (Array.isArray(value) ? (value as unknown[]) : value !== null && typeof value === 'object' ? Object.values(value) : []));
      filtered = true;
      continue;
    }
    values = values.map((value) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined));
  }
  return filtered ? values.filter((value) => value !== undefined) : (values[0] ?? null);
}

/** A value as GitHub's string functions read it, ignoring case. */
const lower = (value: unknown): string => (typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value)).toLowerCase();

type Status = NonNullable<ExpressionContext['status']>;

/** The functions an expression may call, each from its arguments and how the earlier jobs went. */
const FUNCTIONS: Readonly<Record<string, (args: readonly unknown[], status: Status) => unknown>> = {
  contains: ([search, item]) => (Array.isArray(search) ? search.some((element) => equal(element, item)) : lower(search).includes(lower(item))),
  startsWith: ([text, prefix]) => lower(text).startsWith(lower(prefix)),
  endsWith: ([text, suffix]) => lower(text).endsWith(lower(suffix)),
  always: () => true,
  success: (_, status) => status === 'success',
  failure: (_, status) => status === 'failure',
  cancelled: (_, status) => status === 'cancelled',
};

function call(name: string, args: readonly unknown[], context: ExpressionContext): unknown {
  const fn = FUNCTIONS[name];
  if (fn === undefined) throw new Error(`the expression calls ${name}(), which this reader does not know`);
  return fn(args, context.status ?? 'success');
}

/** The words that are values, not context paths. */
const KEYWORDS: ReadonlyMap<string, boolean | null> = new Map([
  ['true', true],
  ['false', false],
  ['null', null],
]);

/** A recursive-descent reader over the tokens: `||` binds loosest, then `&&`, then `==` and `!=`, then `!`. */
function reader(list: readonly Token[], context: ExpressionContext) {
  let at = 0;
  const peek = () => list[at];
  const take = (text: string): boolean => {
    if (peek()?.kind === 'op' && peek()?.text === text) {
      at += 1;
      return true;
    }
    return false;
  };
  const expect = (text: string) => {
    if (!take(text)) throw new Error(`expected ${text} at token ${String(at)}`);
  };

  const args = (): unknown[] => {
    const list: unknown[] = [];
    if (take(')')) return list;
    do list.push(or());
    while (take(','));
    expect(')');
    return list;
  };
  const word = (text: string): unknown => {
    if (KEYWORDS.has(text)) return KEYWORDS.get(text);
    return take('(') ? call(text, args(), context) : lookup(text, context);
  };
  const primary = (): unknown => {
    const token = list[at];
    if (token === undefined) throw new Error('the expression ends too soon');
    at += 1;
    if (token.kind === 'string') return token.text;
    if (token.kind === 'number') return Number(token.text);
    if (token.kind === 'word') return word(token.text);
    if (token.text !== '(') throw new Error(`unexpected ${token.text} at token ${String(at - 1)}`);
    const value = or();
    expect(')');
    return value;
  };
  const not = (): unknown => (take('!') ? !truthy(not()) : primary());
  const comparison = (): unknown => {
    let left = not();
    for (;;) {
      if (take('==')) left = equal(left, not());
      else if (take('!=')) left = !equal(left, not());
      else return left;
    }
  };
  const and = (): unknown => {
    let left = comparison();
    while (take('&&')) {
      const right = comparison();
      left = truthy(left) ? right : left;
    }
    return left;
  };
  const or = (): unknown => {
    let left = and();
    while (take('||')) {
      const right = and();
      left = truthy(left) ? left : right;
    }
    return left;
  };
  return {
    read(): unknown {
      const value = or();
      if (at !== list.length) throw new Error(`unexpected ${list[at]?.text ?? ''} at token ${String(at)}`);
      return value;
    },
  };
}

/** The value of one expression, written bare or inside `${{ … }}`. */
function evaluate(expression: string, context: ExpressionContext): unknown {
  const bare = /^\s*\$\{\{([\s\S]*)\}\}\s*$/.exec(expression)?.[1] ?? expression;
  return reader(tokens(bare), context).read();
}

/** Whether an `if:` passes: GitHub reads a bare `if:` as an expression, and a job with no `if:` runs. */
function passes(condition: string | undefined, context: ExpressionContext): boolean {
  return condition === undefined ? true : truthy(evaluate(condition, context));
}

/** A job of a workflow, as far as which jobs run is concerned. */
export type WorkflowJob = { needs?: string | string[]; if?: string };

/** Whether a condition calls a status function, which lets a job run after a need that did not succeed. */
const STATUS_CALL = /\b(?:always|failure|cancelled|success)\s*\(/;

/** How one job ends, from how its needs ended: skipped unless they all succeeded or its `if:` asks for a status. */
function runOf(
  job: WorkflowJob,
  needs: ReadonlyMap<string, 'success' | 'skipped'>,
  context: ExpressionContext,
  outputs: Readonly<Record<string, Record<string, string>>>,
): 'success' | 'skipped' {
  const succeeded = [...needs.values()].every((ended) => ended === 'success');
  const needsContext = Object.fromEntries([...needs].map(([need, ended]) => [need, { result: ended, outputs: ended === 'success' ? (outputs[need] ?? {}) : {} }]));
  const gated = job.if !== undefined && STATUS_CALL.test(job.if);
  const scope: ExpressionContext = { ...context, needs: needsContext, status: succeeded ? 'success' : 'failure' };
  return (succeeded || gated) && passes(job.if, scope) ? 'success' : 'skipped';
}

/**
 * Which jobs of a workflow run for one event, in GitHub's order: a job waits for its `needs`; with no
 * status function in its `if:`, it is skipped unless every need succeeded (GitHub's implicit
 * `success()`). A job that runs is taken to succeed, with the outputs `outputs` gives it.
 */
export function jobsThatRun(
  jobs: Readonly<Record<string, WorkflowJob>>,
  context: ExpressionContext,
  outputs: Readonly<Record<string, Record<string, string>>> = {},
): string[] {
  const result = new Map<string, 'success' | 'skipped'>();
  const settle = (id: string, seen: readonly string[]): 'success' | 'skipped' => {
    const known = result.get(id);
    if (known !== undefined) return known;
    const job = jobs[id];
    if (job === undefined || seen.includes(id)) throw new Error(`the workflow has no job ${id}, or its needs loop`);
    const needs = new Map((job.needs === undefined ? [] : [job.needs].flat()).map((need) => [need, settle(need, [...seen, id])]));
    const ended = runOf(job, needs, context, outputs);
    result.set(id, ended);
    return ended;
  };
  return Object.keys(jobs).filter((id) => settle(id, []) === 'success');
}

/** A string with every `${{ … }}` in it filled, as a `concurrency.group` is. */
export function interpolate(template: string, context: ExpressionContext): string {
  return template.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression: string) => {
    const value = evaluate(expression, context);
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value);
  });
}
