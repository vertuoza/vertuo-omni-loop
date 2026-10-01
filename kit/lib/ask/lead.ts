// @ts-nocheck
// The lead message of a round (PRD 752): the text Claude wrote just before it asked, so the person
// answering on the page reads what they are asked about. It is the text blocks of Claude's last
// assistant message before the AskUserQuestion call, read from the session's transcript (JSON
// lines), and nothing else: never a tool call, a tool result, thinking, or the person's own message
// (ADR-0002). It is capped at LEAD_MAX_BYTES; a longer one is cut and ends with SHORTENED_NOTE.
// Nothing here ever throws: a lead that cannot be read is `null`, and the question opens without it.
import { readFileSync } from 'node:fs';

/** The most a lead carries, in UTF-8 bytes, before the shortened note. */
export const LEAD_MAX_BYTES = 16 * 1024;

/** The line a cut lead ends with. */
export const SHORTENED_NOTE = '… (shortened, the rest is in the terminal)';

const TOOL = 'AskUserQuestion';

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const blocksOf = (entry) => (Array.isArray(entry?.message?.content) ? entry.message.content : []);

const isQuestion = (block, toolUseId) =>
  block?.type === 'tool_use' && block.name === TOOL && (toolUseId ? block.id === toolUseId : true);

/** `text` cut to at most `max` UTF-8 bytes, never inside a character. */
function cut(text, max) {
  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char);
    if (bytes + size > max) break;
    bytes += size;
    end += char.length;
  }
  return text.slice(0, end);
}

/**
 * The lead a transcript holds for the question `toolUseId`: read back from the entry holding that
 * call (or from the end, when it is not written yet) to the last entry of the person, which a tool
 * result is too. `null` when Claude wrote no text there.
 *
 * @param {string} text the transcript, as JSON lines
 * @param {string} [toolUseId] the AskUserQuestion call's id
 * @returns {string | null}
 */
export function readLead(text, toolUseId) {
  if (typeof text !== 'string') return null;
  const entries = text.split('\n').filter((raw) => raw.trim()).map(parse).filter((entry) => entry && typeof entry === 'object');

  let at = -1;
  if (toolUseId) at = entries.findLastIndex((entry) => entry.type === 'assistant' && blocksOf(entry).some((b) => isQuestion(b, toolUseId)));

  const parts = [];
  const texts = (blocks) => blocks.filter((b) => b?.type === 'text' && typeof b.text === 'string' && b.text.trim()).map((b) => b.text.trim());
  let from = entries.length - 1;
  if (at >= 0) {
    const blocks = blocksOf(entries[at]);
    parts.unshift(...texts(blocks.slice(0, blocks.findIndex((b) => isQuestion(b, toolUseId)))));
    from = at - 1;
  }
  for (let i = from; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type === 'user') break;
    if (entry.type !== 'assistant') continue;
    parts.unshift(...texts(blocksOf(entry)));
  }

  const lead = parts.join('\n\n');
  if (!lead) return null;
  if (Buffer.byteLength(lead) <= LEAD_MAX_BYTES) return lead;
  return `${cut(lead, LEAD_MAX_BYTES).trimEnd()}\n\n${SHORTENED_NOTE}`;
}

/**
 * The lead of the round a `pre` hook opens: read from the transcript its input names. `null`, never a
 * throw, when there is none or it cannot be read.
 *
 * @param {{ input?: any }} options
 * @returns {string | null}
 */
export function roundLead({ input } = {}) {
  const path = typeof input?.transcript_path === 'string' && input.transcript_path ? input.transcript_path : null;
  if (!path) return null;
  try {
    return readLead(readFileSync(path, 'utf8'), typeof input.tool_use_id === 'string' ? input.tool_use_id : undefined);
  } catch {
    return null;
  }
}
