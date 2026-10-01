// @ts-nocheck
import { mkdirSync, mkdtempSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROOF_FILE_MAX_BYTES, ProofRunRefused, readRun } from './run.ts';

const COMMIT = '8775008c0a1b';
const URL = 'https://preview.example/prd/7';

/** A run folder holding `run.json` (as given) and each named file with its text. */
function runDir(run, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-proof-'));
  mkdirSync(dir, { recursive: true });
  if (run !== undefined) writeFileSync(join(dir, 'run.json'), typeof run === 'string' ? run : JSON.stringify(run));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const RUN = {
  commit: COMMIT,
  url: URL,
  criteria: [
    { text: 'The tab shows each clip.', verdict: 'pass', video: '1-tab.webm', script: '1-tab.spec.ts' },
    { text: 'A failing check is shown.', verdict: 'fail', note: 'expected ✗', video: '2-fail.webm', script: '2-fail.spec.ts' },
    { text: 'The config key is read.', verdict: 'unfilmable', note: 'a config key: nothing to see' },
  ],
};
const FILES = { '1-tab.webm': 'webm-1', '1-tab.spec.ts': 'test(1)', '2-fail.webm': 'webm-2', '2-fail.spec.ts': 'test(2)' };

function refusal(dir) {
  try {
    readRun(dir);
  } catch (error) {
    if (error instanceof ProofRunRefused) return { status: error.status, message: error.message };
    throw error;
  }
  return null;
}

describe('readRun', () => {
  it('reads the commit, the URL, the criteria and every file they name, with its size and type', () => {
    const dir = runDir(RUN, FILES);
    const run = readRun(dir);
    expect(run.commit).toBe(COMMIT);
    expect(run.url).toBe(URL);
    expect(run.criteria).toEqual(RUN.criteria);
    expect(run.files).toEqual([
      { name: '1-tab.webm', path: join(dir, '1-tab.webm'), bytes: 6, type: 'video/webm' },
      { name: '1-tab.spec.ts', path: join(dir, '1-tab.spec.ts'), bytes: 7, type: 'text/plain' },
      { name: '2-fail.webm', path: join(dir, '2-fail.webm'), bytes: 6, type: 'video/webm' },
      { name: '2-fail.spec.ts', path: join(dir, '2-fail.spec.ts'), bytes: 7, type: 'text/plain' },
    ]);
  });

  it('adds preview.gif when the folder holds one, and only then', () => {
    const dir = runDir(RUN, { ...FILES, 'preview.gif': 'GIF89a' });
    expect(readRun(dir).files.at(-1)).toEqual({ name: 'preview.gif', path: join(dir, 'preview.gif'), bytes: 6, type: 'image/gif' });
    expect(readRun(runDir(RUN, FILES)).files.map((f) => f.name)).not.toContain('preview.gif');
  });

  it('keeps only the fields the register call takes, and a note only when there is one', () => {
    const run = { ...RUN, criteria: [{ text: ' Trimmed. ', verdict: 'unfilmable', extra: 'dropped', note: null }] };
    expect(readRun(runDir(run)).criteria).toEqual([{ text: 'Trimmed.', verdict: 'unfilmable' }]);
  });

  it('a folder without run.json is null', () => {
    expect(readRun(runDir(undefined))).toBeNull();
  });

  it('refuses a verdict other than pass, fail or unfilmable (400)', () => {
    const run = { ...RUN, criteria: [{ text: 'x', verdict: 'maybe' }] };
    expect(refusal(runDir(run))).toEqual({ status: 400, message: 'criterion 1: a verdict is pass, fail or unfilmable, not maybe' });
  });

  it('refuses a file a criterion names that the folder does not hold (400)', () => {
    const files = { ...FILES };
    delete files['2-fail.webm'];
    expect(refusal(runDir(RUN, files))).toEqual({ status: 400, message: '2-fail.webm: not in the run folder' });
  });

  it('refuses a .mp4 (400) and a file over 50 MB (413)', () => {
    const mp4 = { ...RUN, criteria: [{ text: 'x', verdict: 'pass', video: '1-x.mp4' }] };
    expect(refusal(runDir(mp4, { '1-x.mp4': 'mp4' }))).toEqual({ status: 400, message: '1-x.mp4: a proof takes .webm, .gif, .ts or .txt files' });

    const big = { ...RUN, criteria: [{ text: 'x', verdict: 'pass', video: '1-big.webm' }] };
    const dir = runDir(big, { '1-big.webm': '' });
    truncateSync(join(dir, '1-big.webm'), 60 * 1024 * 1024);
    expect(PROOF_FILE_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(refusal(dir)).toEqual({ status: 413, message: '1-big.webm: over 50 MB' });
  });

  it('refuses what the register call would refuse, before anything is sent (400)', () => {
    expect(refusal(runDir('{not json'))).toEqual({ status: 400, message: 'run.json is not a JSON object' });
    expect(refusal(runDir({ ...RUN, commit: 'main' }))?.message).toBe('run.json: commit is the hash of the commit the run proved');
    expect(refusal(runDir({ ...RUN, url: 'ftp://x' }))?.message).toBe('run.json: url is the http(s) address the run was recorded on');
    expect(refusal(runDir({ ...RUN, criteria: [] }))?.message).toBe('run.json: criteria is a list of 1 to 10 {text, verdict, note?, video?, script?}');
    const eleven = { ...RUN, criteria: Array.from({ length: 11 }, () => ({ text: 'x', verdict: 'unfilmable' })) };
    expect(refusal(runDir(eleven))?.status).toBe(400);
    expect(refusal(runDir({ ...RUN, criteria: [{ text: ' ', verdict: 'pass' }] }))?.message).toBe('criterion 1: its text is 1 to 2000 characters');
    expect(refusal(runDir({ ...RUN, criteria: [{ text: 'x', verdict: 'pass', video: '../x.webm' }] }))?.message)
      .toBe('criterion 1: its video is a file name in the run folder');
  });
});
