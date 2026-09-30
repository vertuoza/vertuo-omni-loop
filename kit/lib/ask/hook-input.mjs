// A harness hook's input, read from stdin: the JSON object Claude Code writes there. Shared by the
// ask mode's hooks (`omni ask hook …`) and the heartbeat (`omni heartbeat`).

/** stdin's text, or `null` when there is none or it is a terminal. A string is taken as is. */
async function readText(stdin) {
  if (typeof stdin === 'string') return stdin;
  if (!stdin || stdin.isTTY) return null;
  stdin.setEncoding?.('utf8');
  let text = '';
  for await (const chunk of stdin) text += chunk;
  return text;
}

/** The hook's input: stdin parsed as a JSON object, or `null`. A terminal is never read. */
export async function readInput(stdin) {
  const text = await readText(stdin);
  if (text === null) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
