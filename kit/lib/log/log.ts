/**
 * **The structured logger** (PRD 1723): one JSON line to stdout per call, what the GitHub App's
 * entries, its Inngest functions and the arcade's cron write at the end of each run, so Vercel's
 * log search can filter by `event`, `outcome`, `repo` or `prd` and read how long a run took.
 *
 * - **An allow-list of fields** ({@link LOG_FIELDS}). A field outside it, or an allowed field whose
 *   value is not a plain scalar, is dropped and counted in `dropped`: its name and value are never
 *   written.
 * - **An error** is written as `{ name, message }`, never its stack.
 * - **Every string is masked, then cut:** what looks like a credential (a GitHub or kit token, an
 *   `sk-` key, a `Bearer` value, the value of a URL query parameter named like a key, token,
 *   secret, code or signature) becomes `***`, and a message or an error's message is cut to 500
 *   characters.
 * - **It never throws.** A value it cannot read or serialise, a failing clock or a failing sink is
 *   swallowed: a log line never breaks a request.
 *
 * Pure, with its sink and clock injected; {@link log} is the one writing to stdout.
 */

/** The fields a line may carry; anything else is dropped. `level` is set by the method called. */
export const LOG_FIELDS = [
  'level',
  'event',
  'outcome',
  'ms',
  'repo',
  'prd',
  'deliveryId',
  'runId',
  'fn',
  'status',
  'error',
  'message',
  'repos',
  'dropped',
] as const;

type LogLevel = 'info' | 'warn' | 'error';

/** How a run ended: done, turned away (a bad signature, a wrong method or bearer), or thrown. */
export type LogOutcome = 'ok' | 'refused' | 'failed';

/** What a caller hands one log call. */
export type LogEntry = {
  /** What ran: `webhook`, `server-event`, `inngest`, `stages-sync`. */
  event: string;
  outcome?: LogOutcome;
  /** How long the run took, in milliseconds. */
  ms?: number;
  repo?: string;
  prd?: number | string;
  deliveryId?: string;
  runId?: string;
  /** The function or GitHub event name that ran. */
  fn?: string;
  /** The HTTP status answered. */
  status?: number;
  /** What was thrown: written as `{ name, message }`. */
  error?: unknown;
  /** One sentence for a person, masked and cut like an error's message. */
  message?: string;
  /** How many repositories the run read. */
  repos?: number;
};

/** Where a line goes: one call per line, without its newline. */
export type LogSink = (line: string) => void;

export type Logger = {
  info(entry: LogEntry): void;
  warn(entry: LogEntry): void;
  error(entry: LogEntry): void;
  /** Starts a stopwatch on the logger's clock; calling the result gives the milliseconds since. */
  timer(): () => number;
};

const MAX_TEXT = 500;
const MASK = '***';
const ALLOWED: ReadonlySet<string> = new Set(LOG_FIELDS.filter((field) => field !== 'level' && field !== 'dropped'));
const CUT: ReadonlySet<string> = new Set(['message']);

/**
 * Each credential shape, and what it becomes. A GitHub or kit token is masked even glued to a word;
 * an `sk-` key only at a word's start, so `task-force` stays as written.
 */
const CREDENTIALS: readonly [RegExp, string][] = [
  [/github_pat_[A-Za-z0-9_]+/g, MASK],
  [/gh[pousr]_[A-Za-z0-9_]+/g, MASK],
  [/omk_[A-Za-z0-9_-]+/g, MASK],
  [/\bsk-[A-Za-z0-9_-]+/g, MASK],
  [/\b(bearer)\s+[^\s"',;]+/gi, `$1 ${MASK}`],
  [/([?&][^=&#\s"']*(?:key|token|secret|code|signature)[^=&#\s"']*=)[^&#\s"']*/gi, `$1${MASK}`],
];

/** `text` with every credential shape masked as `***`. */
function maskCredentials(text: string): string {
  return CREDENTIALS.reduce((masked, [shape, replacement]) => masked.replace(shape, replacement), text);
}

const cut = (text: string): string => (text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text);

/** A thrown value as a line writes it: its name and its masked, cut message. */
function errorOf(value: unknown): { name: string; message: string } {
  if (value instanceof Error) {
    return { name: maskCredentials(value.name), message: cut(maskCredentials(value.message)) };
  }
  return { name: 'Error', message: cut(maskCredentials(typeof value === 'string' ? value : String(value))) };
}

/** An allowed field's value as written, or `undefined` when it is not a plain scalar. */
function scalarOf(field: string, value: unknown): string | number | boolean | null | undefined {
  if (typeof value === 'string') {
    const masked = maskCredentials(value);
    return CUT.has(field) ? cut(masked) : masked;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || value === null) return value;
  return undefined;
}

/** The line one call writes. */
function lineOf(level: LogLevel, entry: LogEntry): string {
  const line: Record<string, unknown> = { level };
  let dropped = 0;
  for (const [field, value] of Object.entries(entry)) {
    if (value === undefined) continue;
    if (!ALLOWED.has(field)) {
      dropped += 1;
      continue;
    }
    if (field === 'error') {
      line.error = errorOf(value);
      continue;
    }
    const scalar = scalarOf(field, value);
    if (scalar === undefined) dropped += 1;
    else line[field] = scalar;
  }
  if (dropped > 0) line.dropped = dropped;
  return JSON.stringify(line);
}

/** Writes `line` and a newline to stdout. */
const stdout: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

/** A logger writing to `sink` (stdout by default), timing on `clock` (`Date.now` by default). */
export function createLogger({ sink = stdout, clock = Date.now }: { sink?: LogSink; clock?: () => number } = {}): Logger {
  const write = (level: LogLevel, entry: LogEntry): void => {
    try {
      sink(lineOf(level, entry));
    } catch {
      // A log line never breaks a request.
    }
  };
  const now = (): number => {
    try {
      return clock();
    } catch {
      return Number.NaN;
    }
  };
  return {
    info: (entry) => {
      write('info', entry);
    },
    warn: (entry) => {
      write('warn', entry);
    },
    error: (entry) => {
      write('error', entry);
    },
    timer: () => {
      const start = now();
      return () => Math.max(0, Math.round(now() - start)) || 0;
    },
  };
}

/** The logger every server module writes through: one JSON line to stdout per call. */
export const log: Logger = createLogger();
