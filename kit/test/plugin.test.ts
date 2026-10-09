// The `omni` plugin's guard: its skills parse, name only commands the CLI has, sign the loop's work,
// and its manifests agree. Each rule runs on the live repository, then on a fixture built to break it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.ts';
import { STAGE_ORDER, STAGE_WORDS } from '../lib/status/format.ts';
import { dig } from '../bin/dig.ts';
import { assertDefined } from './assert.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PLUGIN_DIR = 'kit/plugin';
const MARKETPLACE = '.claude-plugin/marketplace.json';
const MANIFEST = '.claude-plugin/plugin.json';

// `omni.mjs <cmd>` (a Bash step) and `` `omni <cmd>` `` (prose). `/omni:<skill>` never matches.
const COMMAND_MENTIONS = [/omni\.mjs\s+([a-z][\w-]*)/g, /`omni\s+([a-z][\w-]*)/g];

function skillFiles(root: string) {
  const skills = join(root, PLUGIN_DIR, 'skills');
  if (!existsSync(skills)) return [];
  return readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PLUGIN_DIR, 'skills', entry.name, 'SKILL.md'));
}

/** A value YAML or JSON parsed into an object (a list included), whose fields are read one by one. */
const isFields = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function frontmatter(text: string): Record<string, unknown> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  try {
    const data: unknown = parseYaml(String(match[1]));
    return isFields(data) ? data : null;
  } catch {
    return null;
  }
}

/** Every SKILL.md has frontmatter with a non-empty `name` and `description`. */
function skillFrontmatterViolations(root: string) {
  const out = [];
  for (const file of skillFiles(root)) {
    if (!existsSync(join(root, file))) {
      out.push(`${file}: missing`);
      continue;
    }
    const data = frontmatter(readFileSync(join(root, file), 'utf8'));
    if (!data) {
      out.push(`${file}: no parseable frontmatter`);
      continue;
    }
    for (const key of ['name', 'description']) {
      const value = data[key];
      if (typeof value !== 'string' || value.trim() === '') out.push(`${file}: frontmatter lacks ${key}`);
    }
  }
  return out;
}

/** Skill names the plugin retired, and the skill that replaced each (PRD #68). */
const RETIRED_SKILLS: Record<string, string> = { terraform: 'invade' };

/** No skill folder, and no SKILL.md `name`, uses a retired skill name. */
function retiredSkillViolations(root: string) {
  const out: string[] = [];
  for (const file of skillFiles(root)) {
    const folder = String(file.split('/').at(-2));
    if (Object.hasOwn(RETIRED_SKILLS, folder)) out.push(`${file}: the ${folder} skill was renamed ${RETIRED_SKILLS[folder]}`);
    const data = existsSync(join(root, file)) ? frontmatter(readFileSync(join(root, file), 'utf8')) : null;
    const name = data?.name;
    if (typeof name === 'string' && Object.hasOwn(RETIRED_SKILLS, name) && name !== folder) {
      out.push(`${file}: names itself ${name}, renamed ${RETIRED_SKILLS[name]}`);
    }
  }
  return out;
}

/** Every `omni <command>` a text names, in both mention forms, in the order they appear per form. */
function commandMentions(text: string): string[] {
  return COMMAND_MENTIONS.flatMap((pattern) => [...text.matchAll(pattern)].map(([, name]) => String(name)));
}

/** Every `omni <command>` a SKILL.md names is a key of the command table. */
function unknownCommandViolations(root: string, commands: object) {
  const out: string[] = [];
  for (const file of skillFiles(root)) {
    if (!existsSync(join(root, file))) continue;
    readFileSync(join(root, file), 'utf8').split('\n').forEach((line, index) => {
      for (const name of commandMentions(line)) {
        if (!Object.hasOwn(commands, name)) out.push(`${file}:${index + 1}: names omni ${name}, which the CLI lacks`);
      }
    });
  }
  return out;
}

/** The `## <heading>` section of a SKILL.md whose heading starts with `start`, up to the next one. */
function skillSection(text: string, start: string) {
  const lines = text.split('\n');
  const from = lines.findIndex((line: string) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line: string, index: number) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
}

/** The last non-blank line of a section's last fenced block, or null when it has none. */
function lastFencedLine(section: string) {
  let open = false;
  let block = [];
  let last = null;
  for (const line of section.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (open) last = block.filter((text) => text.trim() !== '').at(-1)?.trim() ?? null;
      open = !open;
      block = [];
    } else if (open) block.push(line);
  }
  return last;
}

// OmniMan signs the loop's work (PRD #99). A skill that asks for the session's co-author trailer
// asks for the signature's trailer too, and one that opens a pull request or an issue, or rewrites
// its body, asks for the footer. A comment is never signed, so commenting alone asks for nothing.
const ASKS_FOR_TRAILER = /co-author/i;
const WRITES_A_BODY = [
  /\bgh\s+(?:pr|issue)\s+create\b/,
  /\bgh\s+(?:pr|issue)\s+edit\b[^\n]*--body/,
  // "Open the feature PR as a draft", "open it through `/omni:pr`'s lifecycle as a phase-0 PR" (across
  // a line break); not "opens the question in the pull request's outbox comment".
  /\b[Oo]pen(?:s|ing)?\s+(?:it|the|a|an|one|its)\b(?:(?!\b(?:in|on)\b)[^.]){0,60}?(?:\bPRs?\b|\bpull requests?\b|\bissues?\b)/,
];
const namesSign = (line: string) => new RegExp(`(?:\`omni|omni\\.mjs)\\s+sign\\s+${line}\\b`);

/**
 * Every SKILL.md that asks for the co-author trailer names `omni sign trailer`, and every one that
 * opens a pull request or an issue, or rewrites its body, names `omni sign footer`.
 */
function signingViolations(root: string) {
  const out = [];
  for (const file of skillFiles(root)) {
    if (!existsSync(join(root, file))) continue;
    const text = readFileSync(join(root, file), 'utf8');
    if (ASKS_FOR_TRAILER.test(text) && !namesSign('trailer').test(text)) {
      out.push(`${file}: asks for the co-author trailer but never names omni sign trailer`);
    }
    if (WRITES_A_BODY.some((pattern) => pattern.test(text)) && !namesSign('footer').test(text)) {
      out.push(`${file}: opens a pull request or an issue but never names omni sign footer`);
    }
  }
  return out;
}

function readJson(root: string, file: string, out: string[]): unknown {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(root, file), 'utf8'));
    return parsed;
  } catch (caught) {
    const error = caught as NodeJS.ErrnoException;
    out.push(`${file}: ${error.code === 'ENOENT' ? 'missing' : `does not parse (${error.message})`}`);
    return null;
  }
}

/** The marketplace lists the plugin in `pluginDir` by its relative source, and both manifests give it one name. */
function manifestViolations(root: string, pluginDir = PLUGIN_DIR) {
  const out: string[] = [];
  const manifestFile = join(pluginDir, MANIFEST);
  const manifest = readJson(root, manifestFile, out);
  const marketplace = readJson(root, MARKETPLACE, out);
  if (!manifest || !marketplace) return out;
  const plugins = dig(marketplace, 'plugins') ?? [];
  if (!Array.isArray(plugins)) return [...out, `${MARKETPLACE}: plugins is not a list`];
  const entry: unknown = plugins.find((plugin: unknown) => {
    const source = dig(plugin, 'source');
    return typeof source === 'string' && resolve(root, source) === resolve(root, pluginDir);
  });
  if (!entry) return [...out, `${MARKETPLACE}: no plugin entry has source ./${pluginDir}`];
  const entryName = dig(entry, 'name');
  const manifestName = dig(manifest, 'name');
  if (entryName !== manifestName) {
    out.push(`${MARKETPLACE}: entry names the plugin "${String(entryName)}", ${manifestFile} names it "${String(manifestName)}"`);
  }
  return out;
}

function onPath(command: string) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

/** `claude plugin validate <path>`: `null` when it passes, its output when it does not. */
function claudeValidate(path: string) {
  const run = spawnSync('claude', ['plugin', 'validate', path], { encoding: 'utf8' });
  return run.status === 0 ? null : `${run.stdout}${run.stderr}`;
}

function fixture(files: Record<string, string | undefined>) {
  const root = mkdtempSync(join(tmpdir(), 'omni-plugin-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text as string);
  }
  return root;
}

const claude = onPath('claude');
const reason = claude ? '' : ' (skipped: claude is not on PATH)';
// Vitest's reporters do not list skipped tests by name, so the reason is also said out loud.
if (!claude) console.warn('kit/test/plugin.test.ts: claude plugin validate checks skipped — claude is not on PATH');

const SKILL = '---\nname: sample\ndescription: A sample skill.\n---\n\nRun `node .omni-loop/bin/omni.mjs config`.\n';
const GOOD = {
  [MARKETPLACE]: JSON.stringify({ name: 'm', owner: { name: 'o' }, plugins: [{ name: 'omni', source: './kit/plugin' }] }),
  [join(PLUGIN_DIR, MANIFEST)]: JSON.stringify({ name: 'omni', description: 'd', version: '0.0.0' }),
  [join(PLUGIN_DIR, 'skills/sample/SKILL.md')]: SKILL,
};

describe('the omni plugin in this repository', () => {
  it('every SKILL.md has a name and a description', () => {
    expect(skillFrontmatterViolations(repoRoot)).toEqual([]);
  });

  it('every omni command a SKILL.md names exists', () => {
    expect(unknownCommandViolations(repoRoot, COMMAND_TABLE)).toEqual([]);
  });

  it('every SKILL.md that commits, or opens a pull request or an issue, signs it', () => {
    expect(signingViolations(repoRoot)).toEqual([]);
  });

  it('plugin.json and marketplace.json parse and agree on the name', () => {
    expect(manifestViolations(repoRoot)).toEqual([]);
  });

  it('no skill carries a retired name, and /omni:invade is there', () => {
    expect(retiredSkillViolations(repoRoot)).toEqual([]);
    expect(frontmatter(readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/invade/SKILL.md'), 'utf8'))?.name).toBe('invade');
  });

  // PRD 774: invade drafts nothing of the business itself; its hand-off points at the page that does.
  it("/omni:invade's hand-off names Settings › Business › Draft from my repos", () => {
    const handOff = skillSection(readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/invade/SKILL.md'), 'utf8'), 'Hand off');
    expect(handOff).toContain('Settings › Business › Draft from my repos');
  });

  it.skipIf(!claude)(`claude plugin validate passes on the plugin and the marketplace${reason}`, () => {
    expect(claudeValidate(join(repoRoot, PLUGIN_DIR))).toBeNull();
    expect(claudeValidate(repoRoot)).toBeNull();
  });

  it('the repository shim runs the live CLI', () => {
    const shim = join(repoRoot, '.omni-loop/bin/omni.mjs');
    const config = spawnSync(process.execPath, [shim, 'config', 'kit'], { cwd: repoRoot, encoding: 'utf8' });
    expect(config.stderr).toBe('');
    expect(config.status).toBe(0);
    expect(config.stdout).toBe('1\n');
    const unknown = spawnSync(process.execPath, [shim, 'no-such-command'], { cwd: repoRoot, encoding: 'utf8' });
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toMatch(/^usage: omni/);
  });
});

// PRD 1208: the `omni-hud` mod, the band above the prompt, is a plugin of its own beside `omni`. Its
// tests import Claude Code's own test kit, so `claude plugin test` runs them and vitest never does.
describe('the omni-hud plugin in this repository', () => {
  const HUD_DIR = 'kit/plugin-hud';
  const version = (dir: string) => dig(JSON.parse(readFileSync(join(repoRoot, dir, MANIFEST), 'utf8')), 'version');

  it('the marketplace lists it beside omni, by its source, under its manifest name', () => {
    expect(manifestViolations(repoRoot, HUD_DIR)).toEqual([]);
    const plugins = dig(JSON.parse(readFileSync(join(repoRoot, MARKETPLACE), 'utf8')), 'plugins');
    expect(Array.isArray(plugins) ? plugins.map((plugin: unknown) => [dig(plugin, 'name'), dig(plugin, 'source')]) : plugins).toEqual([
      ['omni', './kit/plugin'],
      ['omni-hud', './kit/plugin-hud'],
    ]);
  });

  it('carries the version of omni, which the release stamps in both', () => {
    expect(version(HUD_DIR)).toBe(version(PLUGIN_DIR));
  });

  it('names its hooks module, and vitest collects none of its tests', () => {
    expect(JSON.parse(readFileSync(join(repoRoot, HUD_DIR, 'hooks/hooks.json'), 'utf8'))).toEqual({ modules: ['./register.tsx'] });
    // Read as text: a kit test never imports the repository's config (scripts/import-guard.test.ts).
    const exclude = /^\s*exclude: \[(.*)\],$/m.exec(readFileSync(join(repoRoot, 'vitest.config.ts'), 'utf8'))?.[1] ?? '';
    expect(exclude).toContain(`'${HUD_DIR}/**'`);
  });

  it.skipIf(!claude)(`claude plugin validate and claude plugin test pass on it${reason}`, () => {
    expect(claudeValidate(join(repoRoot, HUD_DIR))).toBeNull();
    const run = spawnSync('claude', ['plugin', 'test', join(repoRoot, HUD_DIR)], { encoding: 'utf8' });
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
  });
});

// PRD 216: two small skills each wrap one verb of `omni dossier`, and the brainstorm and the plan
// follow them at the steps the spec names, each after what it must come after.
describe('the dossier skills in this repository', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const expectAfter = (text: string, anchor: string, mention: string) => {
    expect(text, `names ${anchor}`).toContain(anchor);
    expect(text.indexOf(mention, text.indexOf(anchor)), `${mention} after ${anchor}`).toBeGreaterThan(-1);
  };

  it('each wraps one verb of omni dossier, names no other command, and says what each exit code means', () => {
    for (const [skill, verb] of Object.entries({ 'dossier-open': 'open', 'dossier-push': 'push' })) {
      const text = read(skill);
      expect(frontmatter(text)?.name).toBe(skill);
      expect(new Set(commandMentions(text)), skill).toEqual(new Set(['dossier']));
      expect(text).toContain(`omni.mjs dossier ${verb}`);
      for (const code of ['0', '1', '2']) expect(text, `${skill}: exit ${code}`).toMatch(new RegExp(`^\\| \`${code}\``, 'm'));
    }
  });

  it('the brainstorm follows them after the briefing, the push and the phase-0 push; the plan after it pushes plan.md', () => {
    const brainstorm = read('brainstorm');
    expectAfter(skillSection(brainstorm, 'Step 0'), 'kb show briefing', '/omni:dossier-open');
    expectAfter(skillSection(brainstorm, '7.'), 'git push -u', '/omni:dossier-push');
    expectAfter(skillSection(brainstorm, '9.'), 'git push -u <remote> <phase-0 branch>', '/omni:dossier-push');
    expectAfter(skillSection(read('plan'), '6.'), 'git push -u', '/omni:dossier-push');
  });

  // PRD 627: a fix is a dossier with a kind. Both fix skills push theirs after they push the fix
  // branch, print its page, and open no PRD, inbox folder, plan or outbox item; the visual fix keeps
  // every round of variations and the pick line.
  it('the push takes --kind, and both fix skills follow it after their push, with their kind (PRD 627)', () => {
    expect(read('dossier-push')).toContain('omni.mjs dossier push <n> --kind <kind>');
    const visual = read('visual-fix');
    const bug = read('bug-fix');
    expectAfter(skillSection(visual, '9.'), 'git push -u <remote> <fix branch>', '/omni:dossier-push <n> --kind visual');
    expectAfter(skillSection(bug, '12.'), 'git push -u <remote> <fix branch>', '/omni:dossier-push <n> --kind bug');
    for (const [name, text, kind] of [['visual-fix', visual, 'visual'], ['bug-fix', bug, 'bug']]) {
      expect(text, name).toContain(`omni.mjs dossier link <n> --kind ${kind}`);
      expect(text, name).toContain('Never open a PRD, an inbox folder, a plan or an outbox item');
      expect(text, name).not.toMatch(/\bdossier, an inbox folder\b|\bno PRD, dossier\b/i);
    }
  });

  it('the visual fix commits every round shown as variations-r<k>.html and the pick line (PRD 627)', () => {
    const visual = read('visual-fix');
    expect(skillSection(visual, '8.')).toContain('variations-r<k>.html');
    expect(visual).toContain('<p data-omni-pick>Picked <letter> by @<login> on <YYYY-MM-DD></p>');
    expect(skillSection(visual, '9.')).toMatch(/## The pick\n\n\s*<p data-omni-pick>/);
    expect(visual).toContain('gh api user --jq .login');
    expect(visual).not.toContain('never write the variations page into the repository');
  });
});

// PRD 315: `/omni:status` is a thin skill, like `/omni:ask`. It runs a bare `omni status`, the
// repository's overview, adding `--fetch` only when the person asks for fresh data, and prints the
// output as is in a text block. It never runs the outbox gate, `omni status` with a PRD number.
// `omni status` or `omni.mjs status` followed, on its line, by a PRD, a placeholder or a gate flag.
const GATE_RUN = /\bomni(?:\.mjs)?[ \t]+status[ \t]+(?:<|\d|--(?:labels|base|changes)\b)/;

/** Every line of a text that runs the outbox gate, or shows how to, as `<line>: <text>`. */
function gateRuns(text: string) {
  return text.split('\n').flatMap((line: string, index: number) => (GATE_RUN.test(line) ? [`${index + 1}: ${line.trim()}`] : []));
}

describe('the status skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/status/SKILL.md'), 'utf8');

  it('is named status, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('status');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:status"/);
  });

  it('runs a bare omni status, adds --fetch for fresh data only, and names no other command but dossier link', () => {
    const text = read();
    expect(new Set(commandMentions(text))).toEqual(new Set(['status', 'dossier']));
    expect(text).toMatch(/omni\.mjs dossier link <n>/);
    expect(text).toMatch(/^node \.omni-loop\/bin\/omni\.mjs status$/m);
    expect(text).toMatch(/^node \.omni-loop\/bin\/omni\.mjs status --fetch$/m);
    expect(text).toContain('fresh data');
  });

  it('never runs the gate: no omni status < form, and no PRD number or gate flag after it', () => {
    const text = read();
    expect(text).toContain('omni status');
    expect(text).not.toContain('omni status <');
    expect(gateRuns(text)).toEqual([]);
  });

  it('prints the output as is, in a text block', () => {
    const text = read();
    expect(text).toContain('as is');
    expect(text).toMatch(/^```text$/m);
  });

  it('the gate check flags every form of the gate, and none of the overview', () => {
    const text = [
      'Run `node .omni-loop/bin/omni.mjs status`, or `omni status --fetch` for fresh data.',
      'It runs omni status alone, never /omni:status 7.',
      'node .omni-loop/bin/omni.mjs status <prd>',
      'Run `omni status 315`.',
      'Or `omni status --labels a,b`, then omni.mjs status --changes.',
      'Or `omni status  --base origin/main`.',
    ].join('\n');
    expect(gateRuns(text)).toEqual([
      '3: node .omni-loop/bin/omni.mjs status <prd>',
      '4: Run `omni status 315`.',
      '5: Or `omni status --labels a,b`, then omni.mjs status --changes.',
      '6: Or `omni status  --base origin/main`.',
    ]);
  });
});

// PRD 315: `/omni:help` is a thin skill too. It runs `omni help`, passing the name the person gave
// when there is one, prints the output as is in a text block, and names no other command.
describe('the help skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/help/SKILL.md'), 'utf8');

  it('is named help, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('help');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:help"/);
  });

  it('runs omni help, alone or with the name the person gave, and names no other command', () => {
    const text = read();
    expect(new Set(commandMentions(text))).toEqual(new Set(['help']));
    expect(text).toMatch(/^node \.omni-loop\/bin\/omni\.mjs help$/m);
    expect(text).toMatch(/^node \.omni-loop\/bin\/omni\.mjs help <name>$/m);
    expect(text).toContain('the name the person gave');
  });

  it('prints the output as is, in a text block', () => {
    const text = read();
    expect(text).toContain('as is');
    expect(text).toMatch(/^```text$/m);
  });
});

