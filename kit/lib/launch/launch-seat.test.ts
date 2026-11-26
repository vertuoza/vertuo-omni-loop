// The launcher and the Supervisor's seat (#3328): the seat thinks in a folder of its own that is no checkout, and its
// tools server is `omni supervisor mcp`, which the launcher must run there.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planLaunch } from './launch.ts';

const SELF = '/global/lib/omni.mjs';

describe('planLaunch', () => {
  it('runs the Supervisor seat\'s tools in the folder of its own the runner thinks in, which is no checkout (#3328)', () => {
    const seatFolder = mkdtempSync(join(tmpdir(), 'omni-supervisor-'));
    const argv = ['supervisor', 'mcp', '--runner', 'r1', '--page', 'https://omni.example'];
    expect(planLaunch(argv, { cwd: seatFolder, self: SELF })).toEqual({ kind: 'self' });
  });
});
