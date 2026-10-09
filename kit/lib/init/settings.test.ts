import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeRepo } from '../../test/fixture.ts';
import { BIN_FILE } from '../../bin/commands/init.ts';
import { enableHud, HUD_PLUGIN, ownSettingsPaths, SETTINGS_FILE, writeStatusLine } from './settings.ts';

// The spec's key, verbatim (PRD 324, "The install"): what a repository's settings file gains.
const KIT_LINE = {
  type: 'command',
  command: 'node "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/.omni-loop/bin/omni.mjs" statusline',
  refreshInterval: 30,
};
const ONLY_THE_KEY = [
  '{',
  '  "statusLine": {',
  '    "type": "command",',
  '    "command": "node \\"${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/.omni-loop/bin/omni.mjs\\" statusline",',
  '    "refreshInterval": 30',
  '  }',
  '}',
  '',
].join('\n');

/** A settings file's text as Claude Code's own files are laid out: two-space indentation, a final newline. */
const settingsText = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe('writeStatusLine', () => {
  it('creates .claude/settings.json, and its folder, holding exactly the spec\'s key', () => {
    const { root, read } = makeRepo();
    expect(existsSync(join(root, '.claude'))).toBe(false);
    expect(writeStatusLine(root, { bin: BIN_FILE })).toEqual({ path: '.claude/settings.json', outcome: 'wrote' });
    expect(read(SETTINGS_FILE)).toBe(ONLY_THE_KEY);
    expect(JSON.parse(read(SETTINGS_FILE))).toEqual({ statusLine: KIT_LINE });
  });

  it('creates the file in a .claude/ folder that holds other files, and leaves them alone', () => {
    const { root, read } = makeRepo({ files: { '.claude/settings.local.json': '{ "mine": true }\n' } });
    expect(writeStatusLine(root, { bin: BIN_FILE }).outcome).toBe('wrote');
    expect(read(SETTINGS_FILE)).toBe(ONLY_THE_KEY);
    expect(read('.claude/settings.local.json')).toBe('{ "mine": true }\n');
  });

  it('adds the key after the others, each kept in its order and with its value, in two-space JSON with a final newline', () => {
    const before = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] }, enabledPlugins: { 'omni@omni-loop': true }, model: 'opus' };
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: JSON.stringify(before) } });
    expect(writeStatusLine(root, { bin: BIN_FILE }).outcome).toBe('wrote');
    const text = read(SETTINGS_FILE);
    expect(text).toBe(settingsText({ ...before, statusLine: KIT_LINE }));
    const written: unknown = JSON.parse(text);
    expect(typeof written === 'object' && written !== null ? Object.keys(written) : []).toEqual(['hooks', 'enabledPlugins', 'model', 'statusLine']);
  });

  it('keeps the kit\'s own line as it is, byte for byte, even an older one', () => {
    const older = { ...KIT_LINE, refreshInterval: 60 };
    const text = `{\n    "statusLine": ${JSON.stringify(older)},\n    "model": "opus"\n}`;
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
    expect(writeStatusLine(root, { bin: BIN_FILE })).toEqual({ path: SETTINGS_FILE, outcome: 'kept' });
    expect(read(SETTINGS_FILE)).toBe(text);
  });

  it('rewrites the kit\'s own line with force, in its place among the other keys', () => {
    const older = { type: 'command', command: 'node "$(git rev-parse --show-toplevel)/.omni-loop/bin/omni.mjs" statusline --old' };
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: settingsText({ model: 'opus', statusLine: older, hooks: {} }) } });
    expect(writeStatusLine(root, { bin: BIN_FILE, force: true })).toEqual({ path: SETTINGS_FILE, outcome: 'wrote' });
    expect(read(SETTINGS_FILE)).toBe(settingsText({ model: 'opus', statusLine: KIT_LINE, hooks: {} }));
  });

  it('never touches anyone else\'s status line, even with force', () => {
    const theirs = settingsText({ statusLine: { type: 'command', command: 'npx claude-hud' }, model: 'opus' });
    for (const force of [false, true]) {
      const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: theirs } });
      expect(writeStatusLine(root, { bin: BIN_FILE, force })).toEqual({ path: SETTINGS_FILE, outcome: 'foreign' });
      expect(read(SETTINGS_FILE)).toBe(theirs);
    }
  });

  it('reads a status line as the kit\'s only by its command, so one of another shape is someone else\'s', () => {
    for (const statusLine of ['node .omni-loop/bin/omni.mjs statusline', { type: 'command' }, { command: 42 }, null]) {
      const text = settingsText({ statusLine });
      const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
      expect(writeStatusLine(root, { bin: BIN_FILE, force: true }).outcome, JSON.stringify(statusLine)).toBe('foreign');
      expect(read(SETTINGS_FILE)).toBe(text);
    }
  });

  it('leaves a file that is not valid JSON byte-identical, with or without force', () => {
    for (const text of ['{ "model": "opus", }\n', '// settings\n{}\n', '', '{ "statusLine": ']) {
      for (const force of [false, true]) {
        const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
        expect(writeStatusLine(root, { bin: BIN_FILE, force }), JSON.stringify(text)).toEqual({ path: SETTINGS_FILE, outcome: 'invalid' });
        expect(read(SETTINGS_FILE)).toBe(text);
      }
    }
  });

  it('leaves JSON that is not an object of settings as it is, like a file that is not JSON', () => {
    for (const text of ['[]\n', 'null\n', '"statusLine"\n', '42\n']) {
      const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
      expect(writeStatusLine(root, { bin: BIN_FILE, force: true }).outcome, text).toBe('invalid');
      expect(read(SETTINGS_FILE)).toBe(text);
    }
  });

  it('leaves a settings path it cannot read as a file alone, like a file that is not JSON', () => {
    const { root } = makeRepo({ files: { [`${SETTINGS_FILE}/inside`]: 'x\n' } });
    expect(writeStatusLine(root, { bin: BIN_FILE }).outcome).toBe('invalid');
    expect(readdirSync(join(root, SETTINGS_FILE))).toEqual(['inside']);
  });
});

