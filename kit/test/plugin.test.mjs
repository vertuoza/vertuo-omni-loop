// The `omni` plugin's guard: its skills parse, name only commands the CLI has, sign the loop's work,
// and its manifests agree. Each rule runs on the live repository, then on a fixture built to break it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { COMMAND_TABLE } from '../bin/commands/index.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PLUGIN_DIR = 'kit/plugin';
const MARKETPLACE = '.claude-plugin/marketplace.json';
const MANIFEST = '.claude-plugin/plugin.json';

// `omni.mjs <cmd>` (a Bash step) and `` `omni <cmd>` `` (prose). `/omni:<skill>` never matches.
const COMMAND_MENTIONS = [/omni\.mjs\s+([a-z][\w-]*)/g, /`omni\s+([a-z][\w-]*)/g];

function skillFiles(root) {
  const skills = join(root, PLUGIN_DIR, 'skills');
  if (!existsSync(skills)) return [];
  return readdirSync(skills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PLUGIN_DIR, 'skills', entry.name, 'SKILL.md'));
}

function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return null;
  try {
    const data = parseYaml(match[1]);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** Every SKILL.md has frontmatter with a non-empty `name` and `description`. */
function skillFrontmatterViolations(root) {
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
      if (typeof data[key] !== 'string' || data[key].trim() === '') out.push(`${file}: frontmatter lacks ${key}`);
    }
  }
  return out;
}

/** Skill names the plugin retired, and the skill that replaced each (PRD #68). */
const RETIRED_SKILLS = { terraform: 'invade' };

/** No skill folder, and no SKILL.md `name`, uses a retired skill name. */
function retiredSkillViolations(root) {
  const out = [];
  for (const file of skillFiles(root)) {
    const folder = file.split('/').at(-2);
    if (Object.hasOwn(RETIRED_SKILLS, folder)) out.push(`${file}: the ${folder} skill was renamed ${RETIRED_SKILLS[folder]}`);
    const data = existsSync(join(root, file)) ? frontmatter(readFileSync(join(root, file), 'utf8')) : null;
    if (data && Object.hasOwn(RETIRED_SKILLS, data.name) && data.name !== folder) {
      out.push(`${file}: names itself ${data.name}, renamed ${RETIRED_SKILLS[data.name]}`);
    }
  }
  return out;
}

/** Every `omni <command>` a text names, in both mention forms, in the order they appear per form. */
function commandMentions(text) {
  return COMMAND_MENTIONS.flatMap((pattern) => [...text.matchAll(pattern)].map(([, name]) => name));
}

/** Every `omni <command>` a SKILL.md names is a key of the command table. */
function unknownCommandViolations(root, commands) {
  const out = [];
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
function skillSection(text, start) {
  const lines = text.split('\n');
  const from = lines.findIndex((line) => line.startsWith(`## ${start}`));
  if (from < 0) return '';
  const to = lines.findIndex((line, index) => index > from && line.startsWith('## '));
  return lines.slice(from, to < 0 ? undefined : to).join('\n');
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
const namesSign = (line) => new RegExp(`(?:\`omni|omni\\.mjs)\\s+sign\\s+${line}\\b`);

/**
 * Every SKILL.md that asks for the co-author trailer names `omni sign trailer`, and every one that
 * opens a pull request or an issue, or rewrites its body, names `omni sign footer`.
 */
function signingViolations(root) {
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

function readJson(root, file, out) {
  try {
    return JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (error) {
    out.push(`${file}: ${error.code === 'ENOENT' ? 'missing' : `does not parse (${error.message})`}`);
    return null;
  }
}

/** The marketplace lists the plugin by its relative source, and both manifests give it one name. */
function manifestViolations(root) {
  const out = [];
  const manifestFile = join(PLUGIN_DIR, MANIFEST);
  const manifest = readJson(root, manifestFile, out);
  const marketplace = readJson(root, MARKETPLACE, out);
  if (!manifest || !marketplace) return out;
  const entry = (marketplace.plugins ?? []).find(
    (plugin) => typeof plugin.source === 'string' && resolve(root, plugin.source) === resolve(root, PLUGIN_DIR),
  );
  if (!entry) return [...out, `${MARKETPLACE}: no plugin entry has source ./${PLUGIN_DIR}`];
  if (entry.name !== manifest.name) {
    out.push(`${MARKETPLACE}: entry names the plugin "${entry.name}", ${manifestFile} names it "${manifest.name}"`);
  }
  return out;
}

function onPath(command) {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

/** `claude plugin validate <path>`: `null` when it passes, its output when it does not. */
function claudeValidate(path) {
  const run = spawnSync('claude', ['plugin', 'validate', path], { encoding: 'utf8' });
  return run.status === 0 ? null : `${run.stdout}${run.stderr}`;
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'omni-plugin-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const claude = onPath('claude');
const reason = claude ? '' : ' (skipped: claude is not on PATH)';
// Vitest's reporters do not list skipped tests by name, so the reason is also said out loud.
if (!claude) console.warn('kit/test/plugin.test.mjs: claude plugin validate checks skipped — claude is not on PATH');

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
    expect(frontmatter(readFileSync(join(repoRoot, PLUGIN_DIR, 'skills/invade/SKILL.md'), 'utf8')).name).toBe('invade');
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

// PRD 216: two small skills each wrap one verb of `omni dossier`, and the brainstorm and the plan
// follow them at the steps the spec names, each after what it must come after.
describe('the dossier skills in this repository', () => {
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const expectAfter = (text, anchor, mention) => {
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
    const skill = (name, ...lines) => ['---', `name: ${name}`, 'description: d', '---', ...lines].join('\n');
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
    const skill = (name, ...lines) => ['---', `name: ${name}`, 'description: d', '---', ...lines].join('\n');
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
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const NOTE = ['releaseNotes.enabled', 'kb show releasing', 'check releases', 'docs(release): PRD <prd> release note'];
  const expectInOrder = (text, mentions) => {
    let from = 0;
    mentions.forEach((mention, index) => {
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
    const line = skillSection(yolo, '5.').split('\n').find((text) => text.startsWith(`${item}. `));
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
});