// PRD 251: when its gate ends red and `answers.enabled` is on, `/omni:yolo` asks one opening
// question, once the outbox comment, the draft and the status comment are written (the end of step
// 6, Release). Answering here runs `omni answers`; answering here or elsewhere carries on into
// `/omni:yolo-fix` steps 2 to 7. The hand-off stays step 7, which `/omni:yolo-fix` names.
describe('the terminal door in /omni:yolo', () => {
  const yolo = readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/yolo/SKILL.md'), 'utf8');
  const HEADING = '### Answer here, when the gate ends red';
  const door = (() => {
    const from = yolo.indexOf(HEADING);
    if (from < 0) return '';
    const to = yolo.indexOf('\n## ', from);
    return yolo.slice(from, to < 0 ? undefined : to);
  })();

  it('opens only on a red gate with the switch on, after the outbox comment and the status comment', () => {
    expect(door, 'a section of its own').not.toBe('');
    expect(door).toContain('answers.enabled');
    expect(door).toMatch(/gate (?:is |read |ended |ends )?red/i);
    expect(skillSection(yolo, '6. Release'), 'inside step 6, after the final status comment').toContain(HEADING);
    expect(yolo.indexOf(HEADING)).toBeGreaterThan(yolo.indexOf('omni.mjs comment --prd'));
    expect(yolo.indexOf(HEADING)).toBeGreaterThan(yolo.indexOf('final status comment'));
    expect(yolo.indexOf(HEADING)).toBeLessThan(yolo.indexOf('## 7. Hand off'));
  });

  it('asks one opening question with the three choices', () => {
    for (const choice of ['Answer here now', 'carry on', 'Later — stop here']) expect(door, choice).toContain(choice);
    expect(door).toContain('AskUserQuestion');
  });

  it('asks through omni answers ask, posts through omni answers post, and falls back on --print', () => {
    expect(door).toContain('omni.mjs answers ask');
    expect(door).toContain('omni.mjs answers post');
    expect(door).toContain('--print');
    expect(door).toMatch(/prose/);
    expect(door.indexOf('answers post')).toBeGreaterThan(door.indexOf('answers ask'));
  });

  it('never asks a medium', () => {
    expect(door).toMatch(/mediums? (?:are|is) never asked/i);
  });

  it('carries on into /omni:yolo-fix steps 2 to 7 in the same run, and ends with its hand-off', () => {
    expect(door).toMatch(/`\/omni:yolo-fix` steps 2 to 7/);
    expect(door.indexOf('steps 2 to 7')).toBeGreaterThan(door.indexOf('answers post'));
    expect(door).toMatch(/`\/omni:yolo-fix` step 8/);
  });

  it('with the switch off, the red gate reads as before: the hand-off says to answer on the pull request', () => {
    expect(door).toMatch(/`answers\.enabled` is (?:off|false)[^.]*(?:step 7|hand-off)/);
  });

  it('keeps "never ask" true along the way, naming the one question at the end', () => {
    const guardrails = skillSection(yolo, 'Guardrails');
    expect(guardrails).toContain('Never ask along the way');
    expect(guardrails).toContain('answers.enabled');
    expect(yolo).not.toMatch(/\*\*It asks nothing\.\*\*/);
  });
});

describe('the plugin guard catches what it is for', () => {
  it('passes a well-formed fixture and one with no skills', () => {
    const good = fixture(GOOD);
    expect(skillFrontmatterViolations(good)).toEqual([]);
    expect(unknownCommandViolations(good, COMMAND_TABLE)).toEqual([]);
    expect(manifestViolations(good)).toEqual([]);
    const bare = fixture({ [MARKETPLACE]: GOOD[MARKETPLACE], [join(PLUGIN_DIR, MANIFEST)]: GOOD[join(PLUGIN_DIR, MANIFEST)] });
    expect(skillFrontmatterViolations(bare)).toEqual([]);
    expect(unknownCommandViolations(bare, COMMAND_TABLE)).toEqual([]);
  });

  it('flags a skill without frontmatter, and one missing a description', () => {
    const root = fixture({
      ...GOOD,
      [join(PLUGIN_DIR, 'skills/bare/SKILL.md')]: '# no frontmatter\n',
      [join(PLUGIN_DIR, 'skills/half/SKILL.md')]: '---\nname: half\n---\nbody\n',
      [join(PLUGIN_DIR, 'skills/empty/.keep')]: '',
    });
    expect(skillFrontmatterViolations(root)).toEqual([
      'kit/plugin/skills/bare/SKILL.md: no parseable frontmatter',
      'kit/plugin/skills/empty/SKILL.md: missing',
      'kit/plugin/skills/half/SKILL.md: frontmatter lacks description',
    ]);
  });

  it('flags a skill named terraform, by its folder or by its name', () => {
    expect(retiredSkillViolations(fixture(GOOD))).toEqual([]);
    const root = fixture({
      ...GOOD,
      [join(PLUGIN_DIR, 'skills/terraform/SKILL.md')]: '---\nname: terraform\ndescription: d\n---\n',
      [join(PLUGIN_DIR, 'skills/fill/SKILL.md')]: '---\nname: terraform\ndescription: d\n---\n',
    });
    expect(retiredSkillViolations(root)).toEqual([
      'kit/plugin/skills/fill/SKILL.md: names itself terraform, renamed invade',
      'kit/plugin/skills/terraform/SKILL.md: the terraform skill was renamed invade',
    ]);
  });

  it('flags a command the CLI lacks, in both mention forms, and ignores /omni:<skill>', () => {
    const body = [
      '---', 'name: s', 'description: d', '---',
      'Run `node .omni-loop/bin/omni.mjs frobnicate 7`.',
      'Then `omni teleport --now`.',
      'Then /omni:wave and `omni status 7`.',
    ].join('\n');
    const root = fixture({ ...GOOD, [join(PLUGIN_DIR, 'skills/s/SKILL.md')]: body });
    expect(unknownCommandViolations(root, COMMAND_TABLE)).toEqual([
      'kit/plugin/skills/s/SKILL.md:5: names omni frobnicate, which the CLI lacks',
      'kit/plugin/skills/s/SKILL.md:6: names omni teleport, which the CLI lacks',
    ]);
  });

  it('flags a skill that commits, opens or rewrites without naming omni sign, and one that drops either line', () => {
    const skill = (name: string, ...lines: string[]) => ['---', `name: ${name}`, 'description: d', '---', ...lines].join('\n');
    const COMMITS = 'Commit it, ending with the co-author trailer your session requires.';
    const root = fixture({
      ...GOOD,
      [join(PLUGIN_DIR, 'skills/commits/SKILL.md')]: skill('commits', COMMITS),
      [join(PLUGIN_DIR, 'skills/issues/SKILL.md')]: skill('issues', 'Run `gh issue create --title "PRD: <title>" --body-file <file>`.'),
      [join(PLUGIN_DIR, 'skills/opens/SKILL.md')]: skill('opens', 'Run `gh pr create --draft --base <feature branch>`.'),
      [join(PLUGIN_DIR, 'skills/delegates/SKILL.md')]: skill('delegates', "Open it through `/omni:pr`'s lifecycle,", 'as a standalone PR.'),
      [join(PLUGIN_DIR, 'skills/rewrites/SKILL.md')]: skill('rewrites', 'Tick the slice: `gh pr edit <n> --body-file <file>`.'),
      [join(PLUGIN_DIR, 'skills/no-footer/SKILL.md')]: skill('no-footer', `${COMMITS} Then the \`omni sign trailer\` line.`, 'Open the feature PR as a draft.'),
      [join(PLUGIN_DIR, 'skills/no-trailer/SKILL.md')]: skill(
        'no-trailer', COMMITS, 'Open the feature PR, its body ending with the line `node .omni-loop/bin/omni.mjs sign footer` prints.',
      ),
    });
    expect(signingViolations(root)).toEqual([
      'kit/plugin/skills/commits/SKILL.md: asks for the co-author trailer but never names omni sign trailer',
      'kit/plugin/skills/delegates/SKILL.md: opens a pull request or an issue but never names omni sign footer',
      'kit/plugin/skills/issues/SKILL.md: opens a pull request or an issue but never names omni sign footer',
      'kit/plugin/skills/no-footer/SKILL.md: opens a pull request or an issue but never names omni sign footer',
      'kit/plugin/skills/no-trailer/SKILL.md: asks for the co-author trailer but never names omni sign trailer',
      'kit/plugin/skills/opens/SKILL.md: opens a pull request or an issue but never names omni sign footer',
      'kit/plugin/skills/rewrites/SKILL.md: opens a pull request or an issue but never names omni sign footer',
    ]);
  });

  it('passes a skill that signs both, and asks nothing of one that only comments', () => {
    const skill = (name: string, ...lines: string[]) => ['---', `name: ${name}`, 'description: d', '---', ...lines].join('\n');
    const root = fixture({
      ...GOOD,
      [join(PLUGIN_DIR, 'skills/signed/SKILL.md')]: skill(
        'signed',
        'Commit it, ending with the co-author trailer your session requires, then the `omni sign trailer` line.',
        'Run `gh pr create --draft`, the body ending with the line `node .omni-loop/bin/omni.mjs sign footer` prints.',
      ),
      [join(PLUGIN_DIR, 'skills/comments/SKILL.md')]: skill(
        'comments',
        'Post `gh pr comment <n> --body-file <file>`, then `gh issue comment <n> --body-file <file>`.',
        "The intro opens the question in the pull request's outbox comment.",
        'Label it: `gh pr edit <n> --add-label "<name>"`. Leave the feature PR open.',
      ),
    });
    expect(signingViolations(root)).toEqual([]);
    expect(unknownCommandViolations(root, COMMAND_TABLE)).toEqual([]);
  });

  it('flags a manifest that does not parse, a missing entry, and a name mismatch', () => {
    const broken = fixture({ ...GOOD, [join(PLUGIN_DIR, MANIFEST)]: '{ "name": ' });
    expect(manifestViolations(broken)).toEqual([expect.stringMatching(/^kit\/plugin\/\.claude-plugin\/plugin\.json: does not parse/)]);

    const noMarket = fixture({ [join(PLUGIN_DIR, MANIFEST)]: GOOD[join(PLUGIN_DIR, MANIFEST)] });
    expect(manifestViolations(noMarket)).toEqual(['.claude-plugin/marketplace.json: missing']);

    const elsewhere = fixture({
      ...GOOD,
      [MARKETPLACE]: JSON.stringify({ name: 'm', owner: { name: 'o' }, plugins: [{ name: 'omni', source: './plugins/omni' }] }),
    });
    expect(manifestViolations(elsewhere)).toEqual(['.claude-plugin/marketplace.json: no plugin entry has source ./kit/plugin']);

    const renamed = fixture({
      ...GOOD,
      [MARKETPLACE]: JSON.stringify({ name: 'm', owner: { name: 'o' }, plugins: [{ name: 'omnibus', source: 'kit/plugin' }] }),
    });
    expect(manifestViolations(renamed)).toEqual([
      '.claude-plugin/marketplace.json: entry names the plugin "omnibus", kit/plugin/.claude-plugin/plugin.json names it "omni"',
    ]);
  });

  it.skipIf(!claude)(`claude plugin validate fails on a broken plugin${reason}`, () => {
    const root = fixture({ ...GOOD, [join(PLUGIN_DIR, MANIFEST)]: '{ "name": ' });
    expect(claudeValidate(join(root, PLUGIN_DIR))).toMatch(/json|JSON/);
    const good = fixture(GOOD);
    expect(claudeValidate(join(good, PLUGIN_DIR))).toBeNull();
  });
});

