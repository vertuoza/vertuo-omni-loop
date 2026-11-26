// The Supervisor seat's tools (PRD omni-loop-34 s4, spec "1. The seat"), as an MCP server over stdio that the seat's
// think starts (`omni supervisor mcp --runner <id> --page <url>`, ./supervisor-think.ts). Six tools, each one call of
// the Supervisor API with the runner's sign-in (./api.ts `supervisorApi`), so the model reads and writes its own
// workspace only (BR-PRODUCT-63) and acts on nothing else:
//
//   snapshot   the seat, the open signals and findings, the runners, the jobs of the last 6 h, the missions
//   lines      a job's lines after a sequence number, masked by the app
//   memory     reads the notes, or writes one (scope, line, cites)
//   raise      raises a finding, from signals (their check shown first) or alone, with up to two suggestions; a group
//              fingerprint holds signals of different fingerprints that share one cause (PRD omni-loop-35)
//   reply      answers in a thread, signed Supervisor · agent on the page
//   propose    gives a finding a check wrote alone its first look: the explanation and up to two suggestions
//
// One JSON-RPC message per line, by hand (no MCP library is bundled: L-LICENSE-2). A call the app refuses, or that
// cannot reach it, is a tool result of one line with `isError`, never a crash.
import { z } from 'zod';
import type { SupervisorApi } from './api.ts';

export const SEAT_TOOLS = ['snapshot', 'lines', 'memory', 'raise', 'reply', 'propose'] as const;
type ToolName = (typeof SEAT_TOOLS)[number];

const ACTIONS = ['stop-resume-job', 'open-terminal', 'open-bug-fix', 'pause-mission', 'resume-mission', 'wake-mission', 'open-mission', 'clean-worktrees', 'copy-kit-update'] as const;

const Suggestion = z.strictObject({ action: z.enum(ACTIONS), label: z.string().min(1).max(120), target: z.record(z.string(), z.unknown()) });
const Ids = (min: number, max: number) => z.array(z.string().min(1)).min(min).max(max);

const ARGS = {
  snapshot: z.object({}).loose(),
  lines: z.strictObject({ job: z.string().min(1), after: z.number().int().min(0).default(0) }),
  memory: z.union([
    z.strictObject({ scope: z.enum(['short', 'long']), line: z.string().min(1).max(300), cites: Ids(1, 10) }),
    z.strictObject({ scope: z.enum(['short', 'long']).optional() }),
  ]),
  raise: z.strictObject({
    kind: z.enum(['stuck', 'bug', 'health']), severity: z.enum(['high', 'medium']), title: z.string().min(1).max(200),
    signals: Ids(0, 10).optional(), fingerprint: z.string().min(3).max(200).optional(), evidence: z.array(z.unknown()).max(50).optional(),
    explanation: z.string().min(1).max(4000), suggestions: z.array(Suggestion).max(2).optional(),
  }),
  reply: z.strictObject({ finding: z.string().min(1).nullable().optional(), body: z.string().min(1).max(4000), replyTo: z.string().min(1).optional(), remembered: z.string().min(1).max(300).optional() }),
  propose: z.strictObject({ finding: z.string().min(1), explanation: z.string().min(1).max(4000), suggestions: z.array(Suggestion).min(1).max(2) }),
} satisfies Record<ToolName, z.ZodType>;

const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const SUGGESTIONS = { type: 'array', maxItems: 2, items: object({ action: { type: 'string', enum: ACTIONS }, label: { type: 'string', maxLength: 120 }, target: { type: 'object', description: 'What it acts on: {"job": id}, {"mission": id}, {"runner": id}.' } }, ['action', 'label', 'target']) };

/** The tools, as `tools/list` answers them. */
const TOOLS: { name: ToolName; description: string; inputSchema: object }[] = [
  { name: 'snapshot', description: 'The workspace now: the seat, the open signals and findings, the runners, the jobs of the last 6 h and the missions.', inputSchema: object({}) },
  { name: 'lines', description: 'A job\'s log lines after a sequence number (500 at most, masked).', inputSchema: object({ job: { type: 'string' }, after: { type: 'integer', minimum: 0 } }, ['job']) },
  {
    name: 'memory',
    description: 'With no line, reads your notes (of one scope, or both). With scope, line and cites, writes one: short-term expires after 24 h, long-term stays until an owner clears it. One line of 300 characters, citing 1 to 10 ids.',
    inputSchema: object({ scope: { type: 'string', enum: ['short', 'long'] }, line: { type: 'string', maxLength: 300 }, cites: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 } }),
  },
  {
    name: 'raise',
    description: 'Raises a finding. Name its signals: their check and figures are shown first. Signals that share one cause (one repository, one kind of wait, one failing route) go in one finding under a group fingerprint, which may name signals of different fingerprints; without it, the signals share one fingerprint. A second raise of an open group adds its new signals. With no signal, give it a fingerprint so it is raised once; it reads "Raised by the Supervisor, no check fired". Up to two suggestions.',
    inputSchema: object({
      kind: { type: 'string', enum: ['stuck', 'bug', 'health'] }, severity: { type: 'string', enum: ['high', 'medium'] }, title: { type: 'string', maxLength: 200 },
      signals: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      fingerprint: { type: 'string', description: 'A group fingerprint, such as stuck:queue-repo:<owner/repo>: with it, the finding may name signals of different fingerprints that share one cause. With no signal, the finding\'s own fingerprint, so it is raised once.' },
      evidence: { type: 'array', maxItems: 50 },
      explanation: { type: 'string', maxLength: 4000 }, suggestions: SUGGESTIONS,
    }, ['kind', 'severity', 'title', 'explanation']),
  },
  {
    name: 'reply',
    description: 'Answers in a thread: a finding\'s, or the general one (no finding). replyTo the owner\'s message; remembered quotes the memory note that shaped the answer.',
    inputSchema: object({ finding: { type: ['string', 'null'] }, body: { type: 'string', maxLength: 4000 }, replyTo: { type: 'string' }, remembered: { type: 'string', maxLength: 300 } }, ['body']),
  },
  {
    name: 'propose',
    description: 'Gives an open finding a check wrote alone (No Supervisor look yet) its first look: your explanation and up to two suggestions an owner presses.',
    inputSchema: object({ finding: { type: 'string' }, explanation: { type: 'string', maxLength: 4000 }, suggestions: { ...SUGGESTIONS, minItems: 1 } }, ['finding', 'explanation', 'suggestions']),
  },
];

