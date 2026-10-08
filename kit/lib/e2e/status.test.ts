import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PrdNumberSchema } from '../ids.ts';
import { parseRecording, readRecordings, readTaggedTests, RecordingError } from './recording.ts';
import { testStatus } from './status.ts';

const trace = (testId: string, callIndex = 0, extra: object = {}) =>
  JSON.stringify({ schemaVersion: 'trace-1', summary: 'clicks Rank', recordedFor: { testId, callIndex }, actions: [{ name: 'click', target: 'Rank' }], ...extra });

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'omni-e2e-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('parseRecording', () => {
  it('reads a trace-1 recording', () => {
    expect(parseRecording('a.json', trace('t.spec.ts', 2))).toEqual({
      file: 'a.json', testId: 't.spec.ts', callIndex: 2, summary: 'clicks Rank', actions: [{ name: 'click', target: 'Rank' }],
    });
  });

  it('names the file when the JSON is bad, the schema is another, or a field is missing', () => {
    expect(() => parseRecording('x.json', '{')).toThrow('x.json: not valid JSON');
    expect(() => parseRecording('x.json', trace('t', 0, { schemaVersion: 'trace-2' }))).toThrow(/x\.json: schemaVersion "trace-2" is not trace-1/);
    expect(() => parseRecording('x.json', '{"schemaVersion":"trace-1"}')).toThrow(RecordingError);
    expect(() => parseRecording('x.json', '[]')).toThrow('x.json: not a JSON object');
  });
});

describe('testStatus', () => {
  const files = {
    'e2e/rank.spec.ts': "test('rank', { tag: 'prd-1017' }, () => {})",
    'e2e/other.spec.ts': "test('x', { tag: 'prd-10170' }, () => {})",
    'e2e/nested/sort.spec.ts': '// tag prd-1017\n',
    'e2e/.e2e/cache/a.json': trace('rank.spec.ts'),
    'e2e/.e2e/cache/b.json': trace('rank.spec.ts:rank', 1),
  };

  it('finds the tagged tests and their recordings', () => {
    const root = repo(files);
    const tests = readTaggedTests(root, 'e2e', PrdNumberSchema.parse(1017));
    expect(tests.map((t) => t.id)).toEqual(['nested/sort.spec.ts', 'rank.spec.ts']);
    expect(testStatus(tests, readRecordings(root, 'e2e'))).toEqual([
      { id: 'nested/sort.spec.ts', file: 'e2e/nested/sort.spec.ts', recording: false, recordings: [] },
      { id: 'rank.spec.ts', file: 'e2e/rank.spec.ts', recording: true, recordings: ['e2e/.e2e/cache/a.json', 'e2e/.e2e/cache/b.json'] },
    ]);
  });

  it('reads no recording from a folder that has none', () => {
    expect(readRecordings(repo({}), 'e2e')).toEqual([]);
  });

  it('throws naming the recording that does not read', () => {
    const root = repo({ 'e2e/.e2e/cache/bad.json': 'nope' });
    expect(() => readRecordings(root, 'e2e')).toThrow('e2e/.e2e/cache/bad.json: not valid JSON');
  });
});