// PRD 262: with release notes switched on, the loop writes the note when it ships. `/omni:yolo` step 5
// and `/omni:yolo-fix` step 7 read the switch, write the note in the voice of the `releasing` form,
// which they point to and never restate, check it and commit it, all before `omni ship` and before
// the feature PR is marked ready. The red gate ships nothing, so it writes no note.
describe('the release note in the skills that ship', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const NOTE = ['releaseNotes.enabled', 'kb show releasing', 'check releases', 'docs(release): PRD <prd> release note'];
  const expectInOrder = (text: string, mentions: string[]) => {
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      expect(at, `${mention}, after ${mentions[index - 1] ?? 'the start'}`).toBeGreaterThan(-1);
      from = at + mention.length;
    });
  };

  it('/omni:yolo step 5 writes, checks and commits the note before omni ship, on the green gate only', () => {
    const step = skillSection(read('yolo'), '5.');
    const red = step.indexOf('**Gate red.**');
    expect(red, 'the red gate').toBeGreaterThan(-1);
    expectInOrder(step.slice(0, red), [...NOTE, 'omni.mjs ship <prd>', 'gh pr ready']);
    for (const mention of NOTE) expect(step.slice(red), `the red gate names ${mention}`).not.toContain(mention);
  });

  it('/omni:yolo resumes a shipped draft at the item that marks it ready', () => {
    const yolo = read('yolo');
    const [, item] = /go to step 5, green path,\s+item (\d+)/.exec(yolo) ?? [];
    const line = skillSection(yolo, '5.').split('\n').find((text: string) => text.startsWith(`${item}. `));
    expect(line, `item ${item} of step 5`).toContain('gh pr ready');
  });

  it('/omni:yolo-fix step 7 writes the note, rewrites one a rework changed, and checks and commits it before ready', () => {
    const step = skillSection(read('yolo-fix'), '7.');
    expectInOrder(step, [...NOTE, 'gh pr ready']);
    expect(step).toMatch(/\brewrites? the note\b/);
  });

  it('points to the releasing form and restates none of its limits', () => {
    for (const skill of ['yolo', 'yolo-fix']) expect(read(skill), skill).not.toMatch(/\b(?:60|280) characters\b/);
  });

  it('this repository switches release notes on, so its own ship needs a note', () => {
    const shim = join(repoRoot, '.omni-loop/bin/omni.mjs');
    const run = spawnSync(process.execPath, [shim, 'config', 'releaseNotes.enabled'], { cwd: repoRoot, encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('true\n');
  });
});

// PRD 292: the brainstorm and the plan end with a plain "What is next?", written for someone new to
// the loop. The brainstorm's step 10 shows the PRD's folder as a tree, where it is on the loop's seven
// stages (PRD 587), then What is next? in three steps; the plan's step 7, run alone, ends with What is next? in
// two. Each puts the command alone on the reply's last line, and the PRD issue's Handoff says the
// command waits for the phase-0 merge.
describe('the hand-off that ends the brainstorm and the plan', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const COMMAND = '/omni:yolo <n>';
  const BRAINSTORM = [
    '<folder>/', 'spec.md', 'plan.md', 'before-after.html',
    'idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro', 'you are here', 'merging the phase-0 PR moves it here',
    '**What is next?**', 'Review the PRD', 'Merge that PR', '/clear',
  ];
  const PLAN = ['**What is next?**', 'Review the plan', '/clear'];
  const HANDOFF = 'Next command: `/omni:yolo <n>`, once the phase-0 PR is merged';

  /** Each phrase the section lacks after the one before it, and a last fenced line that is not the command. */
  const handOffViolations = (section: string, phrases: string[]) => {
    const out = [];
    let from = 0;
    phrases.forEach((phrase: string, index: number) => {
      const at = section.indexOf(phrase, from);
      if (at < 0) out.push(`names ${phrase} after ${phrases[index - 1] ?? 'the heading'}`);
      else from = at + phrase.length;
    });
    const last = lastFencedLine(section);
    if (last !== COMMAND) out.push(`its last fenced line is ${last ?? 'missing'}, not ${COMMAND}`);
    return out;
  };

  it('/omni:brainstorm step 10 shows the folder, where it is, then What is next?, and ends on the command', () => {
    expect(handOffViolations(skillSection(read('brainstorm'), '10.'), BRAINSTORM)).toEqual([]);
  });

  it('/omni:plan step 7, run alone, ends with What is next? and the command', () => {
    expect(handOffViolations(skillSection(read('plan'), '7.'), PLAN)).toEqual([]);
  });

  // Step 2 is read up to step 3's heading, not through `skillSection`: the issue body it templates has
  // a `## Handoff` heading of its own, where `skillSection` would stop.
  it("/omni:brainstorm step 2's issue says the command waits for the phase-0 merge", () => {
    const brainstorm = read('brainstorm');
    const step = brainstorm.slice(brainstorm.indexOf('\n## 2.'), brainstorm.indexOf('\n## 3.'));
    expect(step).toMatch(/^\n## 2\. Open the PRD issue\n/);
    expect(step).toContain(`## Handoff\n\n- ${HANDOFF}\n`);
  });

  it('fails when a phrase is removed, or the last fenced line is not the command', () => {
    const fenced = (...lines: string[]) => ['```text', ...lines, '```'].join('\n');
    const good = ['## 10. Hand off', ...BRAINSTORM, fenced('**What is next?**', '', COMMAND, '')].join('\n');
    expect(handOffViolations(good, BRAINSTORM)).toEqual([]);
    for (const [index, phrase] of BRAINSTORM.entries()) {
      expect(handOffViolations(good.replaceAll(phrase, '…'), BRAINSTORM), phrase).toContain(
        `names ${phrase} after ${BRAINSTORM[index - 1] ?? 'the heading'}`,
      );
    }
    expect(handOffViolations(`${good}\n${fenced('/omni:plan <n>')}`, BRAINSTORM)).toEqual([
      `its last fenced line is /omni:plan <n>, not ${COMMAND}`,
    ]);
    expect(handOffViolations(`${good}\n${fenced(COMMAND, 'and more')}`, BRAINSTORM)).toEqual([
      `its last fenced line is and more, not ${COMMAND}`,
    ]);
    expect(handOffViolations(PLAN.join('\n'), PLAN)).toEqual([`its last fenced line is missing, not ${COMMAND}`]);
  });
});

// PRD 301: the yolo and the yolo-fix end the way the brainstorm does since PRD 292. The yolo's step 7
// keeps its report, then shows the PRD's folder as a tree (shipped with its outbox inside, or the
// inbox folder beside its outbox folder), where it is on the loop's seven stages ("you are here" under
// outbox when green, under building when red or held, the feature PR's merge under shipped), then What is next? for the ending the run reached:
// green, red or held, each with a last line of its own. The yolo-fix's step 8 ends with that hand-off
// as written, its held ending resuming with `/omni:yolo-fix <n>`.
describe('the hand-off that ends the yolo and the yolo-fix', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const YOLO = [
    '<dir>/', 'spec.md', 'plan.md', 'before-after.html', 'release.md', 'outbox/', 'settled.md',
    'idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro', 'you are here', 'merging the feature PR moves it here',
    'Review the change', 'Merge that PR', 'retro PR', 'knowledge PR',
    'Read the questions', '#issuecomment-', '/clear',
    'See what holds it', '/clear',
  ];
  // Green, red and held, in that order.
  // PRD 790: the green ending hands the ready feature PR to /omni:pr-care.
  const ENDINGS = ['/omni:pr-care <n>', '/omni:yolo-fix <n>', '/omni:yolo <n>'];
  const WHAT_IS_NEXT = '**What is next?**';

  /** The last non-blank line of each fenced block whose first non-blank line is What is next?. */
  const endings = (section: string) => {
    const out: (string | undefined)[] = [];
    let block: string[] | null = null;
    for (const line of section.split('\n')) {
      if (line.trim().startsWith('```')) {
        if (block) {
          const lines = block.map((text) => text.trim()).filter((text) => text !== '');
          if (lines[0] === WHAT_IS_NEXT) out.push(lines.at(-1));
        }
        block = block ? null : [];
      } else if (block) block.push(line);
    }
    return out;
  };

  /** Each phrase the section lacks after the one before it, a missing ending, and an ending's wrong last line. */
  const handOffViolations = (section: string) => {
    const out = [];
    let from = 0;
    YOLO.forEach((phrase, index) => {
      const at = section.indexOf(phrase, from);
      if (at < 0) out.push(`names ${phrase} after ${YOLO[index - 1] ?? 'the heading'}`);
      else from = at + phrase.length;
    });
    const lasts = endings(section);
    if (lasts.length !== ENDINGS.length) out.push(`has ${lasts.length} What is next? blocks, not ${ENDINGS.length}`);
    ENDINGS.forEach((ending, index) => {
      if (lasts[index] !== ending) out.push(`What is next? ${index + 1} ends on ${lasts[index] ?? 'nothing'}, not ${ending}`);
    });
    return out;
  };

  it('/omni:yolo step 7 keeps its report, then shows the folder, where it is, and three endings', () => {
    const step = skillSection(read('yolo'), '7. Hand off');
    expect(step).toMatch(/^## 7\. Hand off\n/);
    expect(handOffViolations(step)).toEqual([]);
    expect(step).not.toContain('A person merges');
  });

  it("/omni:yolo step 5's red gate leaves what to do next to the hand-off", () => {
    const step = skillSection(read('yolo'), '5.');
    expect(step.slice(step.indexOf('**Gate red.**'))).not.toContain('Report:');
  });

  it("/omni:yolo-fix step 8 ends with /omni:yolo §7's hand-off, its held ending resuming the yolo-fix", () => {
    const step = skillSection(read('yolo-fix'), '8. Hand off');
    expect(step).toMatch(/^## 8\. Hand off\n/);
    expect(step).toContain('`/omni:yolo` §7');
    expect(step).toContain('/omni:yolo-fix <n>');
    expect(step).not.toContain('A person merges');
  });

  it('fails when a phrase is removed, an ending ends on another line, or an ending is missing', () => {
    const fenced = (...lines: string[]) => ['```markdown', ...lines, '```'].join('\n');
    const ending = (last: string | undefined) => fenced(WHAT_IS_NEXT, '', '1. …', '', String(last), '');
    const good = ['## 7. Hand off', ...YOLO, ['```text', '  <dir>/', '```'].join('\n'), ...ENDINGS.map(ending)].join('\n');
    expect(handOffViolations(good)).toEqual([]);
    for (const [index, phrase] of YOLO.entries()) {
      expect(handOffViolations(good.replaceAll(phrase, '…')), phrase).toContain(
        `names ${phrase} after ${YOLO[index - 1] ?? 'the heading'}`,
      );
    }
    expect(handOffViolations(good.replace(String(ENDINGS[0]), 'A person merges the feature PR.'))).toEqual([
      `What is next? 1 ends on A person merges the feature PR., not ${ENDINGS[0]}`,
    ]);
    expect(handOffViolations(good.replace(ending(ENDINGS[2]), ending('/omni:yolo-fix <n>')))).toEqual([
      `What is next? 3 ends on /omni:yolo-fix <n>, not ${ENDINGS[2]}`,
    ]);
    expect(handOffViolations(good.replace(ending(ENDINGS[1]), ''))).toEqual([
      `has 2 What is next? blocks, not ${ENDINGS.length}`,
      `What is next? 2 ends on /omni:yolo <n>, not ${ENDINGS[1]}`,
      `What is next? 3 ends on nothing, not ${ENDINGS[2]}`,
    ]);
  });
});

// PRD 587: the Where it is blocks of the brainstorm and the yolo name the loop's seven stages, the
// kit's stage words in the kit's order, one plain line each, and the yolo puts "you are here" under
// outbox on the green ending and under building on the red and held ones.
describe('the seven stages in the hand-offs of the brainstorm and the yolo', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const TRACK = STAGE_ORDER.map((stage) => STAGE_WORDS[stage]).join(' ──▶ ');

  /** The fenced blocks of `text` that start with `Where it is`, or hold the track, as their lines. */
  const blocks = (text: string) => {
    const out: string[][] = [];
    let block: string[] | null = null;
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('```')) {
        if (block && block.some((l) => l.trim() === TRACK)) out.push(block);
        block = block ? null : [];
      } else if (block) block.push(line);
    }
    return out;
  };

  /** The stage words each line under the track starts with, in order. */
  const stageLines = (block: string[] | undefined) => {
    assertDefined(block, 'the block that holds the track');
    return block.map((line) => line.match(/^ {2}(\S+) {2,}\S/)?.[1]).filter(Boolean);
  };

  /** The track word above the marker of "you are here". */
  const here = (block: string[] | undefined) => {
    assertDefined(block, 'the block that holds the track');
    const track = block.find((line: string) => line.trim() === TRACK);
    assertDefined(track, 'the track line');
    const marker = block.find((line: string) => line.includes('└─ you are here'));
    assertDefined(marker, 'the "you are here" line');
    const at = marker.indexOf('└─ you are here');
    for (const word of track.matchAll(/\S+/g)) if (at >= word.index && at < word.index + word[0].length) return word[0];
    return null;
  };

  it('/omni:brainstorm names the seven stages, one line each, "you are here" under PRD', () => {
    const [block] = blocks(skillSection(read('brainstorm'), '10.'));
    expect(stageLines(block)).toEqual(STAGE_ORDER.map((stage) => STAGE_WORDS[stage]));
    expect(here(block)).toBe('PRD');
  });

  it('/omni:yolo names the seven stages, "you are here" under outbox when green, under building when red or held', () => {
    const found = blocks(skillSection(read('yolo'), '7. Hand off'));
    expect(found).toHaveLength(2);
    expect(stageLines(found[0])).toEqual(STAGE_ORDER.map((stage) => STAGE_WORDS[stage]));
    expect(here(found[0])).toBe('outbox');
    expect(here(found[1])).toBe('building');
  });

  it('never keeps the six-stage track', () => {
    for (const skill of ['brainstorm', 'yolo']) expect(read(skill)).not.toContain('inbox ──▶ outbox');
  });
});

