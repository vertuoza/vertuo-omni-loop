import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LOCAL_DIR } from '../ask/local-state.ts';
import { FleetMessagesSchema, FROM_YOUR_PEOPLE_FILE, handFleetMessages } from './fleet-messages.ts';

const made: string[] = [];
function worktree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'fleet-messages-'));
  made.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const MESSAGES = [
  { author: 'ana', at: '2026-11-20T09:20:00Z', text: 'Keep the old route until Friday.' },
  { author: 'bo', at: '2026-11-20T10:05:00Z', text: 'The demo is Monday.\nShow the rail first.' },
];

describe('the runner hands a job its fleet messages (PRD 3107 s3)', () => {
  it('leaves them, oldest first, where omni session start reads them, in a folder git ignores', () => {
    const root = worktree();
    expect(handFleetMessages(root, MESSAGES)).toBeNull();
    expect(FleetMessagesSchema.parse(JSON.parse(readFileSync(join(root, FROM_YOUR_PEOPLE_FILE), 'utf8')))).toEqual(MESSAGES);
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('leaves no file for a job that carries none, and removes one an earlier job left', () => {
    const root = worktree();
    expect(handFleetMessages(root, [])).toBeNull();
    expect(existsSync(join(root, FROM_YOUR_PEOPLE_FILE))).toBe(false);
    handFleetMessages(root, MESSAGES);
    expect(handFleetMessages(root, [])).toBeNull();
    expect(existsSync(join(root, FROM_YOUR_PEOPLE_FILE))).toBe(false);
  });

  it('answers why when the file cannot be written, and throws nothing', () => {
    const root = worktree();
    writeFileSync(join(root, '.omni-loop'), 'a file where the folder should be');
    expect(handFleetMessages(root, MESSAGES)).toEqual(expect.any(String));
  });
});
