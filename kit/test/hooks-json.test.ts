// The plugin's hooks.json stays as it was when the hook-free commands came (PRD 1831): Claude keeps
// every hook, each command and its timeout, byte for byte. The commands any agent runs from a shell
// sit beside these hooks; they never replace one. A change here is a change to what every Claude
// session runs, and is made on purpose, in this test too.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const HOOKS = join(repoRoot, 'kit/plugin/hooks/hooks.json');

/** A hook command: the kit's CLI in the project, never failing the session. */
const omni = (args: string): string => `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" ${args} || true`;

const EXPECTED = {
  SessionStart: [
    { hooks: [{ type: 'command', command: omni('constituents'), timeout: 10 }] },
    { hooks: [{ type: 'command', command: omni('kb index'), timeout: 10 }] },
    { hooks: [{ type: 'command', command: omni('sync --background'), timeout: 10 }] },
    { hooks: [{ type: 'command', command: omni('worktrees hint'), timeout: 10 }] },
  ],
  PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: omni('ask hook pre'), timeout: 600 }] }],
  PostToolUse: [
    { matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: omni('ask hook post') }] },
    { matcher: '*', hooks: [{ type: 'command', command: omni('heartbeat'), timeout: 10 }] },
  ],
  UserPromptSubmit: [{ hooks: [{ type: 'command', command: omni('ask hook prompt') }] }],
  SessionEnd: [
    { hooks: [{ type: 'command', command: omni('ask hook end') }] },
    { hooks: [{ type: 'command', command: omni('heartbeat --end'), timeout: 10 }] },
  ],
};

describe('the plugin\'s hooks.json (PRD 1831)', () => {
  it('holds exactly today\'s hooks, commands and timeouts', () => {
    const file: unknown = JSON.parse(readFileSync(HOOKS, 'utf8'));
    expect(file).toEqual({ description: expect.any(String) as unknown, hooks: EXPECTED });
  });
});