// PRD 790: `/omni:pr-care <n>` watches PRD n's feature PR round by round: a conflict, then red CI,
// then each review thread judged against the `review` form, replies through `omni care reply` with the
// marker the PRD page reads, nothing pushed while a wave holds claims, and the status comment's care
// line in the exact form the page parses.
describe('the pr-care skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/pr-care/SKILL.md'), 'utf8');
  const orderGaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('is named pr-care, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('pr-care');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:pr-care"/);
  });

  it('reads the briefing, then the review form, and looks after the feature PR only', () => {
    const step = skillSection(read(), 'Step 0');
    expect(orderGaps(step, ['omni.mjs config', 'kb show briefing', 'kb show review'])).toEqual([]);
    expect(read()).toMatch(/feature PR\*\* only/);
  });

  it('reads the state with omni care state, then acts in order: conflict, red CI, then reviews', () => {
    const round = skillSection(read(), '2. A round');
    expect(orderGaps(round, [
      'omni.mjs care state <n>', '`merge-base`', 'not an attempt', '`fix-ci`', 'limits.attempts', 'labels.needsFix',
      '`judge`', '`mark-asked`', '`status`',
    ])).toEqual([]);
  });

  it('judges each thread against the review form, posts through omni care reply, and resolves fixed and pushed-back ones', () => {
    const threads = skillSection(read(), '3. Review threads');
    expect(orderGaps(threads, ['kb show review', '**fixed**', 'Fixed in <sha>: <one line>', '**pushed-back**', 'names the line', '**asked**'])).toEqual([]);
    expect(threads).toContain('omni.mjs care reply --verdict <verdict> --file <file> --thread <thread id>');
    expect(threads).toMatch(/resolves the thread/);
    expect(threads).toMatch(/stays open/);
    expect(threads).toContain('<!-- omni-care: fixed|pushed-back|asked -->');
  });

  it("keeps the reviewer's last word: a thread a person answered after a care reply becomes asked, never argued again", () => {
    const threads = skillSection(read(), '3. Review threads');
    expect(threads).toMatch(/\*\*The reviewer keeps the last word\.\*\*/);
    expect(threads).toMatch(/never argue/i);
  });

  it('pushes nothing while a wave holds claims: report-only rewrites the status comment alone', () => {
    const text = read();
    expect(skillSection(text, '2. A round')).toContain('`report-only`');
    expect(skillSection(text, 'Guardrails')).toMatch(/Never push while a wave holds claims/);
  });

  it("writes the status comment's care line in the form the PRD page parses, ISO 8601 times", () => {
    const status = skillSection(read(), '4. The status comment');
    expect(status).toContain('PR care: watching since <ISO 8601> · last round <ISO 8601>');
    expect(status).toContain('markers.prefix');
    expect(status).toMatch(/--edit-last/);
  });

  it('stops when the PR is merged or closed, or the person stops it, and never merges', () => {
    const text = read();
    const stop = skillSection(text, '6. Stop');
    for (const phrase of ['merged', 'closed', 'the person stops it']) expect(stop, phrase).toContain(phrase);
    expect(skillSection(text, 'Guardrails')).toMatch(/Never merge/);
    expect(text).not.toMatch(/\bgh pr merge\b/);
    expect(text).not.toMatch(/\bgh pr ready\b(?! <n> --undo)/);
  });
});

// PRD 1139: `/loop /omni:drive` takes one step of the loop plan per tick through the commands the kit
// has (`omni next`, `omni loop`), runs one skill per step, parks on the feature PR's status comment,
// pushes every tick, and stops itself; `/omni:pr-care --once` runs one round and returns.
describe('the drive skill in this repository', () => {
  const read = (skill = 'drive') => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const missingInOrder = (text: string, mentions: string[]) => {
    let from = 0;
    return mentions.filter((mention) => {
      const at = text.indexOf(mention, from);
      if (at < 0) return true;
      from = at + mention.length;
      return false;
    });
  };

  it('is named drive, and triggers on /loop /omni:drive', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('drive');
    expect(description).toMatch(/\bTriggers on\b.*"\/loop \/omni:drive"/);
  });

  it('opens or resumes the loop from omni loop status, plans with omni next --plan, then starts it on the Loop page', () => {
    const open = skillSection(read(), '1. Open or resume');
    expect(missingInOrder(open, ['omni.mjs loop status --json', '**resume**', '**New loop.**', 'omni.mjs next --plan', 'omni.mjs loop push start [--take-over]', '**carry on**'])).toEqual([]);
    for (const state of ['`silent`', '`live` or `sleeping`', '`parked`', '`stopped`']) expect(open, state).toContain(state);
  });

  it('reads the step with omni next --json, by the fields it prints, and never picks another', () => {
    const step = skillSection(read(), '2. Read the step');
    expect(step).toContain('omni.mjs next --json');
    for (const field of ['`replanned`', '`stop`', '`step`', '`verdict`', '`prds`', '`wakeHint`']) expect(step, field).toContain(field);
    expect(step).toMatch(/Never pick another step/);
  });

  it('runs one of the four skills the verdict names, and parks on the status comment and the Loop page', () => {
    const act = skillSection(read(), '3. Act on it');
    for (const skill of ['/omni:wave <prd>', '/omni:yolo <prd>', '/omni:yolo-fix <prd>', '/omni:pr-care <prd> --once']) expect(act, skill).toContain(skill);
    expect(act).toMatch(/One skill per step agent/);
    expect(missingInOrder(act, ['**park**', 'status comment', 'omni.mjs loop push park --prd <prd> --who "<who>" --what "<what>"'])).toEqual([]);
  });

  it('pushes every tick with the flags omni loop push tick has, then stops itself with omni loop push stop', () => {
    const text = read();
    const tick = skillSection(text, '4. Record the tick');
    for (const flag of ['--step <step>', '--steps <of>', '--prd <prd>', '--action <word>', '--result "<one line>"', '--link', '--merged', '--items', '--wake-in <seconds>']) {
      expect(tick, flag).toContain(flag);
    }
    const stop = skillSection(text, '5. Stop');
    expect(stop).toContain('omni.mjs loop push stop');
    expect(stop).toMatch(/what waits on whom/);
  });

  it('names Claude Code only where it schedules the next /loop wake, and in the line pointing there', () => {
    const text = read();
    const waking = skillSection(text, 'Waking up');
    expect(waking).toMatch(/\*\*Claude Code\.\*\*/);
    expect(waking).toMatch(/schedul/);
    const body = text.replace(/^---[\s\S]*?\n---\n/, '').replace(waking, '');
    expect(body.match(/Claude/g)).toHaveLength(2);
    expect(body).toMatch(/in Claude Code that is `\/loop`\s+\(\*\*Waking up\*\*/);
  });

  it('keeps its guardrails: never merge, never add the outbox override, never answer the outbox, never push while a wave holds claims', () => {
    const guardrails = skillSection(read(), 'Guardrails');
    expect(guardrails).toMatch(/Never merge into `repo\.defaultBranch`/);
    expect(guardrails).toMatch(/Never add `labels\.outboxGo`/);
    expect(guardrails).toMatch(/never answer the outbox/);
    expect(guardrails).toMatch(/Never push while a wave holds claims/);
    expect(read()).not.toMatch(/\bgh pr (?:merge|ready)\b/);
  });

  it('/omni:pr-care --once runs one round and returns, without a wait', () => {
    const text = read('pr-care');
    expect(frontmatter(text)?.description).toMatch(/--once it runs one round and returns/);
    expect(skillSection(text, 'Input')).toContain('`/omni:pr-care 790 --once`');
    expect(skillSection(text, 'Input')).toMatch(/\*\*returns\*\*, skipping \*\*5\. Wait for the next round\*\*/);
    expect(skillSection(text, '5. Wait')).toMatch(/Under `--once`, there is no next round here/);
  });
});

// PRD 1162: `/omni:drive` takes `--roadmap <n>` and refuses a plan repository with the
// `/omni:mega-drive` line; `/loop /omni:mega-drive` is its twin for a plan repository, following it
// step for step with the `ultra-` skills, parking on the plan PR and pushing the roadmap each tick;
// `/omni:mega-pr-care --once` runs one round; `/omni:ultra-yolo` plans a PRD that has no plan.
describe('the drive across repositories and roadmaps (PRD 1162)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const missingInOrder = (text: string, mentions: string[]) => {
    let from = 0;
    return mentions.filter((mention) => {
      const at = text.indexOf(mention, from);
      if (at < 0) return true;
      from = at + mention.length;
      return false;
    });
  };
  const DRIVE_LINE = 'a plan repository: /loop /omni:mega-drive [<n>…] [--roadmap <n>]';
  const MEGA_LINE = 'not a plan repository: /loop /omni:drive [<n>…] [--roadmap <n>]';

  it('/omni:drive takes --roadmap, reads held PRDs, and pushes the roadmap after each tick', () => {
    const text = read('drive');
    expect(frontmatter(text)?.description).toMatch(/--roadmap/);
    expect(skillSection(text, 'Input')).toContain('`/loop /omni:drive --roadmap 1170`');
    expect(skillSection(text, '1. Open or resume')).toContain('omni.mjs next --plan [<n>…] [--roadmap <n>]');
    const step = skillSection(text, '2. Read the step');
    expect(step).toContain('omni.mjs next --json [--roadmap <n>]');
    expect(step).toContain('`held`');
    const act = skillSection(text, '3. Act on it');
    expect(missingInOrder(act, ['**Held.**', 'loop push park', 'gh issue comment <held prd>'])).toEqual([]);
    expect(missingInOrder(skillSection(text, '4. Record the tick'), ['omni.mjs loop push tick', 'omni.mjs roadmap push <n>'])).toEqual([]);
  });

  it('/omni:drive and /omni:mega-drive each refuse the wrong kind of repository with the other line, in step 0', () => {
    const drive = skillSection(read('drive'), 'Step 0');
    expect(missingInOrder(drive, ['omni.mjs config', '`plan` section', DRIVE_LINE])).toEqual([]);
    expect(lastFencedLine(drive)).toBe(DRIVE_LINE);
    const mega = skillSection(read('mega-drive'), 'Step 0');
    expect(missingInOrder(mega, ['omni.mjs config', '`plan` section', MEGA_LINE, 'kb show briefing'])).toEqual([]);
    expect(lastFencedLine(mega)).toBe(MEGA_LINE);
  });

  it('/omni:mega-drive is named for its folder, triggers on its /loop line, and follows /omni:drive step for step', () => {
    const text = read('mega-drive');
    const { name, description } = frontmatter(text) ?? {};
    expect(name).toBe('mega-drive');
    expect(description).toMatch(/\bTriggers on\b.*"\/loop \/omni:mega-drive"/);
    expect(text).toContain('It follows `/omni:drive` **step for step**');
    expect(missingInOrder(text, ['## Step 0', '## 1. Open or resume', '## 2. Read the step', '## 3. Act on it',
      '## 4. Record the tick', '## 5. Stop', '## Waking up', '## Guardrails'])).toEqual([]);
  });

  it('/omni:mega-drive runs only the ultra- skills and mega-pr-care --once, and parks on the plan PR naming each PR by repository', () => {
    const text = read('mega-drive');
    expect(skillSection(text, '1. Open or resume')).toContain('omni.mjs next --plan [<n>…] [--roadmap <n>]');
    const step = skillSection(text, '2. Read the step');
    expect(step).toContain('omni.mjs next --json [--roadmap <n>]');
    expect(step).toContain('`repos`');
    const act = skillSection(text, '3. Act on it');
    for (const skill of ['/omni:ultra-wave <prd>', '/omni:ultra-yolo <prd>', '/omni:ultra-yolo-fix <prd>', '/omni:mega-pr-care <prd> --once']) expect(act, skill).toContain(skill);
    for (const skill of ['/omni:wave <prd>', '/omni:yolo <prd>', '/omni:yolo-fix <prd>', '/omni:pr-care <prd> --once']) expect(text, skill).not.toContain(skill);
    expect(missingInOrder(act, ['**park**', "plan PR's status comment", 'by repository', 'omni.mjs loop push park'])).toEqual([]);
  });

  it('/omni:mega-drive records the repositories of each tick, then pushes the roadmap', () => {
    const tick = skillSection(read('mega-drive'), '4. Record the tick');
    expect(missingInOrder(tick, ['omni.mjs loop push tick', '--repos <repo,…>', 'omni.mjs roadmap push <n>'])).toEqual([]);
    for (const action of ['`ultra-wave`', '`ultra-yolo`', '`ultra-yolo-fix`', '`mega-pr-care`']) expect(tick, action).toContain(action);
  });

  it('/omni:mega-drive names Claude Code only where it schedules the next wake, commits nothing and keeps its guardrails', () => {
    const text = read('mega-drive');
    const waking = skillSection(text, 'Waking up');
    expect(waking).toMatch(/\*\*Claude Code\.\*\*/);
    const body = text.replace(/^---[\s\S]*?\n---\n/, '').replace(waking, '');
    expect(body.match(/Claude/g)).toHaveLength(2);
    expect(text).not.toMatch(/\bgit commit\b|\bgh (?:pr|issue) create\b|\bgh pr (?:merge|ready)\b/);
    const guardrails = skillSection(text, 'Guardrails');
    expect(guardrails).toMatch(/any repository's default branch/);
    expect(guardrails).toMatch(/Never add `labels\.outboxGo`/);
    expect(guardrails).toMatch(/never answer the outbox/);
    expect(guardrails).toMatch(/Never push while a wave holds claims/);
  });

  it('/omni:mega-pr-care --once runs one round and returns, without a wait', () => {
    const text = read('mega-pr-care');
    expect(frontmatter(text)?.description).toMatch(/--once it runs one round and returns/);
    expect(skillSection(text, 'Input')).toContain('`/omni:mega-pr-care 1200 --once`');
    expect(skillSection(text, 'Input')).toMatch(/\*\*returns\*\*, skipping \*\*5\. Wait for the next round\*\*/);
    expect(skillSection(text, '5. Wait')).toMatch(/Under `--once`, there is no next round here/);
  });

  it('/omni:ultra-yolo plans a PRD with no plan, graded by omni plan check, before its first wave', () => {
    const text = read('ultra-yolo');
    expect(text).not.toContain('has no plan: /omni:mega-brainstorm writes it');
    expect(skillSection(text, 'Step 0')).toMatch(/no plan yet/);
    const plan = skillSection(text, '1.');
    expect(missingInOrder(plan, ['**A PRD with no plan**', '/omni:mega-brainstorm', '/omni:plan <n>', 'omni.mjs plan check <n>', 'PRD <n> is an ordinary PRD: /omni:yolo <n>'])).toEqual([]);
    expect(text.indexOf('**A PRD with no plan**')).toBeLessThan(text.indexOf('## 3. Loop the waves'));
  });
});