const NOT_OPEN = 'No such open finding of this workspace: read the open ones with snapshot.';

/** Gives a finding a check wrote alone its first look: a raise of its fingerprint, with the explanation and suggestions. */
async function propose(api: SupervisorApi, runner: string, input: unknown): Promise<unknown> {
  const { finding: id, explanation, suggestions } = ARGS.propose.parse(input);
  const finding = (await api.findings(runner, true)).find((each) => each.id === id);
  if (finding?.fingerprint == null) throw new Error(NOT_OPEN);
  return api.raise(runner, { kind: finding.kind, severity: finding.severity, title: finding.title, fingerprint: finding.fingerprint, explanation, suggestions });
}

/** Each tool's one call on the API: its answer, sent back as JSON text. */
const CALLS: Record<ToolName, (api: SupervisorApi, runner: string, input: unknown) => Promise<unknown>> = {
  snapshot: (api, runner) => api.snapshot(runner),
  lines: (api, runner, input) => {
    const { job, after } = ARGS.lines.parse(input);
    return api.lines(runner, job, after);
  },
  memory: (api, runner, input) => {
    const asked = ARGS.memory.parse(input);
    return 'line' in asked ? api.remember(runner, asked) : api.memory(runner, asked.scope ?? null);
  },
  raise: (api, runner, input) => api.raise(runner, ARGS.raise.parse(input)),
  reply: (api, runner, input) => {
    const { finding, ...rest } = ARGS.reply.parse(input);
    return api.answer(runner, { finding: finding ?? null, ...rest });
  },
  propose,
};

const isTool = (name: unknown): name is ToolName => SEAT_TOOLS.some((tool) => tool === name);

/** A tool's text, as a result. */
const result = (text: string, isError = false) => ({ result: { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) } });

/** What one tool call answers: the app's reply, or the one line saying why there is none. */
async function toolCall(api: SupervisorApi, runner: string, params: Record<string, unknown>): Promise<object> {
  const name = params['name'];
  if (!isTool(name)) return result(`No tool ${typeof name === 'string' ? name : 'of that name'}: the tools are ${SEAT_TOOLS.join(', ')}.`, true);
  try {
    return result(JSON.stringify(await CALLS[name](api, runner, params['arguments'] ?? {})));
  } catch (error) {
    if (error instanceof z.ZodError) return result(`${name}: the inputs are out of shape (${error.issues.map((issue) => issue.path.join('.') || issue.message).join(', ')}).`, true);
    return result(`${name}: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

/** One JSON-RPC message; with no `id` it is a notification, answered by nothing. */
const MessageSchema = z.object({ method: z.string(), params: z.record(z.string(), z.unknown()).default({}), id: z.union([z.number(), z.string(), z.null()]).optional() });
type Params = Record<string, unknown>;

export type SeatMcpIo = {
  input: AsyncIterable<string | Uint8Array>;
  /** Writes one line, its newline included. */
  write: (line: string) => void;
  api: SupervisorApi;
  runner: string;
  version?: string | undefined;
};

/** The reply to one message, or `null` for a notification. */
async function replyTo(line: string, io: SeatMcpIo): Promise<object | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { id: null, error: { code: -32700, message: 'Parse error' } };
  }
  const request = MessageSchema.safeParse(raw);
  if (!request.success) return { id: null, error: { code: -32600, message: 'Invalid request' } };
  const { id, method, params } = request.data;
  if (id === undefined) return null;
  const answer = METHODS[method];
  return answer === undefined ? { id, error: { code: -32601, message: `Method not found: ${method}` } } : { id, ...(await answer(params, io)) };
}

/** What each method answers. */
const METHODS: Partial<Record<string, (params: Params, io: SeatMcpIo) => object | Promise<object>>> = {
  initialize: (params, io) => {
    const asked = params['protocolVersion'];
    return { result: { protocolVersion: typeof asked === 'string' ? asked : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'supervisor', version: io.version ?? '1.0.0' } } };
  },
  'tools/list': () => ({ result: { tools: TOOLS } }),
  'tools/call': (params, io) => toolCall(io.api, io.runner, params),
  ping: () => ({ result: {} }),
};

/** Serves the seat's tools over `io` until its input ends; resolves once every call in flight is answered. */
export async function serveSeatMcp(io: SeatMcpIo): Promise<void> {
  const decoder = new TextDecoder();
  const inFlight: Promise<void>[] = [];
  const take = (line: string): void => {
    if (line.trim() === '') return;
    inFlight.push(replyTo(line, io).then((reply) => {
      if (reply !== null) io.write(`${JSON.stringify({ jsonrpc: '2.0', ...reply })}\n`);
    }));
  };
  let rest = '';
  for await (const chunk of io.input) {
    const lines = (rest + (typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true }))).split('\n');
    rest = lines.pop() ?? '';
    lines.forEach(take);
  }
  take(rest);
  await Promise.all(inFlight);
}
