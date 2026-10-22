// A runner job's readable lines (PRD 1904, "One readable line per step"): a job runs
// `claude -p --output-format stream-json --verbose`, which prints one JSON event per line as it works.
// `stepLine` turns one of those lines into what a person reads: a tool call as its name and its
// target, assistant text as its first line, a failed tool result with its output, each pull request
// the job opened or handed off on once, and the run's end. Each line is prefixed with the runner's local time and cut to 500
// characters. A line that is not JSON is passed through; anything else gives nothing.

/** The most characters a readable line holds, its time included. */
export const LINE_CUT = 500;
/** The most lines of a failed tool result's output shown under its `✗` line. */
export const STEP_OUTPUT_LINES = 20;

/** What a run's lines share: the time they are stamped with, and the pull request links already named. */
export type StepContext = { now?: Date; seen?: Set<string> };

/** What one event's lines are read with: the run's links named, and the ids of its calls that open a pull request. */
type Run = { seen: Set<string>; opens: Set<string> };

/** The ids of the calls that open a pull request, per run, keyed by the run's `seen` (bug 2365). */
const OPENS = new WeakMap<Set<string>, Set<string>>();

function opensOf(seen: Set<string>): Set<string> {
  const known = OPENS.get(seen);
  if (known !== undefined) return known;
  const opens = new Set<string>();
  OPENS.set(seen, opens);
  return opens;
}

type Json = Record<string, unknown>;

const PULL_REQUEST = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g;
/** A shell command that opens a pull request: its output is the one tool result whose link is the job's. */
const OPENS_PR = /\bgh\s+pr\s+create\b/;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const two = (value: number): string => String(value).padStart(2, '0');
const cut = (line: string): string => (line.length > LINE_CUT ? line.slice(0, LINE_CUT) : line);
const firstLine = (value: string): string => value.split('\n').find((line) => line.trim() !== '')?.trim() ?? '';

/** `hh:mm:ss`, in the runner's local time. */
function clock(now: Date): string {
  return `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
}

/** A duration in milliseconds as a person reads it: `4s`, `12m 34s`, `1h 2m`. */
function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  if (minutes > 0) return `${String(minutes)}m ${String(seconds % 60)}s`;
  return `${String(seconds)}s`;
}

/** The tools a line names with a target: the word it shows, and the target read from the call's input. */
const TOOLS: Readonly<Record<string, readonly [string, (input: Json) => string]>> = {
  Bash: ['Bash', (input) => firstLine(text(input.command))],
  Edit: ['Edit', (input) => text(input.file_path)],
  MultiEdit: ['Edit', (input) => text(input.file_path)],
  NotebookEdit: ['Edit', (input) => text(input.notebook_path) || text(input.file_path)],
  Write: ['Write', (input) => text(input.file_path)],
  Read: ['Read', (input) => text(input.file_path)],
  Grep: ['Grep', (input) => text(input.pattern)],
  Glob: ['Glob', (input) => text(input.pattern)],
  Task: ['Agent', (input) => text(input.description)],
  Agent: ['Agent', (input) => text(input.description)],
};

/** The line of one tool call: `<word>: <target>`, or the tool's name alone. */
function toolCall(name: string, input: Json): string {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : undefined;
  return tool ? `${tool[0]}: ${tool[1](input)}` : name;
}

/** A tool result's output as text: a string, or the text blocks of a list. */
function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(isObject)
    .map((block) => text(block.text))
    .join('\n');
}

/** The lines of a failed tool result: `✗` and its first line, then up to 20 more, indented two spaces. */
function failure(output: string): string[] {
  const lines = output.split('\n');
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop();
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) return ['✗'];
  const rest = lines.slice(first + 1, first + 1 + STEP_OUTPUT_LINES).map((line) => `  ${line}`);
  return [`✗ ${(lines[first] ?? '').trim()}`, ...rest];
}

/** `PR: <link>` for each pull request link in `value` not already in `seen`. */
function links(value: string, seen: Set<string>): string[] {
  const found: string[] = [];
  for (const link of value.match(PULL_REQUEST) ?? []) {
    if (seen.has(link)) continue;
    seen.add(link);
    found.push(`PR: ${link}`);
  }
  return found;
}

/** The line of a tool call, noting its id when it opens a pull request. */
function use(block: Json, opens: Set<string>): string {
  const input = isObject(block.input) ? block.input : {};
  if (block.name === 'Bash' && OPENS_PR.test(text(input.command))) opens.add(text(block.id));
  return toolCall(text(block.name), input);
}

/**
 * The lines of a message's content blocks: tool calls, assistant text, failed tool results, and the
 * link of a pull request a call opened. A link the job only read (a file, a search, test output) or
 * wrote in passing is no `PR:` line (bug 2365).
 */
function blocks(content: unknown, run: Run): string[] {
  if (!Array.isArray(content)) return [];
  return content.filter(isObject).flatMap((block): string[] => {
    if (block.type === 'tool_use') return [use(block, run.opens)];
    if (block.type === 'text') {
      const line = firstLine(text(block.text));
      return line ? [`› ${line}`] : [];
    }
    if (block.type === 'tool_result') {
      const output = resultText(block.content);
      const opened = run.opens.has(text(block.tool_use_id)) ? links(output, run.seen) : [];
      return [...(block.is_error === true ? failure(output) : []), ...opened];
    }
    return [];
  });
}

/** The lines of the run's `result` event: `Done: …`, every line of its text (the hand-off), then a `PR:` line per link it names first. */
function result(event: Json, seen: Set<string>): string[] {
  const ok = event.is_error !== true && event.subtype === 'success';
  const done = `Done: ${ok ? 'ok' : 'error'} · ${String(number(event.num_turns))} turns · $${number(event.total_cost_usd).toFixed(2)} · ${duration(number(event.duration_ms))}`;
  const body = text(event.result);
  return [done, ...(body === '' ? [] : body.split('\n')), ...links(body, seen)];
}

/** The lines of one parsed event, unstamped. */
function eventLines(event: Json, run: Run): string[] {
  if (event.type === 'result') return result(event, run.seen);
  if (event.type === 'assistant' || event.type === 'user') return blocks(isObject(event.message) ? event.message.content : undefined, run);
  return [];
}

/**
 * The readable lines of one line of claude's stream-json output, each `hh:mm:ss `-prefixed and cut to
 * {@link LINE_CUT} characters. A line that is not JSON comes back as it is (cut); an event that
 * shows nothing (system, thinking, a tool result that succeeded, an unknown type) gives none. Pass
 * the same `seen` for a whole run, so each pull request link is named once, and the output of a call
 * that opened a pull request is known as such.
 */
export function stepLine(line: string, { now = new Date(), seen = new Set<string>() }: StepContext = {}): string[] {
  if (line.trim() === '') return [];
  let event: unknown;
  try {
    event = JSON.parse(line);
  } catch {
    return [cut(line)];
  }
  if (!isObject(event)) return [];
  const stamp = `${clock(now)} `;
  return eventLines(event, { seen, opens: opensOf(seen) }).map((each) => cut(stamp + each));
}
