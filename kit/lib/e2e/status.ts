// PRD 1233: for each test tagged `prd-<n>`, whether a recording exists. Pure.
import type { Recording, TaggedTest } from './recording.ts';

/** A test and the files of its recordings. */
export type TestStatus = { readonly id: string; readonly file: string; readonly recording: boolean; readonly recordings: readonly string[] };

/** A recording belongs to a test when its `testId` is the test's id, or the id followed by `:`, `>` or `#` and a title. */
function belongsTo(testId: string, id: string): boolean {
  return testId === id || [':', '>', '#'].some((separator) => testId.startsWith(`${id}${separator}`));
}

/** Every test, in order, with the files of the recordings made for it. */
export function testStatus(tests: readonly TaggedTest[], recordings: readonly Recording[]): TestStatus[] {
  return tests.map(({ id, file }) => {
    const files = recordings.filter((recording) => belongsTo(recording.testId, id)).map((recording) => recording.file);
    return { id, file, recording: files.length > 0, recordings: files };
  });
}
