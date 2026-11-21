import { z } from 'zod';
import { OPENROUTER_URL } from '../../ask/classify';
import { estimateTokens, INPUT_CAP } from './commander';

// The Commander's model call (PRD 3107 s1), through OpenRouter as the Ask classifier's (src/ask/classify.ts): one
// conversation of at most 3 tool rounds, then one answer, every call under 30 seconds in all. The stable instructions
// carry the provider's cache marker, so a fleet's second question pays less for them. The input never passes the cap: a
// tool result that would is replaced by a line saying so. What every call counted (input + output, cache reads left out,
// as PRD 3040 counts a job) comes back with the answer. Pure apart from the fetch, which a test passes.

/** The model: a constant, changed in one line (spec, Decisions). */
export const COMMANDER_MODEL = 'anthropic/claude-sonnet-5.5';
/** How long the whole answer may take. */
const COMMANDER_TIMEOUT_MS = 30_000;
/** The tool rounds a question may take before it answers. */
export const TOOL_ROUNDS = 3;
const MAX_OUTPUT_TOKENS = 1_200;
const NO_ROOM = 'No more room in this question: answer with what you have.';

/** One question's conversation: the stable instructions, the data, the tools it may call and what each call answers. */
export interface ModelTurn {
  system: string;
  data: string;
  tools: readonly object[];
  runTool: (name: string, args: unknown) => Promise<string>;
}

export type ModelAnswer = { ok: true; content: string; tokens: number } | { ok: false; why: string; tokens: number };

export type CommanderModel = (turn: ModelTurn) => Promise<ModelAnswer>;

type Options = { apiKey: string; fetch?: typeof globalThis.fetch; model?: string; timeoutMs?: number; inputCap?: number };

const Count = z.number().int().min(0).catch(0).default(0);
const UsageSchema = z.object({ prompt_tokens: Count, completion_tokens: Count, prompt_tokens_details: z.object({ cached_tokens: Count }).nullish().catch(null) }).nullish().catch(null);
const ToolCallSchema = z.object({ id: z.string(), type: z.literal('function').default('function'), function: z.object({ name: z.string(), arguments: z.string().default('{}') }) });
const AnswerSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullish(), tool_calls: z.array(ToolCallSchema).nullish() }) })).min(1),
  usage: UsageSchema,
});
type ToolCall = z.infer<typeof ToolCallSchema>;

/** What one call counted: input and output, cache reads left out (OpenRouter counts them in the prompt). */
export function countedTokens(usage: unknown): number {
  const u = UsageSchema.parse(usage);
  if (!u) return 0;
  return Math.max(0, u.prompt_tokens - (u.prompt_tokens_details?.cached_tokens ?? 0)) + u.completion_tokens;
}

/** A tool call's arguments, or none when they are no JSON. */
function argsOf(call: ToolCall): unknown {
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    return {};
  }
}

/** One call: the message the model wrote and what it counted, or why there is none. */
async function callOnce(options: Required<Pick<Options, 'apiKey' | 'fetch' | 'model'>>, messages: readonly object[], tools: readonly object[] | null, signal: AbortSignal) {
  const response = await options.fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${options.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: options.model, temperature: 0, max_tokens: MAX_OUTPUT_TOKENS, messages, ...(tools ? { tools } : {}) }),
    signal,
  });
  if (!response.ok) return { ok: false as const, why: `OpenRouter answered ${String(response.status)}`, tokens: 0 };
  const json: unknown = await response.json();
  const read = AnswerSchema.safeParse(json);
  if (!read.success) return { ok: false as const, why: 'OpenRouter answered no message', tokens: 0 };
  return { ok: true as const, message: read.data.choices[0]?.message ?? {}, tokens: countedTokens(read.data.usage) };
}

type Called = Awaited<ReturnType<typeof callOnce>>;

/** Where one call leaves the conversation: its end, the answer or why there is none, or the tool calls to run. */
function endOf(called: Called, offered: boolean, tokens: number): ModelAnswer | { calls: ToolCall[]; content: string } {
  if (!called.ok) return { ...called, tokens };
  const calls = called.message.tool_calls ?? [];
  if (calls.length > 0 && offered) return { calls, content: called.message.content ?? '' };
  const content = called.message.content?.trim() ?? '';
  return content === '' ? { ok: false, why: 'no content', tokens } : { ok: true, content, tokens };
}

/** A question's conversation: the instructions marked for the cache, the data, and each tool result while it fits the cap. */
function conversationOf(turn: ModelTurn, inputCap: number) {
  const messages: object[] = [
    { role: 'system', content: [{ type: 'text', text: turn.system, cache_control: { type: 'ephemeral' } }] },
    { role: 'user', content: turn.data },
  ];
  let size = estimateTokens(turn.system) + estimateTokens(turn.data);
  return {
    messages,
    /** Hands back the tool calls the model made, each result while it fits under the cap. */
    async answer(calls: readonly ToolCall[], content: string) {
      messages.push({ role: 'assistant', content, tool_calls: calls });
      for (const call of calls) {
        const result = await turn.runTool(call.function.name, argsOf(call));
        const fits = size + estimateTokens(result) <= inputCap;
        if (fits) size += estimateTokens(result);
        messages.push({ role: 'tool', tool_call_id: call.id, content: fits ? result : NO_ROOM });
      }
    },
  };
}

/** The Commander's model through OpenRouter. */
export function openRouterCommander({ apiKey, fetch = globalThis.fetch, model = COMMANDER_MODEL, timeoutMs = COMMANDER_TIMEOUT_MS, inputCap = INPUT_CAP }: Options): CommanderModel {
  return async (turn) => {
    const signal = AbortSignal.timeout(timeoutMs);
    const conversation = conversationOf(turn, inputCap);
    let tokens = 0;
    try {
      // The last round offers no tool, so it always ends.
      for (let round = 0; ; round += 1) {
        const tools = round < TOOL_ROUNDS && turn.tools.length > 0 ? turn.tools : null;
        const called = await callOnce({ apiKey, fetch, model }, conversation.messages, tools, signal);
        tokens += called.tokens;
        const end = endOf(called, tools !== null, tokens);
        if ('ok' in end) return end;
        await conversation.answer(end.calls, end.content);
      }
    } catch (error) {
      return { ok: false, why: error instanceof Error ? error.message : String(error), tokens };
    }
  };
}
