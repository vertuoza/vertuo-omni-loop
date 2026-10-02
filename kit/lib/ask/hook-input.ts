// A harness hook's input, read from stdin: the JSON object Claude Code writes there. Shared by the
// ask mode's hooks (`omni ask hook …`) and the heartbeat (`omni heartbeat`).
import { jsonObject } from './schema.ts';
import type { JsonObject } from './schema.ts';

/** What a hook's input may be read from: its text, or a stream such as `process.stdin`. */
export type HookStdin = string | (AsyncIterable<string | Buffer> & { isTTY?: boolean; setEncoding?: (encoding: BufferEncoding) => unknown }) | null | undefined;

/** stdin's text, or `null` when there is none or it is a terminal. A string is taken as is. */
async function readText(stdin: HookStdin): Promise<string | null> {
  if (typeof stdin === 'string') return stdin;
  if (!stdin || stdin.isTTY) return null;
  stdin.setEncoding?.('utf8');
  let text = '';
  for await (const chunk of stdin) text += String(chunk);
  return text;
}

/** The hook's input: stdin parsed as a JSON object, or `null`. A terminal is never read. */
export async function readInput(stdin: HookStdin): Promise<JsonObject | null> {
  const text = await readText(stdin);
  if (text === null) return null;
  try {
    return jsonObject(JSON.parse(text));
  } catch {
    return null;
  }
}
