import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAD_MAX_BYTES, SHORTENED_NOTE, readLead, roundLead } from './lead.ts';

const lines = (...entries: unknown[]) => entries.map((entry) => JSON.stringify(entry)).join('\n');
const user = (content: unknown) => ({ type: 'user', message: { role: 'user', content } });
const assistant = (id: string, content: unknown) => ({ type: 'assistant', message: { id, role: 'assistant', content } });
const ask = (id = 'toolu_ask') => ({ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions: [{ question: 'Does this design look right?' }] } });

// A whole turn: the person's message, thinking, a tool call, its result, two text blocks, then the question.
const TURN = lines(
  user('Design the page for me, and my secret is hunter2'),
  assistant('m1', [{ type: 'thinking', thinking: 'private reasoning' }]),
  assistant('m1', [{ type: 'tool_use', id: 'toolu_read', name: 'Read', input: { file_path: '/secret/tool-input.txt' } }]),
  user([{ type: 'tool_result', tool_use_id: 'toolu_read', content: 'tool output the file held' }]),
  assistant('m2', [{ type: 'text', text: '## The design\n\nA lead and a fold.' }]),
  assistant('m2', [{ type: 'text', text: 'It keeps short questions as today.' }]),
  assistant('m2', [ask()]),
);

describe('readLead', () => {
  it('takes only the text blocks of the last assistant message before the question, joined by a blank line', () => {
    expect(readLead(TURN, 'toolu_ask')).toBe('## The design\n\nA lead and a fold.\n\nIt keeps short questions as today.');
  });

  it('never carries tool input, tool output, thinking or the person\'s own message', () => {
    const lead = readLead(TURN, 'toolu_ask');
    for (const word of ['hunter2', 'private reasoning', 'tool-input', 'tool output']) expect(lead).not.toContain(word);
  });

  it('reads text written in the same entry before the question, and nothing after it', () => {
    const text = lines(
      user('go'),
      assistant('m1', [{ type: 'text', text: 'Before.' }, ask(), { type: 'text', text: 'After.' }]),
    );
    expect(readLead(text, 'toolu_ask')).toBe('Before.');
  });

  it('reads back from the end when the question is not written yet', () => {
    const text = lines(user('go'), assistant('m1', [{ type: 'text', text: 'The plan.' }]));
    expect(readLead(text, 'toolu_missing')).toBe('The plan.');
    expect(readLead(text)).toBe('The plan.');
  });

  it('takes the question named by its id when there are several', () => {
    const text = lines(
      user('go'),
      assistant('m1', [{ type: 'text', text: 'First.' }, ask('toolu_1')]),
      user([{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Red' }]),
      assistant('m2', [{ type: 'text', text: 'Second.' }, ask('toolu_2')]),
    );
    expect(readLead(text, 'toolu_1')).toBe('First.');
    expect(readLead(text, 'toolu_2')).toBe('Second.');
  });

  it('skips lines that are not JSON and entries that are neither the person nor Claude', () => {
    const text = [
      JSON.stringify(user('go')),
      'not json',
      JSON.stringify(assistant('m1', [{ type: 'text', text: 'One.' }])),
      JSON.stringify({ type: 'system', content: 'a note' }),
      JSON.stringify(assistant('m1', [{ type: 'text', text: 'Two.' }, ask()])),
    ].join('\n');
    expect(readLead(text, 'toolu_ask')).toBe('One.\n\nTwo.');
  });

  it('is null when Claude wrote no text before the question', () => {
    expect(readLead(lines(user('go'), assistant('m1', [ask()])), 'toolu_ask')).toBeNull();
    expect(readLead(lines(assistant('m1', [{ type: 'text', text: '   ' }, ask()])), 'toolu_ask')).toBeNull();
    expect(readLead('', 'toolu_ask')).toBeNull();
    expect(readLead(undefined)).toBeNull();
  });

  it(`cuts a lead over ${LEAD_MAX_BYTES} bytes and ends it with the shortened note`, () => {
    const long = 'é'.repeat(LEAD_MAX_BYTES);
    const lead = readLead(lines(user('go'), assistant('m1', [{ type: 'text', text: long }, ask()])), 'toolu_ask')!;
    expect(lead.endsWith(SHORTENED_NOTE)).toBe(true);
    expect(SHORTENED_NOTE).toBe('… (shortened, the rest is in the terminal)');
    const kept = lead.slice(0, lead.length - SHORTENED_NOTE.length).trimEnd();
    expect(Buffer.byteLength(kept)).toBeLessThanOrEqual(LEAD_MAX_BYTES);
    expect(kept).not.toContain('�');
    expect(kept.length).toBeGreaterThan(8000);
  });

  it('keeps a lead of exactly the cap whole', () => {
    const exact = 'a'.repeat(LEAD_MAX_BYTES);
    expect(readLead(lines(assistant('m1', [{ type: 'text', text: exact }, ask()])), 'toolu_ask')).toBe(exact);
  });
});

describe('roundLead', () => {
  it('reads the transcript the hook input names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-lead-'));
    const path = join(dir, 'transcript.jsonl');
    writeFileSync(path, TURN);
    expect(roundLead({ input: { transcript_path: path, tool_use_id: 'toolu_ask' } })).toBe(
      '## The design\n\nA lead and a fold.\n\nIt keeps short questions as today.',
    );
  });

  it('is null, never a throw, for a missing or unreadable transcript', () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-lead-'));
    expect(roundLead({ input: { transcript_path: join(dir, 'gone.jsonl') } })).toBeNull();
    expect(roundLead({ input: { transcript_path: dir } })).toBeNull();
    expect(roundLead({ input: {} })).toBeNull();
    expect(roundLead({})).toBeNull();
  });
});
