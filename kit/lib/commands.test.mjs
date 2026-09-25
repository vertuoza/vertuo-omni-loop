import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands.mjs';

const skillsDir = fileURLToPath(new URL('../plugin/skills', import.meta.url));

describe('COMMANDS', () => {
  it('names each command the way the plugin makes it typeable: /omni:<skill>', () => {
    for (const command of Object.values(COMMANDS)) expect(command).toMatch(/^\/omni:[a-z][a-z-]*$/);
  });

  it('names only skills the plugin ships, except deliver (not built yet)', () => {
    for (const [key, command] of Object.entries(COMMANDS)) {
      if (key === 'deliver') continue;
      const skill = command.slice('/omni:'.length);
      expect(existsSync(join(skillsDir, skill, 'SKILL.md')), `${command} has no skill`).toBe(true);
    }
  });
});