// PRD 1205, slice s2: a tick of `/omni:drive` and `/omni:mega-drive` fills a rolling pool of up to
// `limits.parallelSteps` steps: one background agent per entry of `steps`, each in its own worktree,
// under `/omni:mega-drive` with its own `<worktrees>/targets/<name>@<prd>` clones; one tick record per
// step launched and per step finished, listing what runs by repository and every held line; the loop
// stops only when nothing runs.
describe('the loop runs a pool of steps (PRD 1205)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const CLONE = '<worktrees>/targets/<name>@<prd>';

  for (const skill of ['drive', 'mega-drive']) {
    it(`/omni:${skill} reads steps, running and held, and launches one background agent per step, each in its own worktree, in one message`, () => {
      const text = read(skill);
      const step = skillSection(text, '2. Read the step');
      for (const field of ['`steps`', '`running`', '`held`', '`limits.parallelSteps`']) expect(step, field).toContain(field);
      const act = skillSection(text, '3. Act on it');
      expect(act).toMatch(/one background agent per entry of `steps`/);
      expect(act).toMatch(/in one message/);
      expect(act).toContain('isolation: "worktree"');
      expect(act).toMatch(/never a step agent/);
    });

    it(`/omni:${skill} parks only the held entries that carry a gate`, () => {
      expect(skillSection(read(skill), '3. Act on it')).toMatch(/only the entries of `held` that carry a `gate`/);
    });

    it(`/omni:${skill} records a tick per step launched and per step finished, naming what runs by repository and every held line`, () => {
      const tick = skillSection(read(skill), '4. Record the tick');
      expect(tick).toMatch(/one tick per step launched/);
      expect(tick).toMatch(/one per step that finished/);
      expect(tick).toContain('running: ');
      expect(tick).toContain('held: ');
    });

    it(`/omni:${skill} stops itself only when nothing runs`, () => {
      expect(skillSection(read(skill), '5. Stop')).toMatch(/nothing runs/);
      expect(skillSection(read(skill), 'Guardrails')).toMatch(/`limits\.parallelSteps` steps at once/);
    });
  }

  it('/omni:mega-drive gives each PRD its own target clones, and every skill that builds across repositories reads them there', () => {
    expect(skillSection(read('mega-drive'), '3. Act on it')).toContain(CLONE);
    for (const skill of ['ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'mega-pr-care', 'do-work', 'pr']) {
      const text = read(skill);
      expect(text, skill).toContain(CLONE);
      expect(text, skill).not.toMatch(/<worktrees>\/targets\/<name>(?!@<prd>)/);
    }
  });
});

// PRD 1162, slice s9: `/omni:roadmap <source>` and `/omni:mega-roadmap <source>` write a whole roadmap
// in one sitting: one map and one answer, every PRD's issue, folder and spec up front with no plan,
// the roadmap issue and `roadmap.md`, the checks, one phase-0 PR, the roadmap pushed, and the drive
// line. Each refuses the other's kind of repository with the other's line.
describe('the roadmap skills (PRD 1162)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const missingInOrder = (text: string, mentions: string[]) => {
    let from = 0;
    return mentions.filter((mention) => {
      const at = text.indexOf(mention, from);
      if (at < 0) return true;
      from = at + mention.length;
      return false;
    });
  };
  const SKILLS = {
    roadmap: { refusal: 'a plan repository: /omni:mega-roadmap <source>', drive: '/loop /omni:drive --roadmap <n>' },
    'mega-roadmap': { refusal: 'not a plan repository: /omni:roadmap <source>', drive: '/loop /omni:mega-drive --roadmap <n>' },
  } as const;

  for (const [skill, { refusal, drive }] of Object.entries(SKILLS)) {
    it(`/omni:${skill} is named for its folder, triggers on its slash command, and signs what it commits and opens`, () => {
      const text = read(skill);
      const { name, description } = frontmatter(text) ?? {};
      expect(name).toBe(skill);
      expect(description).toMatch(new RegExp(`\\bTriggers on\\b.*"/omni:${skill}"`));
      expect(text).toMatch(namesSign('trailer'));
      expect(text).toMatch(namesSign('footer'));
      for (const command of commandMentions(text)) expect(Object.hasOwn(COMMAND_TABLE, command), `${skill}: omni ${command}`).toBe(true);
    });

    it(`/omni:${skill} refuses the wrong kind of repository in step 0 with the other's line, writing nothing`, () => {
      const step0 = skillSection(read(skill), 'Step 0');
      expect(missingInOrder(step0, ['omni.mjs config', '`plan` section', refusal, 'kb show briefing'])).toEqual([]);
      expect(lastFencedLine(step0)).toBe(refusal);
      expect(step0).toMatch(/writ(?:e|es|ing) nothing/);
    });

    it(`/omni:${skill} shows one map and takes every answer in one message, before anything is written`, () => {
      const map = skillSection(read(skill), '2. The map');
      expect(map).toMatch(/\*\*one map\*\*/);
      expect(map).toMatch(/in \*\*one message\*\*/);
      expect(map).toMatch(/Nothing is written before that answer/);
    });

    it(`/omni:${skill} writes specs up front and no plan, checks the roadmap and the inbox, opens one phase-0 PR, pushes the roadmap and hands off ${drive}`, () => {
      const text = read(skill);
      expect(text).toMatch(/[Nn]o plan/);
      expect(text).not.toMatch(/[Ff]ollow `\/omni:plan/);
      expect(missingInOrder(text, ['omni.mjs roadmap check <n>', 'omni.mjs check inbox', 'omni.mjs phase0 <prd>', 'omni.mjs roadmap push <n>'])).toEqual([]);
      expect(text).toMatch(/\*\*one phase-0 PR\*\*/);
      const handOff = skillSection(text, '6. Hand off');
      expect(lastFencedLine(handOff)).toBe(drive);
    });
  }

  it('/omni:roadmap writes each PRD as /omni:brainstorm writes it, with its blocked-by from the table', () => {
    const text = read('roadmap');
    expect(missingInOrder(skillSection(text, '3. Write every PRD'), ['/omni:brainstorm', 'gh issue create', '`blocked-by`', 'before-after.html'])).toEqual([]);
    expect(missingInOrder(skillSection(text, '4. The roadmap'), ['omni:roadmap', 'gh issue create', 'roadmap.md', '| id | PRD | title | blocked by | why | wave |', '## Open questions'])).toEqual([]);
  });

  it('/omni:mega-roadmap follows /omni:roadmap step for step, surveys the targets and reads them from read-only clones', () => {
    const text = read('mega-roadmap');
    expect(text).toContain('It follows `/omni:roadmap` **step for step**');
    expect(text).toContain('**Nothing runs in a clone.**');
    expect(missingInOrder(skillSection(text, '1. Read the source'), ['omni.mjs targets --json', 'gh repo clone <repo> <scratch>/<name> -- --depth 1 --single-branch'])).toEqual([]);
    expect(skillSection(text, '2. The map')).toMatch(/`readOnly`[\s\S]*`consumes`/);
    expect(missingInOrder(skillSection(text, '3. Write every PRD'), ['/omni:mega-brainstorm', '## Repositories'])).toEqual([]);
    expect(skillSection(text, '4. The roadmap')).toContain('| id | PRD | title | repos | blocked by | why | wave |');
    expect(skillSection(text, 'Guardrails')).toMatch(/never a branch, a commit, a pull request, an issue or a comment in a target/);
  });
});

// PRD 1218, slice s8: a roadmap's prerequisites. `/omni:roadmap` and `/omni:mega-roadmap` write the
// `## Prerequisites` rows (the base rows first, then what each PRD needs) with each card, show them on
// the map by category, and run `omni roadmap prereqs <n> --fix` once the check is green, listing the
// open rows in the hand-off. `/omni:drive` and `/omni:mega-drive` run it on the first tick and before
// a PRD a prerequisite holds starts, and list the open ones when they stop.
describe('the roadmap prerequisites in the skills (PRD 1218)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const missingInOrder = (text: string, mentions: string[]) => {
    let from = 0;
    return mentions.filter((mention) => {
      const at = text.indexOf(mention, from);
      if (at < 0) return true;
      from = at + mention.length;
      return false;
    });
  };
  const PREREQS = 'omni.mjs roadmap prereqs <n> --fix';

  it('/omni:roadmap writes the base rows and each PRD\'s rows with their four-line cards in roadmap.md', () => {
    const text = read('roadmap');
    const step1 = skillSection(text, '1. Read the source');
    expect(step1).toMatch(/\*\*The prerequisites:\*\*/);
    for (const base of ['`base:gh-auth`', '`base:node`', '`base:install`', '`base:labels`']) expect(step1, base).toContain(base);
    expect(step1).toMatch(/blocking `all`/);
    const step4 = skillSection(text, '4. The roadmap');
    expect(missingInOrder(step4, ['## Open questions', '## Prerequisites', '| id | category | need | check | fix | blocks | who |', '### p', '**Why:**', '**Command:**', '**What it does:**', '**Who can do it:**'])).toEqual([]);
  });

  it('/omni:roadmap shows the prerequisites on the map by category, runs prereqs --fix once after the check, and lists the open ones in the hand-off', () => {
    const text = read('roadmap');
    expect(skillSection(text, '2. The map')).toMatch(/prerequisites[^\n]*grouped by category/i);
    expect(missingInOrder(text, ['omni.mjs roadmap check <n>', PREREQS])).toEqual([]);
    expect(skillSection(text, '6. Hand off')).toMatch(/`waits on you`[^]*first/);
  });

  it('/omni:mega-roadmap adds a repos cell to a prerequisite and never runs one in a clone', () => {
    const text = read('mega-roadmap');
    expect(skillSection(text, '2. The map')).toMatch(/prerequisites/i);
    const step4 = skillSection(text, '4. The roadmap');
    expect(step4).toContain('| id | category | need | check | fix | blocks | who | repos |');
    expect(skillSection(text, '5. One phase-0 PR')).toContain(PREREQS);
    expect(skillSection(text, '5. One phase-0 PR')).toMatch(/never in a clone/);
  });

  for (const skill of ['drive', 'mega-drive']) {
    it(`/omni:${skill} runs prereqs --fix on the first tick and before a held PRD starts, and lists the open ones when it stops`, () => {
      const text = read(skill);
      expect(skillSection(text, '1. Open or resume'), skill).toContain(PREREQS);
      expect(skillSection(text, '2. Read the step'), skill).toMatch(/waits on prerequisite/);
      expect(skillSection(text, '5. Stop'), skill).toMatch(/open prerequisite/i);
    });
  }

  it('/omni:drive runs prereqs before it reads the step, so omni next reads a fresh result', () => {
    const step2 = skillSection(read('drive'), '2. Read the step');
    expect(missingInOrder(step2, [PREREQS, 'omni.mjs next --json [--roadmap <n>]'])).toEqual([]);
    expect(skillSection(read('drive'), '5. Stop')).toContain('waits on you');
  });
});

// PRD 563: three skills build a PRD that spans repositories, from its plan repository, each beside
// its single-repository twin and following it step for step. None merges into a default branch,
// adds the outbox override, creates a label in a target, or runs anything there but its preflight.
describe('the ultra skills in this repository', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const ULTRA = { 'ultra-yolo': 'yolo', 'ultra-wave': 'wave', 'ultra-yolo-fix': 'yolo-fix' };

  it('each is named for its folder, triggers on its slash command, and follows its twin step for step', () => {
    for (const [skill, twin] of Object.entries(ULTRA)) {
      const text = read(skill);
      const { name, description } = frontmatter(text) ?? {};
      expect(name).toBe(skill);
      expect(description, skill).toMatch(new RegExp(`\\bTriggers on\\b.*"/omni:${skill}"`));
      expect(text, skill).toContain(`It follows \`/omni:${twin}\` **step for step**`);
    }
  });

  it('each keeps the four guardrails of the spec', () => {
    for (const skill of Object.keys(ULTRA)) {
      const guardrails = skillSection(read(skill), 'Guardrails');
      expect(guardrails, skill).toMatch(/any repository's default branch/);
      expect(guardrails, skill).toMatch(/Never add `labels\.outboxGo`/);
      expect(guardrails, skill).toMatch(/never create a label in a target/i);
      expect(guardrails, skill).toMatch(/other than its own committed preflight/);
    }
  });

  it('/omni:ultra-yolo stops on an ordinary PRD, reads what moved, and hands the red gate to /omni:ultra-yolo-fix', () => {
    const text = read('ultra-yolo');
    expect(skillSection(text, 'Step 0')).toContain('PRD <n> is an ordinary PRD: /omni:yolo <n>');
    expect(skillSection(text, '1.')).toContain('omni.mjs plan moved <n> --json');
    expect(skillSection(text, '2.')).toContain('Part of <plan slug>#<n>');
    expect(skillSection(text, '3.')).toContain('/omni:ultra-wave <n>');
    expect(skillSection(text, '5.')).toContain('/omni:ultra-yolo-fix` steps 2 to 7');
    const handOff = skillSection(text, '6. Hand off');
    expect(handOff).toContain('Merging the target PRs, then #<plan PR>, is yours.');
    expect(handOff).toContain('/omni:ultra-yolo-fix <n>');
    expect(handOff).toContain('/omni:ultra-yolo <n>');
  });

  // PRD 1118: the green hand-off ends with /omni:mega-pr-care <n>, as /omni:yolo's ends with /omni:pr-care <n>.
  it("/omni:ultra-yolo's green hand-off ends with the /omni:mega-pr-care line", () => {
    const handOff = skillSection(read('ultra-yolo'), '6. Hand off');
    const green = handOff.slice(handOff.indexOf('**Green:**'), handOff.indexOf('**Red:**'));
    expect(lastFencedLine(green)).toBe('/omni:mega-pr-care <n>');
    expect(green).toContain('/clear');
  });

  it("/omni:ultra-wave builds through do-work --target and pr --repo, and relays each slice's items", () => {
    const text = read('ultra-wave');
    expect(skillSection(text, '2.')).toContain('/omni:pr --repo <slug>');
    expect(skillSection(text, '3.')).toContain('/omni:do-work --in-wave --target <repo>');
    expect(skillSection(text, '4.')).toContain('omni.mjs item relay <out> --prd <prd>');
  });

  it('/omni:ultra-yolo-fix settles on the plan PR and lands each rework in its repo', () => {
    const text = read('ultra-yolo-fix');
    expect(skillSection(text, '4.')).toContain('omni.mjs rework plan <prd> --json');
    expect(skillSection(text, '4.')).toContain('`repo`');
    expect(skillSection(text, '5.')).toContain('/omni:do-work --in-wave --target <repo>');
    expect(skillSection(text, '8.')).toContain('/omni:ultra-yolo-fix <n>');
  });
});

// PRD 1118: `/omni:mega-pr-care <n>` follows `/omni:pr-care` step for step from a plan repository,
// over every pull request `omni care list <n>` names, in merge order: each target PR read with its own
// state, a red that waits on another repository's PR held, each target's own review form, a bounded
// cross-repository fix, the plan PR's target table and the care line on every PR.
describe('the mega-pr-care skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/mega-pr-care/SKILL.md'), 'utf8');
  /** Each mention `text` lacks after the one before it, as `<mention> after <previous>`. */
  const orderGaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('is named mega-pr-care, triggers on its slash command, and follows /omni:pr-care step for step', () => {
    const text = read();
    const { name, description } = frontmatter(text) ?? {};
    expect(name).toBe('mega-pr-care');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:mega-pr-care"/);
    expect(text).toContain('It follows `/omni:pr-care` **step for step**');
    expect(orderGaps(text, ['## Step 0', '## 1. Start the watch', '## 2. A round', '## 3. Review threads',
      '## 4. The status comment', '## 5. Wait for the next round', '## 6. Stop', '## Guardrails'])).toEqual([]);
  });

  it('refuses outside a plan repository with the one line naming /omni:pr-care', () => {
    const step = skillSection(read(), 'Step 0');
    expect(orderGaps(step, ['omni.mjs config', '`plan` section', 'not a plan repository: /omni:pr-care <n>', 'kb show briefing'])).toEqual([]);
    expect(lastFencedLine(step)).toBe('not a plan repository: /omni:pr-care <n>');
  });

  it('reads omni care list each round, then each PR with --repo and --pr, in merge order', () => {
    const text = read();
    expect(skillSection(text, '1. Start the watch')).toContain('omni.mjs care list <n> --json');
    expect(skillSection(text, '1. Start the watch')).toContain('<!-- omni-bug:fix-plan -->');
    expect(skillSection(text, '1. Start the watch')).toContain('For PRD #<n>');
    const round = skillSection(text, '2. A round');
    expect(orderGaps(round, ['**in merge order**', 'omni.mjs care list <n> --json', 'omni.mjs care state <n> --repo <slug> --pr <pr>'])).toEqual([]);
    expect(round).toContain('omni plan landings <n> --repo <name>');
  });

  it('holds a red that waits on another PR: the waits-on line, no attempt, one rerun once it merged', () => {
    const round = skillSection(read(), '2. A round');
    expect(orderGaps(round, ['**Waits on another repository.**', 'spend no attempt', 'waits on <slug>#<pr>', 'no `fix-ci`', '**`rerun`**'])).toEqual([]);
    expect(skillSection(read(), '4. The status comment')).toContain('waits on <slug>#<pr>');
  });

  it("judges a target's threads against the target's own review form, never the imported copy", () => {
    const threads = skillSection(read(), '3. Review threads');
    expect(threads).toContain('(cd <clone> && node <plan repository root>/.omni-loop/bin/omni.mjs kb show review)');
    expect(threads).toMatch(/Never the imported copy/);
    expect(threads).toContain('omni.mjs care reply --verdict <verdict> --file <file> --thread <thread id> --repo <slug>');
  });

  it('bounds a cross-repository fix to an open PR of the list, replied Fixed in <slug>@<sha>, otherwise asked', () => {
    const threads = skillSection(read(), '3. Review threads');
    expect(orderGaps(threads, ['**A cross-repository fix.**', '**open**', "PRD n's slices", 'Fixed in <slug>@<sha>: <one line>', '**asked**'])).toEqual([]);
  });

  it("rewrites the plan PR's target table and keeps the care line on every PR", () => {
    const status = skillSection(read(), '4. The status comment').replace(/\s+/g, ' ');
    expect(status).toContain('**every** pull request');
    expect(status).toContain('PR care: watching since <ISO 8601> · last round <ISO 8601>');
    expect(status).toContain('**Target pull requests, in merge order**');
    expect(status).toContain('<slug>#<n> — <state>, CI <green | red | running | waits on <slug>#<pr>>');
    expect(status).toMatch(/--edit-last/);
  });

  it('runs nothing in a target but its committed preflight, and never merges, marks ready or creates a label there', () => {
    const text = read();
    expect(text).toContain('**Code runs only from a target\'s own config.**');
    const guardrails = skillSection(text, 'Guardrails');
    expect(guardrails).toMatch(/Never merge/);
    expect(guardrails).toMatch(/never mark a pull request ready/);
    expect(guardrails).toMatch(/Never add `labels\.outboxGo`/);
    expect(guardrails).toMatch(/Never create a label in a target/);
    expect(guardrails).toMatch(/other than its own committed preflight/);
    expect(text).not.toMatch(/\bgh pr merge\b/);
    expect(text).not.toMatch(/\bgh pr ready\b/);
  });
});

