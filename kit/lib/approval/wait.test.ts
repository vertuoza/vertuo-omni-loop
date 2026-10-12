// forgetWait (PRD 1322): an interrupted `omni wait approval` removes its waiting file, so the HUD
// stops showing a wait nobody runs any more.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { parsePrd } from '../ids.ts';
import { forgetWait } from './wait.ts';

describe('forgetWait', () => {
  it("removes the PRD's waiting file, and leaves another PRD's", () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const dir = join(root, '.omni-loop/local/approval-wait');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '918.json'), '{}\n');
    writeFileSync(join(dir, '919.json'), '{}\n');
    forgetWait(root, parsePrd(918));
    expect(existsSync(join(dir, '918.json'))).toBe(false);
    expect(existsSync(join(dir, '919.json'))).toBe(true);
  });

  it('is quiet when there is no file', () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    expect(() => { forgetWait(root, parsePrd(918)); }).not.toThrow();
  });
});
