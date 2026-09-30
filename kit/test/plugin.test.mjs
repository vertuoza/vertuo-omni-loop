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
import { STAGE_ORDER, STAGE_WORDS } from '../lib/status/format.mjs';

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

/** The last non-blank line of a section's last fenced block, or null when it has none. */
function lastFencedLine(section) {
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
function gateRuns(text) {
  return text.split('\n').flatMap((line, index) => (GATE_RUN.test(line) ? [`${index + 1}: ${line.trim()}`] : []));
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
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const COMMAND = '/omni:yolo <n>';
  const BRAINSTORM = [
    '<folder>/', 'spec.md', 'plan.md', 'before-after.html',
    'idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro', 'you are here', 'merging the phase-0 PR moves it here',
    '**What is next?**', 'Review the PRD', 'Merge that PR', '/clear',
  ];
  const PLAN = ['**What is next?**', 'Review the plan', '/clear'];
  const HANDOFF = 'Next command: `/omni:yolo <n>`, once the phase-0 PR is merged';

  /** Each phrase the section lacks after the one before it, and a last fenced line that is not the command. */
  const handOffViolations = (section, phrases) => {
    const out = [];
    let from = 0;
    phrases.forEach((phrase, index) => {
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
    const fenced = (...lines) => ['```text', ...lines, '```'].join('\n');
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
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const YOLO = [
    '<dir>/', 'spec.md', 'plan.md', 'before-after.html', 'release.md', 'outbox/', 'settled.md',
    'idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro', 'you are here', 'merging the feature PR moves it here',
    'Review the change', 'Merge that PR', 'retro PR', 'knowledge PR',
    'Read the questions', '#issuecomment-', '/clear',
    'See what holds it', '/clear',
  ];
  // Green, red and held, in that order.
  const ENDINGS = ['Nothing to run: merging #<feature PR> is yours.', '/omni:yolo-fix <n>', '/omni:yolo <n>'];
  const WHAT_IS_NEXT = '**What is next?**';

  /** The last non-blank line of each fenced block whose first non-blank line is What is next?. */
  const endings = (section) => {
    const out = [];
    let block = null;
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
  const handOffViolations = (section) => {
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
    const fenced = (...lines) => ['```markdown', ...lines, '```'].join('\n');
    const ending = (last) => fenced(WHAT_IS_NEXT, '', '1. …', '', last, '');
    const good = ['## 7. Hand off', ...YOLO, ['```text', '  <dir>/', '```'].join('\n'), ...ENDINGS.map(ending)].join('\n');
    expect(handOffViolations(good)).toEqual([]);
    for (const [index, phrase] of YOLO.entries()) {
      expect(handOffViolations(good.replaceAll(phrase, '…')), phrase).toContain(
        `names ${phrase} after ${YOLO[index - 1] ?? 'the heading'}`,
      );
    }
    expect(handOffViolations(good.replace(ENDINGS[0], 'A person merges the feature PR.'))).toEqual([
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
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const TRACK = STAGE_ORDER.map((stage) => STAGE_WORDS[stage]).join(' ──▶ ');

  /** The fenced blocks of `text` that start with `Where it is`, or hold the track, as their lines. */
  const blocks = (text) => {
    const out = [];
    let block = null;
    for (const line of text.split('\n')) {
      if (line.trim().startsWith('```')) {
        if (block && block.some((l) => l.trim() === TRACK)) out.push(block);
        block = block ? null : [];
      } else if (block) block.push(line);
    }
    return out;
  };

  /** The stage words each line under the track starts with, in order. */
  const stageLines = (block) => block.map((line) => line.match(/^ {2}(\S+) {2,}\S/)?.[1]).filter(Boolean);

  /** The track word above the marker of "you are here". */
  const here = (block) => {
    const track = block.find((line) => line.trim() === TRACK);
    const at = block.find((line) => line.includes('└─ you are here')).indexOf('└─ you are here');
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

// PRD 563: three skills build a PRD that spans repositories, from its plan repository, each beside
// its single-repository twin and following it step for step. None merges into a default branch,
// adds the outbox override, creates a label in a target, or runs anything there but its preflight.
describe('the ultra skills in this repository', () => {
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
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
    expect(handOff).toContain('Nothing to run: merging the target PRs, then #<plan PR>, is yours.');
    expect(handOff).toContain('/omni:ultra-yolo-fix <n>');
    expect(handOff).toContain('/omni:ultra-yolo <n>');
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
  const orderGaps = (text, mentions) => {
    const out = [];
    let from = 0;
    mentions.forEach((mention, index) => {
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

// PRD 798: /omni:prove films a ready PRD's acceptance criteria and reports them, never blocking; the
// brainstorm asks for it, the yolo follows it after ready, and /omni:invade proposes its config.
describe('the prove skill and the skills that lead to it (PRD 798)', () => {
  const read = (skill) => readFileSync(join(repoRoot, PLUGIN_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
  const inOrder = (text, mentions) => {
    const out = [];
    let from = 0;
    mentions.forEach((mention, index) => {
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
    const row = (key) => step.split('\n').find((line) => line.startsWith(`| \`${key}\``)) ?? '';
    expect(row('proof.url')).toMatch(/Playwright/);
    expect(row('proof.url')).toMatch(/preview/);
    expect(row('proof.setup')).toMatch(/sign-in helper/);
    expect(step).toMatch(/proof\.bypassEnv[^\n]*name/);
  });
});