// PRD 1118: `/omni:mega-bug-fix` follows `/omni:bug-fix` step for step from a plan repository: the
// issue, triage and fix plan there, one fix PR per target in merge order, provider first, each saying
// `Part of` and never closing the issue, and one record PR that closes it, merged last.
describe('the mega-bug-fix skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/mega-bug-fix/SKILL.md'), 'utf8');
  /** Each mention `text` lacks after the one before it, as `<mention> after <previous>`. */
  const orderGaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };
  /** The text from heading `from` to heading `to`: its fenced records hold `##` lines of their own. */
  const between = (text: string, from: string, to: string) => text.slice(text.indexOf(`\n${from}`), text.indexOf(`\n${to}`));

  it('is named mega-bug-fix, triggers on its slash command, and follows /omni:bug-fix step for step', () => {
    const text = read();
    const { name, description } = frontmatter(text) ?? {};
    expect(name).toBe('mega-bug-fix');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:mega-bug-fix"/);
    expect(text).toContain('It follows `/omni:bug-fix` **step for step**');
    expect(orderGaps(text, ['## Step 0', '## 1. Issue', '## 2. Classify', '## 3. Triage', '## 4. Locate',
      '## 5. The fix plan', '## 6. The boundary', '## 7. Each target', '## 8. The record',
      '## 9. Ship the record', '## 10. Hand off', '## Never'])).toEqual([]);
  });

  it('refuses outside a plan repository with the one line naming /omni:bug-fix', () => {
    const step = skillSection(read(), 'Step 0');
    expect(orderGaps(step, ['omni.mjs config', '`plan` section', 'not a plan repository: /omni:bug-fix', 'kb show briefing'])).toEqual([]);
    expect(lastFencedLine(step)).toBe('not a plan repository: /omni:bug-fix');
  });

  it('links the issue to a PRD with For PRD #<prd>, and names the repositories in the triage', () => {
    const text = read();
    expect(skillSection(text, '1. Issue')).toContain('For PRD #<prd>');
    expect(skillSection(text, '3. Triage')).toContain('- **Repositories:** <name>, <name>');
    expect(skillSection(text, '4. Locate')).toContain('<worktrees>/targets/<name>');
  });

  it('posts the fix plan under its marker, a table in merge order, provider first', () => {
    const plan = between(read(), '## 5. The fix plan', '## 6. The boundary');
    expect(orderGaps(plan, ['<!-- omni-bug:fix-plan -->', '| order | repository | pull request | what changes |',
      '**the provider first**'])).toEqual([]);
  });

  it("allows a contract change only when today's consumer keeps working, else the /omni:mega-brainstorm line", () => {
    const boundary = skillSection(read(), '6. The boundary').replace(/\s+/g, ' ');
    expect(boundary).toContain('keeps the consumer working as it is on its default branch today');
    expect(lastFencedLine(skillSection(read(), '6. The boundary'))).toBe("/omni:mega-brainstorm <the issue's line>");
  });

  it('proves red in each target before the fix, and opens a Part of PR, never Closes, with Merge after', () => {
    const target = skillSection(read(), '7. Each target');
    expect(orderGaps(target, ['**Prove red**', 'preflight', '**Without a preflight,**', 'failing CI run', '**before** the fix'])).toEqual([]);
    expect(target).toContain('Mutation: not run in a target');
    expect(target).toContain('Part of <plan slug>#<n>');
    expect(target).toContain('Merge after <slug>#<pr>');
    expect(target).toContain('**never a closing keyword**');
    expect(target).not.toMatch(/\b(Closes|Fixes|Resolves) #/);
  });

  it('records the fix with a Fixes table, proven by omni bug, in a record PR that closes the issue last', () => {
    const text = read();
    const record = between(text, '## 8. The record', '## 9. Ship the record');
    expect(orderGaps(record, ['## Fixes', '| order | repository | pull request | what changes |', '## Reproduction',
      '- **<provider name>:**', '## Guard', '- **<provider name>:**'])).toEqual([]);
    const ship = skillSection(text, '9. Ship the record');
    expect(orderGaps(ship, ['omni.mjs bug <n>', '/omni:dossier-push <n> --kind bug', 'Closes #<n>', 'merges last'])).toEqual([]);
    expect(ship).toContain('Merge after <slug>#<pr>');
  });

  it('is all or nothing across targets, and never merges', () => {
    const text = read();
    expect(text).toContain('**All or nothing across targets.**');
    expect(text).toContain("**Code runs only from a target's own config.**");
    const never = skillSection(text, 'Never');
    expect(never).toMatch(/Never merge/);
    expect(never).toMatch(/Never create a label in a target/);
    expect(text).not.toMatch(/\bgh pr merge\b/);
  });
});

// PRD 686: `/omni:think-big` explores a vast idea with a studio of agents before `/omni:brainstorm`.
// Its step 0 follows `/omni:dossier-open` after the briefing, as the brainstorm's does; its gate gives
// a tweak the `/omni:visual-fix` line and offers a feature the `/omni:brainstorm` line or a lite run;
// its record is proven by `omni concept` and opened through `/omni:pr`; it never merges; and its
// hand-off ends on the wedge's `/omni:brainstorm --concept` line.
describe('the think-big skill in this repository', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/think-big/SKILL.md'), 'utf8');
  const STEPS = [
    '## Step 0', '## 1. Gate', '## 2. Fuel', '## 3. Round 1, go wide', '## 4. Rounds 2 and on, deepen',
    '## 5. Crown', '## 6. Record', '## 7. Hand off',
  ];
  /** Each mention `text` lacks after the one before it, as `<mention> after <previous>`. */
  const orderGaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('is named think-big, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('think-big');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:think-big"/);
  });

  it("carries the spec's steps 0 to 7, in order", () => {
    expect(orderGaps(read(), STEPS)).toEqual([]);
  });

  it('follows /omni:dossier-open after the briefing, in step 0, and says the run is token-heavy', () => {
    const step = skillSection(read(), 'Step 0');
    expect(orderGaps(step, ['omni.mjs config', 'kb show briefing', '/omni:dossier-open', 'token-heavy'])).toEqual([]);
  });

  it('its gate gives a tweak the /omni:visual-fix line, and offers a feature the /omni:brainstorm line or a lite run', () => {
    const gate = skillSection(read(), '1.');
    for (const phrase of ["`/omni:visual-fix '<line>'`", "`/omni:brainstorm '<line>'`", '**lite** run', '*Vast*', '*Feature*', '*Tweak*']) {
      expect(gate, phrase).toContain(phrase);
    }
    for (const kind of ['product', 'identity', 'platform']) expect(gate, kind).toContain(`*${kind}*`);
    expect(gate).toMatch(/In doubt between feature and vast, take vast/);
  });

  it('holds the studio: its role cards, one debate, the "go crazy" dial and the verdict rubric', () => {
    const studio = skillSection(read(), 'The studio');
    for (const role of ['Concept artist', 'Prototyper', 'Visionary', 'Craft', 'Skeptic', 'Value', 'User', 'Moderator']) {
      expect(studio, role).toContain(`**${role}**`);
    }
    expect(orderGaps(studio, ['**Open.**', '**Cross-talk.**', '**Converge.**'])).toEqual([]);
    expect(studio).toMatch(/answers the others by name/);
    expect(studio).toContain('"go crazy" dial');
    for (const score of ['*Wow*', '*User value*', '*Craft*', '*Fit*', '*Feasibility*']) expect(studio, score).toContain(score);
    expect(studio).toMatch(/Dissent is kept, never averaged away/);
    expect(studio).toMatch(/spawns? no (?:agent|subagent)/i);
  });

  it('draws a board per round, with its toggles and reactions line, and asks one question per round', () => {
    const boards = skillSection(read(), 'Boards');
    for (const phrase of ['board-r<k>.html', '**keep**', '**kill**', '**merge**', '**push further**', '**copy my reactions**', '**one question**']) {
      expect(boards, phrase).toContain(phrase);
    }
    expect(boards).toMatch(/never kills, merges or crowns a concept the person did not/);
    expect(boards).toContain('limits.beforeAfterMaxBytes');
  });

  it('crowns only what the person crowned, with a vision tour and an area map, the wedge first', () => {
    const crown = skillSection(read(), '5.');
    for (const phrase of ['vision.html', 'area map', 'the wedge first', 'one reply']) expect(crown, phrase).toContain(phrase);
    expect(crown).toMatch(/the studio never does/);
  });

  it('records the concept through omni config, proves it with omni concept, then opens its PR through /omni:pr', () => {
    const record = skillSection(read(), '6.');
    for (const key of ['labels.concept', 'branches.concept', '<paths.delivery>/inbox/concepts/<nnnn>-<slug>/']) expect(record, key).toContain(key);
    for (const file of ['concept.md', 'vision.html', 'board-r<k>.html', 'debate.md', '<p data-omni-reactions>']) expect(record, file).toContain(file);
    expect(orderGaps(record, [
      'gh issue create --title "Concept: <title>"', 'git worktree add -b <concept branch>', 'docs(concept): <slug>',
      'omni.mjs concept <n>', 'git push -u <remote> <concept branch>', '/omni:pr', 'docs(concept): <title>', 'Refs #<n>',
      '## The concept', '## Areas', '## Verified', '## Risk and rollback', 'omni sign footer',
    ])).toEqual([]);
  });

  // PRD 748: the studio designs for the business this repository serves, and logs what it cited.
  it("fuels the studio with the business's confirmed claims, read with omni business show --json", () => {
    const fuel = skillSection(read(), '2.');
    expect(orderGaps(fuel, ['**The business.**', 'omni.mjs business show --json', 'under their ids', '`state`', 'one line'])).toEqual([]);
  });

  it('records the cited claim ids in the Fuel section, then logs them with omni business cited', () => {
    const record = skillSection(read(), '6.');
    expect(orderGaps(record, ['**Fuel**', 'the business claim ids'])).toEqual([]);
    expect(orderGaps(record, ['omni.mjs concept <n>', 'omni.mjs business cited <id>… --by think-big --ref \'concept #<n>\'', '/omni:pr'])).toEqual([]);
  });

  it('never merges, and writes nothing in the repository or on GitHub before its record', () => {
    const text = read();
    const never = skillSection(text, 'Never');
    expect(never).toContain('**Never merge.**');
    expect(never).toMatch(/Never crown, kill or merge a concept for the person/);
    expect(never).toMatch(/before step 6/);
    expect(text).not.toMatch(/\bgh pr merge\b/);
  });

  it("ends its hand-off on the wedge's /omni:brainstorm --concept line, after /clear", () => {
    const handOff = skillSection(read(), '7.');
    expect(orderGaps(handOff, ['<folder>/', 'concept.md', 'vision.html', '**What is next?**', 'Merge that PR', '/clear'])).toEqual([]);
    expect(lastFencedLine(handOff)).toBe('/omni:brainstorm --concept <n> <wedge id>');
  });
});