describe('enableHud (PRD 1208)', () => {
  it('names the band\'s plugin by its marketplace id', () => {
    expect(HUD_PLUGIN).toBe('omni-hud@omni-loop');
  });

  it('creates .claude/settings.json, and its folder, turning the band on', () => {
    const { root, read } = makeRepo();
    expect(enableHud(root)).toEqual({ path: SETTINGS_FILE, outcome: 'wrote' });
    expect(read(SETTINGS_FILE)).toBe(settingsText({ enabledPlugins: { 'omni-hud@omni-loop': true } }));
  });

  it('adds the line beside the plugins already there, keeping every other key in its order', () => {
    const before = { model: 'opus', enabledPlugins: { 'omni@omni-loop': true, 'mine@elsewhere': false }, statusLine: KIT_LINE };
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: JSON.stringify(before) } });
    expect(enableHud(root).outcome).toBe('wrote');
    expect(read(SETTINGS_FILE)).toBe(settingsText({ ...before, enabledPlugins: { ...before.enabledPlugins, 'omni-hud@omni-loop': true } }));
  });

  it('adds enabledPlugins last when the file has none', () => {
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: settingsText({ statusLine: KIT_LINE }) } });
    expect(enableHud(root).outcome).toBe('wrote');
    expect(read(SETTINGS_FILE)).toBe(settingsText({ statusLine: KIT_LINE, enabledPlugins: { 'omni-hud@omni-loop': true } }));
  });

  it('keeps the band on as it is, writing nothing', () => {
    const text = '{ "enabledPlugins": { "omni-hud@omni-loop": true } }';
    const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
    expect(enableHud(root)).toEqual({ path: SETTINGS_FILE, outcome: 'kept' });
    expect(read(SETTINGS_FILE)).toBe(text);
  });

  it('never touches a value someone else set, nor an enabledPlugins that is not an object', () => {
    for (const enabledPlugins of [{ 'omni-hud@omni-loop': false }, { 'omni-hud@omni-loop': 'yes' }, [], 'all', null]) {
      const text = settingsText({ enabledPlugins });
      const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
      expect(enableHud(root), JSON.stringify(enabledPlugins)).toEqual({ path: SETTINGS_FILE, outcome: 'theirs' });
      expect(read(SETTINGS_FILE)).toBe(text);
    }
  });

  it('commits the settings file once while either of the kit\'s lines is in it, and never otherwise', () => {
    const at = (outcome: string) => ({ path: SETTINGS_FILE, outcome });
    expect(ownSettingsPaths([at('wrote'), at('kept')])).toEqual([SETTINGS_FILE]);
    expect(ownSettingsPaths([at('foreign'), at('wrote')])).toEqual([SETTINGS_FILE]);
    expect(ownSettingsPaths([at('kept'), at('theirs')])).toEqual([SETTINGS_FILE]);
    expect(ownSettingsPaths([at('foreign'), at('theirs')])).toEqual([]);
    expect(ownSettingsPaths([at('invalid'), at('invalid')])).toEqual([]);
  });

  it('leaves a file that holds no JSON object byte-identical', () => {
    for (const text of ['{ "model": "opus", }\n', '[]\n', '']) {
      const { root, read } = makeRepo({ files: { [SETTINGS_FILE]: text } });
      expect(enableHud(root).outcome, JSON.stringify(text)).toBe('invalid');
      expect(read(SETTINGS_FILE)).toBe(text);
    }
  });
});
