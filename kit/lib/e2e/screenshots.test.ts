import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { screenshotsFor } from './screenshots.ts';

const repo = () => mkdtempSync(join(tmpdir(), 'shots-'));

describe('screenshotsFor', () => {
  it('says no artifacts were kept when the folder is missing or holds no trace', () => {
    const root = repo();
    expect(screenshotsFor(root, 'e2e').after.reason).toContain('kept no artifacts');
    mkdirSync(join(root, 'e2e/.e2e/artifacts/web/t/default'), { recursive: true });
    writeFileSync(join(root, 'e2e/.e2e/artifacts/web/t/default/note.txt'), 'x');
    expect(screenshotsFor(root, 'e2e').after.reason).toContain('kept no artifacts');
  });

  it('says a trace is not a screenshot per step when one trace.zip exists', () => {
    const root = repo();
    mkdirSync(join(root, 'e2e/.e2e/artifacts/web/t/default/attempt-0/trace'), { recursive: true });
    writeFileSync(join(root, 'e2e/.e2e/artifacts/web/t/default/attempt-0/trace/trace.zip'), 'x');
    const { before, after } = screenshotsFor(root, 'e2e');
    expect(after).toEqual({ kept: false, reason: expect.stringContaining('one trace per attempt') });
    expect(before).toEqual({ kept: false, reason: expect.stringContaining('merge-base') });
  });
});