// PRD 822: the product's personas speak through the skills. think-big copies them into its fuel and
// seats them as its User panelists; the persona a concept or a design fits worst objects once, citing
// a persona or a claim; the brainstorm saves an overrule or a gap answer as a claim through
// `omni business claim add`, and writes the voice.json rounds; the yolo writes the shipped one.
// Without personas, both skills run as today.
describe('the customer voice in the skills (PRD 822)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  /** A `## ` section of a skill, its line breaks and indents folded into single spaces. */
  const section = (skill: string, start: string) => skillSection(read(skill), start).replace(/\s+/g, ' ');
  /** Each mention `text` lacks after the one before it, as `<mention> after <previous>`. */
  const orderGaps = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it("think-big's fuel copies the personas under persona:<name>, beside the claim ids", () => {
    const fuel = section('think-big', '2.');
    expect(orderGaps(fuel, ['**The business.**', 'omni.mjs business show --json', '**The personas.**', '`personas`', '`persona:<name>`'])).toEqual([]);
    expect(fuel).toMatch(/Without personas, the studio runs as today/);
  });

  it("think-big's User panelists are the personas, five at most, the widest spread of stance and trade", () => {
    const studio = section('think-big', 'The studio');
    expect(studio).toMatch(/the User panelists are those personas/);
    expect(studio).toMatch(/all of them up to five, or the five that differ most in stance and trade/);
    expect(studio).toMatch(/cites `persona:<name>` or a claim id in each post/);
    expect(studio).toMatch(/Without personas, the Users are drawn from the brief/);
  });

  it('in think-big, the persona a concept fits worst objects once, cited, then a fit line, on every board', () => {
    const studio = section('think-big', 'The studio');
    const voice = studio.slice(studio.indexOf('### The voice'));
    expect(orderGaps(voice, ['fits worst', '**objects once**', 'citing', 'is dropped', 'stays silent', 'fit line'])).toEqual([]);
    expect(voice).toContain('fits persona:Marc ✓ · size#2 ✓ · beats rival#20 ✓');
    expect(voice).toMatch(/Without personas, no objection and no fit line/);
    expect(section('think-big', 'Boards')).toMatch(/the objection and the fit line/);
    expect(orderGaps(studio, ['**Converge.**', '**The voice**', '### The voice'])).toEqual([]);
  });

  it('think-big logs the claim ids it cited, never a persona id', () => {
    expect(section('think-big', '6.')).toMatch(/never a `persona:<name>`: personas are not claims/);
  });

  it('brainstorm reads the business at step 0, after the briefing and before the dossier opens', () => {
    const step = section('brainstorm', 'Step 0');
    expect(orderGaps(step, ['kb show briefing', 'omni.mjs business show --json', '/omni:dossier-open'])).toEqual([]);
    expect(step).toMatch(/Without personas, the brainstorm runs as today/);
  });

  it("brainstorm's voice objects once, cited, just before the design's approval question", () => {
    const voice = section('brainstorm', 'The voice');
    expect(orderGaps(voice, ['fits worst', '**objects once**', 'citing', 'is dropped', 'stays silent'])).toEqual([]);
    expect(voice).toMatch(/just before the approval question/);
    expect(voice).toMatch(/the spec's \*\*Decisions\*\* record the objection and how it was settled/i);
    const design = section('brainstorm', '1.');
    expect(orderGaps(design, ['**Bounded:**', '**The voice**', 'explicit yes'])).toEqual([]);
    expect(orderGaps(design, ['**Architectural:**', 'first section', '**The voice**'])).toEqual([]);
  });

  it("brainstorm's overrule question saves a proposed claim, or keeps it for this run", () => {
    const voice = section('brainstorm', 'The voice');
    expect(orderGaps(voice, [
      '"Is that new about the business?"', '**Save as a claim:**',
      "omni.mjs business claim add --kind <kind> --value <value> --state proposed --ref 'brainstorm · <run>'",
      '**Just this run:**', 'nothing is stored',
    ])).toEqual([]);
  });

  it('brainstorm asks one gap question at most, stored confirmed, and Not sure stores nothing', () => {
    const voice = section('brainstorm', 'The voice');
    expect(orderGaps(voice, [
      '**One gap question.**', 'At most once per run', 'no confirmed claim', 'AskUserQuestion',
      "omni.mjs business claim add --kind <kind> --value <answer> --state confirmed --ref 'brainstorm · <run>'",
      '**Not sure** stores nothing',
    ])).toEqual([]);
  });

  it('brainstorm writes the voice.json rounds design and spec, beside the spec, and commits them', () => {
    expect(orderGaps(section('brainstorm', 'The voice'), ['`voice.json`', 'round `design`', 'round `spec`', 'omni.mjs check inbox'])).toEqual([]);
    // Step 4 is read up to step 5's heading: the spec it templates has `## ` headings of its own.
    const brainstorm = read('brainstorm');
    expect(brainstorm.slice(brainstorm.indexOf('\n## 4.'), brainstorm.indexOf('\n## 5.'))).toMatch(/`voice\.json`/);
    expect(section('brainstorm', '7.')).toMatch(/`voice\.json`/);
  });

  it('brainstorm --rework writes a rework-<k> round, and is refused once a sub-PR merged', () => {
    expect(section('brainstorm', 'Inputs')).toContain('`--rework <n>`');
    const rework = section('brainstorm', 'Rework');
    expect(orderGaps(rework, [
      'gh pr list --base <feature branch> --state merged', 'PRD <n> is being built: /omni:yolo-fix <n> owns its changes now',
      'rework-<k>', '/omni:dossier-push <n>', 'omni.mjs phase0 <n>',
    ])).toEqual([]);
    expect(section('brainstorm', 'Guardrails')).toMatch(/--rework/);
  });

  it('yolo writes the shipped round on its green path, before omni ship, and sends it to the dossier', () => {
    const step = section('yolo', '5.');
    const red = step.indexOf('**Gate red.**');
    expect(orderGaps(step.slice(0, red), [
      'docs(release): PRD <prd> release note', '**The shipped round**', 'round `shipped`', 'omni.mjs ship <prd>',
      '/omni:dossier-push <prd>', 'gh pr ready',
    ])).toEqual([]);
    expect(step.slice(red)).not.toContain('round `shipped`');
  });

  it('the unknown-command guard finds business claim in COMMAND_TABLE', () => {
    for (const skill of ['brainstorm', 'think-big', 'yolo']) {
      for (const name of commandMentions(read(skill))) expect(Object.hasOwn(COMMAND_TABLE, name), `${skill}: omni ${name}`).toBe(true);
    }
    expect(read('brainstorm')).toContain('omni.mjs business claim add');
    const shim = join(repoRoot, '.omni-loop/bin/omni.mjs');
    const usage = spawnSync(process.execPath, [shim, 'business', 'claim', 'add'], { cwd: repoRoot, encoding: 'utf8' });
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain('omni business claim add');
  });
});

// PRD 798: /omni:prove films a ready PRD's acceptance criteria and reports them, never blocking; the
// brainstorm asks for it, the yolo follows it after ready, and /omni:invade proposes its config.
describe('the prove skill and the skills that lead to it (PRD 798)', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const inOrder = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention} after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('is named prove, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read('prove')) ?? {};
    expect(name).toBe('prove');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:prove/);
  });

  it('stops with one line when proof.url is unset, and when the preview does not answer', () => {
    const step = skillSection(read('prove'), '1.');
    expect(step).toContain('omni.mjs config proof');
    expect(step).toContain('proof is not configured here: run /omni:invade --refresh, or set proof.url in .omni-loop/config.yml');
    expect(step).toMatch(/writes nothing and posts nothing/);
    const target = skillSection(read('prove'), '2.');
    for (const phrase of ['github-deployment', '10 minutes', 'proof.bypassEnv', 'x-vercel-protection-bypass', 'proof.setup', 'PROOF_STORAGE_STATE', 'preview not reachable: <status>']) {
      expect(target, phrase).toContain(phrase);
    }
  });

  it('proves a shipped PRD too: its merged feature PR, filmed on the fixed URL, never on a preview', () => {
    const step = skillSection(read('prove'), '1.');
    expect(step).toContain('--state merged');
    expect(step).toContain('PRD <n> has no feature PR');
    expect(step).toMatch(/already merged/);
    expect(step).toContain('proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url');
  });

  it('hands the setup the address it films, as PROOF_URL, so a sign-in can target a preview', () => {
    expect(skillSection(read('prove'), '2.')).toContain('PROOF_URL=<the URL>');
    expect(skillSection(read('prove'), '2.')).toContain('proof.deployment');
  });

  it('films at most 10 criteria, each capped at proof.maxSeconds, and says why a criterion is unfilmable', () => {
    const film = skillSection(read('prove'), '3.');
    for (const phrase of ['at most 10', 'proof.maxSeconds', '**unfilmable**', '**filmed**', '<k>-<slug>.spec.ts', '1280×720', 'recordVideo', '<worktrees>/proof-<n>/<run>/', 'preview.gif', 'ffmpeg', 'never committed']) {
      expect(film, phrase).toContain(phrase);
    }
    expect(film).toContain('{commit, url, criteria: [{text, verdict, note?, video?, script?}]}');
    expect(film).toMatch(/`pass`, `fail` or `unfilmable`/);
  });

  it('pushes the run with omni proof push, and keeps the files when it fails', () => {
    const push = skillSection(read('prove'), '4.');
    expect(push).toContain('omni.mjs proof push <n> <dir>');
    expect(push).toContain('upload failed: rerun omni proof push <n> <dir>');
  });

  it('posts one unsigned comment on the feature PR, one line per criterion, the link and the GIF', () => {
    const comment = skillSection(read('prove'), '5.');
    expect(inOrder(comment, ['gh pr comment', 'Proof — <commit short sha>', '✓', '✗', '—', 'Proof tab', 'preview.gif'])).toEqual([]);
    expect(comment).toMatch(/[Uu]nsigned/);
    expect(read('prove')).not.toMatch(/omni(?:\.mjs|`)?\s+sign\b/);
  });

  it('never blocks: it leaves the PR state, its labels and its checks alone, and never merges', () => {
    const text = read('prove');
    expect(skillSection(text, 'Never')).toMatch(/Nothing blocks/);
    for (const verb of [/\bgh pr ready\b/, /\bgh pr merge\b/, /--add-label/, /--remove-label/, /\bgit commit\b/]) expect(text).not.toMatch(verb);
  });

  it('/omni:brainstorm asks the proof question only when proof.url is set, and a yes writes proof: video', () => {
    const text = read('brainstorm');
    const design = skillSection(text, '1.');
    expect(inOrder(design, ['**The gate.**', 'proof.url', 'Record a proof video once it ships?', '`proof: video`'])).toEqual([]);
    // Step 4 holds the spec's own `## ` headings in a template, so it is read up to step 5.
    const spec = text.slice(text.indexOf('## 4. Write the spec'), text.indexOf('## 5. '));
    expect(spec).toMatch(/^- `proof: video` only when the person said yes/m);
  });

  it('/omni:yolo follows /omni:prove after it marks the PR ready, only when the spec says proof: video', () => {
    const step = skillSection(read('yolo'), '5.');
    const red = step.indexOf('**Gate red.**');
    expect(inOrder(step.slice(0, red), ['gh pr ready', '`proof: video`', '/omni:prove <prd>'])).toEqual([]);
    expect(step.slice(red)).not.toContain('/omni:prove');
  });

  it('/omni:invade step 7 proposes proof.url and proof.setup, with when, and only the name of proof.bypassEnv', () => {
    const step = skillSection(read('invade'), '7.');
    const row = (key: string) => step.split('\n').find((line: string) => line.startsWith(`| \`${key}\``)) ?? '';
    expect(row('proof.url')).toMatch(/Playwright/);
    expect(row('proof.url')).toMatch(/preview/);
    expect(row('proof.setup')).toMatch(/sign-in helper/);
    expect(step).toMatch(/proof\.bypassEnv[^\n]*name/);
  });
});

