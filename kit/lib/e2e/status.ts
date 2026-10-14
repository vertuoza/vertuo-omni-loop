// PRD 1233, 1675: for each test tagged `prd-<n>`, whether a recording exists and whether one is expected
// (only a test with an `agent.` call records). Pure.
import type { Recording, TaggedTest } from './recording.ts';

/** A test and the files of its recordings; `expected` is false for a test with no agent step. */
export type TestStatus = { readonly id: string; readonly file: string; readonly recording: boolean; readonly expected: boolean; readonly recordings: readonly string[]; readonly level: 'critical' | 'standard'; readonly flow: string | null };

/** A recording belongs to a test when its `testId` is the test's id, or the id followed by `:`, `>` or `#` and a title. */
function belongsTo(testId: string, id: string): boolean {
  return testId === id || [':', '>', '#'].some((separator) => testId.startsWith(`${id}${separator}`));
}

/** Every test, in order, with the files of the recordings made for it. */
export function testStatus(tests: readonly TaggedTest[], recordings: readonly Recording[]): TestStatus[] {
  return tests.map(({ id, file, agent, level, flow }) => {
    const files = recordings.filter((recording) => belongsTo(recording.testId, id)).map((recording) => recording.file);
    return { id, file, recording: files.length > 0, expected: agent, recordings: files, level, flow };
  });
}

/** A test that expects a recording and has none: the run stops on it. */
export function missingRecording(status: readonly TestStatus[]): boolean {
  return status.some((test) => test.expected && !test.recording);
}

/** PRD 1737: one line per `critical` test with no `flow-<id>` tag or whose flow is not in the list (`flowIds` null: no list). */
export function unknownFlows(status: readonly TestStatus[], flowIds: readonly string[] | null): string[] {
  return status.flatMap((test) => {
    if (test.level !== 'critical') return [];
    if (test.flow === null) return [`${test.file}: tagged critical but has no flow-<id> tag`];
    if (flowIds?.includes(test.flow) !== true) return [`${test.file}: tagged critical for flow "${test.flow}", which is not in the list of critical flows`];
    return [];
  });
}