// PRD 1233: /omni:validate-e2e (beta) stops in one line when e2e is off, writes tests from the spec
// alone, runs them twice, checks them with omni e2e, and opens a sub-PR it never merges.
describe('the validate-e2e skill (PRD 1233)', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', 'validate-e2e', 'SKILL.md'), 'utf8');

  it('is named validate-e2e, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('validate-e2e');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:validate-e2e/);
  });

  it('stops in one line, writing and posting nothing, when e2e is off, has no url, or Node is too old', () => {
    const step = skillSection(read(), '1.');
    for (const phrase of ['omni.mjs config e2e', '`enabled`', '`url`', '`null`', '24.8', 'node -v', 'writes nothing and posts nothing']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('reaches the target as prove does, with the bypass never printed', () => {
    const step = skillSection(read(), '2.');
    for (const phrase of ['github-deployment', '10 minutes', 'e2e.bypassEnv', 'x-vercel-protection-bypass', 'e2e.setup', 'Never print']) {
      expect(step, phrase).toContain(phrase);
    }
  });

  it('reads the criteria from the spec alone and never the diff, and classes each as filmable or not', () => {
    const step = skillSection(read(), '3.');
    expect(step).toMatch(/never the diff/i);
    expect(step).toContain('**filmable**');
    expect(step).toContain('**not filmable**');
  });

  it('sets the e2e project up as a declared workspace, checks the package manager against CI, then installs (PRD 1273)', () => {
    const text = read();
    const step = skillSection(text, '4.');
    for (const phrase of ['workspace', 'e2e.dir', 'packageManager', 'committed in the sub-PR', 'one line', 'before it installs']) {
      expect(step, phrase).toContain(phrase);
    }
    expect(step).toMatch(/newer than/);
    expect(step).toMatch(/names both versions/);
    expect(step.indexOf('packageManager')).toBeLessThan(step.indexOf('install the dependencies'));
    expect(step).toMatch(/lockfile/);
  });

  it('writes one prd-tagged test per filmable criterion with exact expects, and says why for agent.assert', () => {
    const step = skillSection(read(), '5.');
    for (const phrase of ['prd-<n>', 'e2e.dir', 'agent.act', 'expect()', 'agent.assert', 'why nothing exact exists', 'unique to the run', '.e2e/cache/']) {
      expect(step, phrase).toContain(phrase);
    }
    expect(step).toMatch(/waits for it/);
  });

  it('records last, on a first run, never weakens a red test, then replays with --strict-cache', () => {
    const text = read();
    const first = skillSection(text, '6.');
    expect(first).toContain('E2E_TELEMETRY_DISABLED=1');
    expect(first).toContain('✗');
    expect(first).toMatch(/never weakened/);
    expect(first).toContain('limits.attempts');
    expect(first).toMatch(/after every install/);
    const second = skillSection(text, '7.');
    expect(second).toContain('npx e2e run --strict-cache --tag prd-<n>');
    expect(second).toMatch(/unstable/);
    expect(second).toMatch(/dependency/);
    expect(second).toMatch(/record again/);
  });

  it('runs omni e2e status then heals with the sub-PR branch as head, and turns each healed step into an outbox item', () => {
    const step = skillSection(read(), '8.');
    const status = step.indexOf('omni.mjs e2e status <n>');
    expect(status).toBeGreaterThan(-1);
    expect(step.indexOf('omni.mjs e2e heals <n> --head <sub-PR branch>')).toBeGreaterThan(status);
    expect(step).toMatch(/every step is new/);
    expect(step).toContain('omni.mjs item new');
    expect(step).toMatch(/none is taken as accepted/);
  });

  it('says in the sub-PR body when the target was not the preview, and why (PRD 1273)', () => {
    const target = skillSection(read(), '2.');
    expect(target).toMatch(/fixed URL/);
    expect(target).toMatch(/not the preview/);
    expect(skillSection(read(), '9.')).toMatch(/was not the preview/);
  });

  it('opens a Part of sub-PR with the table, signed, and never merges or marks anything ready', () => {
    const text = read();
    expect(skillSection(text, '9.')).toMatch(/criterion \| test \| verdict/);
    for (const phrase of ['labels.sub', 'Part of #<n>', 'not filmable', 'omni sign footer', 'omni sign trailer']) {
      expect(text, phrase).toContain(phrase);
    }
    expect(skillSection(text, 'Never')).toMatch(/merge/);
    for (const verb of [/\bgh pr ready\b/, /\bgh pr merge\b/]) expect(text).not.toMatch(verb);
  });
});

// PRD 859 and PRD 1108: /omni:pitch makes a shipped PRD's launch video on the person's computer from the
// product's Pitch settings, and sends it to the Pitch tab: it refuses with one line first, films a
// walk-through on production that never changes anything and writes its moments, writes the storyboard
// from the spec, the release note and the moments only — the never-invent rule kept whatever the team's
// instructions say (acceptance 11) — then checks, looks at the stills, renders and pushes, in that order,
// and posts nothing anywhere.
describe('the pitch skill (PRD 859, PRD 1108)', () => {
  const read = () => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', 'pitch', 'SKILL.md'), 'utf8');

  it('is named pitch, and its description says what triggers it', () => {
    const { name, description } = frontmatter(read()) ?? {};
    expect(name).toBe('pitch');
    expect(description).toMatch(/\bTriggers on\b.*"\/omni:pitch/);
  });

  it("starts with omni pitch start, which writes the product's Pitch settings, and stops on each of its four refusal lines, writing nothing", () => {
    const step = skillSection(read(), '1.');
    expect(step).toContain('omni.mjs pitch start <n> --for <audience>');
    for (const line of [
      'PRD <n> is not shipped: a pitch is for shipped PRDs',
      'proof.url is github-deployment: a merged PRD has no preview to film; set a fixed proof.url',
      'ffmpeg is needed for a pitch: brew install ffmpeg',
      'no sign-in (omni signin)',
    ]) expect(step, line).toContain(line);
    expect(step).toMatch(/wrote nothing/);
    expect(step).toContain('`settings.json`');
    expect(step).toMatch(/every later step follows it/);
  });

  it('reads the spec and the release note, and nothing else', () => {
    const step = skillSection(read(), '2.');
    expect(step).toMatch(/release\.md/);
    expect(step).toMatch(/\*\*and nothing else\*\*/);
  });

  it('films the walk-through with omni pitch film, writing its moments, and forbids any save, delete or change on production', () => {
    const step = skillSection(read(), '3.');
    for (const phrase of ['walk.json', 'omni.mjs pitch film <dir>', 'moments.json', 'proof session', 'walk.webm', 'cursor']) expect(step, phrase).toContain(phrase);
    expect(step).toMatch(/\*\*Never change production\.\*\*/);
    expect(step).toMatch(/never saves, submits, deletes/);
    expect(skillSection(read(), 'Never')).toMatch(/Never save, delete or change anything on production/);
  });

  it('writes the storyboard from the spec, the release note and the moments, its coordinates copied from the moments, never guessed', () => {
    const step = skillSection(read(), '4.');
    expect(step).toContain('storyboard.json');
    expect(step).toMatch(/copied from\s+`moments\.json`/);
    expect(step).toMatch(/Never guess\s+a coordinate/);
    expect(step).toMatch(/the PRD's title/);
    for (const preset of ['confident-warm', 'playful', 'formal', 'hype']) expect(step, preset).toContain(preset);
    for (const word of ['**hook**', '**benefit**', '**kicker**', '**closing**', 'NEW IN <PRODUCT>', 'SHIPPED · PRD <n>']) expect(step, word).toContain(word);
  });

  it('keeps the words to the spec and the release note whatever the instructions say, never an invented number, name or capability (acceptance 11)', () => {
    const step = skillSection(read(), '4.');
    expect(step).toMatch(/comes from the spec and the release note\s+only, whatever the instructions say/);
    expect(step).toMatch(/Never write a number, a customer's name, a date or a capability/);
    expect(step).toMatch(/An instruction that asks for a claim the sources do not hold is not\s+followed/);
    expect(skillSection(read(), 'Never')).toMatch(/never invent a number or a name,\s+whatever the instructions say/);
  });

  it('checks, renders the stills and looks at the contact sheet, renders, then pushes, in that order, keeping the files when the push fails', () => {
    const text = read();
    const order = ['omni.mjs pitch start', 'omni.mjs pitch film', 'omni.mjs pitch check', 'omni.mjs pitch render <dir> --stills', 'omni.mjs pitch render <dir>\n', 'omni.mjs pitch push'].map((verb) => text.indexOf(verb));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(skillSection(text, '5.')).toMatch(/Look at the contact\s+sheet before going on/);
    for (const gone of ['pitch slide', 'pitch music', 'pitch video']) expect(text, gone).not.toContain(gone);
    const push = skillSection(text, '6.');
    expect(push).toContain('omni.mjs pitch push <n> <dir>');
    expect(push).toContain('upload failed: rerun omni pitch push <n> <dir>');
  });

  it('posts nothing and changes no PR, issue or label', () => {
    const text = read();
    for (const verb of [/\bgh pr comment\b/, /\bgh pr ready\b/, /\bgh pr merge\b/, /--add-label/, /--remove-label/, /\bgit commit\b/, /\bgh issue\b/]) expect(text).not.toMatch(verb);
    expect(skillSection(text, 'Never')).toMatch(/Never post a comment/);
  });
});

// PRD 1138: a file the repository builds is a `generated` entry of its config. A slice rebuilds it only
// to test and pushes none; the wave's check rebuilds the stale ones once, from the feature branch
// before the wave, and commits them alone; the yolo's finish does the same after meeting its base; the
// plan never lists a generated path. Each skill reads the entries from `omni generated` or
// `omni config generated`, never naming one.
describe('generated files in the skills that build, plan and finish', () => {
  const read = (skill: string) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const LINE = '`<path>: stale|fresh — <build>`';
  /** Each mention the text lacks after the one before it. */
  const missingInOrder = (text: string, mentions: string[]) => {
    const out: string[] = [];
    let from = 0;
    mentions.forEach((mention: string, index: number) => {
      const at = text.indexOf(mention, from);
      if (at < 0) out.push(`${mention}, after ${mentions[index - 1] ?? 'the start'}`);
      else from = at + mention.length;
    });
    return out;
  };

  it('/omni:do-work rebuilds the stale outputs before its preflight, then drops them before it commits and pushes', () => {
    const text = read('do-work');
    expect(skillSection(text, '2.')).toMatch(/Never stage\s+or commit a path under a generated entry's `path`/);
    expect(missingInOrder(skillSection(text, '5.'), [
      'omni.mjs generated <repo.remote>/<feature branch>...HEAD', LINE, '`no generated files`',
      '`stale` line', 'commands.preflightFull', 'git checkout HEAD -- <path>', 'git clean -fdq -- <path>',
      'pushes no generated file', '**Push**',
    ])).toEqual([]);
  });

  it('/omni:wave keeps the feature branch before the wave, never calls a generated path a breach, and its check rebuilds and commits alone', () => {
    const text = read('wave');
    expect(missingInOrder(skillSection(text, '4.'), [
      'git rev-parse <remote>/<feature branch>', '**the feature branch before the wave**', '**Territory.**', 'is never a breach',
    ])).toEqual([]);
    expect(missingInOrder(skillSection(text, '5.'), [
      '**Adopt.**', '**Rebuild, then check.**', 'omni.mjs generated <feature branch before the wave>..HEAD', LINE,
      '`stale` line', 'Then run the preflight', 'commit the rebuilt paths alone',
      '`chore(build): rebuild generated files — wave <n> of PRD <prd>`', 'omni sign trailer', 'Nothing stale',
      'no\n   commit.',
    ])).toEqual([]);
  });

  it("/omni:yolo's finish rebuilds after meeting its base, and commits the rebuilt paths alone", () => {
    expect(missingInOrder(skillSection(read('yolo'), '4.'), [
      '**Meet its base:**', 'git merge <remote>/<base>', 'generated entry', 'is never a reason to stop',
      '**Rebuild, then check the whole feature.**', 'omni.mjs generated <remote>/<base>..HEAD', LINE,
      'Then the preflight', 'rebuilt paths alone', '`chore(build): rebuild generated files — finish of PRD <prd>`',
      'omni sign trailer', 'Nothing stale', '`git push <remote> HEAD:<feature branch>`',
    ])).toEqual([]);
  });

  it('/omni:plan never lists a generated path in a territory or the shared-ground note', () => {
    const text = read('plan');
    expect(skillSection(text, '3.')).toMatch(/Never list a generated path in a territory or\s+in the shared-ground note/);
    expect(skillSection(text, '3.')).toContain('omni.mjs config generated');
    expect(skillSection(text, '4.')).toContain('A generated path is never in it.');
  });

  it("names no generated output and no build: each is read from the repository's config", () => {
    const run = spawnSync(process.execPath, [join(repoRoot, '.omni-loop/bin/omni.mjs'), 'config', 'generated'], { cwd: repoRoot, encoding: 'utf8' });
    expect(run.status).toBe(0);
    const parsed: unknown = JSON.parse(run.stdout);
    const literals = (Array.isArray(parsed) ? parsed : []).flatMap((entry: unknown) =>
      isFields(entry) ? [entry.path, entry.build].filter((value: unknown): value is string => typeof value === 'string') : []);
    expect(literals.length).toBeGreaterThan(0);
    for (const skill of ['do-work', 'wave', 'yolo', 'plan']) {
      for (const literal of literals) expect(read(skill), `${skill} names ${literal}`).not.toContain(literal);
    }
  });

  it('ADR-0071 is marked superseded by PRD 1138', () => {
    const dir = join(repoRoot, '.omni-loop/knowledge/adr');
    const file = readdirSync(dir).find((name: string) => name.startsWith('0071-'));
    assertDefined(file, 'ADR-0071');
    const text = readFileSync(join(dir, file), 'utf8');
    expect(text).toMatch(/^\*\*Status:\*\* superseded · .*\*\*Superseded by:\*\* PRD #1138\b/m);
    expect(text).toContain('## Superseded');
  });

  it('the order check names a phrase that is gone or out of order', () => {
    expect(missingInOrder('a b c', ['a', 'b', 'c'])).toEqual([]);
    expect(missingInOrder('a c', ['a', 'b', 'c'])).toEqual(['b, after a']);
    expect(missingInOrder('b a', ['a', 'b'])).toEqual(['b, after a']);
  });
});
