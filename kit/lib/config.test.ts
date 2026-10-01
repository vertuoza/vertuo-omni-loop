import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.ts';
import { makeRepo } from '../test/fixture.ts';
import { CONFIG_FILE, ConfigError, MIGRATIONS, dossierSwitch, loadConfig, migrateConfig, parseConfig } from './config.ts';

describe('parseConfig', () => {
  it('fills every section from defaults when only the version is given', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.paths.delivery).toBe('.omni-loop/delivery');
    expect(config.paths.knowledge).toBe('.omni-loop/knowledge');
    expect(config.labels.outboxGo).toBe('omni:outbox-go');
    expect(config.markers.prefix).toBe('omni-outbox');
    expect(config.laws.source).toBe('none');
    expect(config.ci.outboxContext).toBe('outbox');
    expect(config.limits).toEqual({ stallDays: 5, attempts: 3, claimStaleMinutes: 60, beforeAfterMaxBytes: 512000 });
    expect(config.risk).toEqual({ storedShape: [], sharedContract: [] });
    expect(config.notify.slack).toBeNull();
    expect(config.ask).toEqual({ url: null });
  });

  it('names the inbox check "inbox" unless the file renames it, and refuses a name that is not text (PRD 675)', () => {
    expect(parseConfig('kit: 1\n').ci.inboxContext).toBe('inbox');
    expect(parseConfig('kit: 1\nci:\n  inboxContext: omni/inbox\n').ci.inboxContext).toBe('omni/inbox');
    expect(parseConfig('kit: 1\nci:\n  inboxContext: omni/inbox\n').ci.outboxContext).toBe('outbox');
    expect(() => parseConfig('kit: 1\nci:\n  inboxContext: 3\n', 'c.yml')).toThrow(/c\.yml.*ci\.inboxContext/);
    expect(() => parseConfig('kit: 1\nci:\n  inboxContext: [inbox]\n')).toThrow(/ci\.inboxContext/);
    expect(() => parseConfig('kit: 1\nci:\n  inboxContext: ""\n')).toThrow(/ci\.inboxContext/);
  });

  it('takes an https ask.url, or http only on 127.0.0.1', () => {
    expect(parseConfig('kit: 1\nask:\n  url: https://ask.example.com\n').ask.url).toBe('https://ask.example.com');
    expect(parseConfig('kit: 1\nask:\n  url: http://127.0.0.1:4321\n').ask.url).toBe('http://127.0.0.1:4321');
    expect(() => parseConfig('kit: 1\nask:\n  url: http://ask.example.com\n')).toThrow(/ask\.url/);
    expect(() => parseConfig('kit: 1\nask:\n  url: http://localhost:4321\n')).toThrow(/ask\.url/);
    expect(() => parseConfig('kit: 1\nask:\n  url: ftp://ask.example.com\n')).toThrow(/ask\.url/);
    expect(() => parseConfig('kit: 1\nask:\n  url: not a url\n')).toThrow(/ask\.url/);
    expect(() => parseConfig('kit: 1\nask:\n  link: https://ask.example.com\n')).toThrow(/ask.*link/s);
  });

  it('keeps dossiers off unless the file switches them on, and refuses a switch that is not a boolean (PRD 216)', () => {
    expect(parseConfig('kit: 1\n').dossier).toEqual({ enabled: false });
    expect(parseConfig('kit: 1\ndossier:\n  enabled: true\n').dossier).toEqual({ enabled: true });
    expect(() => parseConfig('kit: 1\ndossier:\n  enabled: yes please\n', 'c.yml')).toThrow(/c\.yml.*dossier\.enabled/);
    expect(() => parseConfig('kit: 1\ndossier:\n  enabled: "true"\n')).toThrow(/dossier\.enabled/);
    expect(() => parseConfig('kit: 1\ndossier:\n  enabled: 1\n')).toThrow(/dossier\.enabled/);
    expect(() => parseConfig('kit: 1\ndossier:\n  on: true\n')).toThrow(/dossier.*on/s);
  });

  it('keeps release notes off unless the file switches them on, and refuses a switch that is not a boolean (PRD 262)', () => {
    expect(parseConfig('kit: 1\n').releaseNotes).toEqual({ enabled: false });
    expect(parseConfig('kit: 1\nreleaseNotes:\n  enabled: true\n').releaseNotes).toEqual({ enabled: true });
    expect(parseConfig('kit: 1\nreleaseNotes: { enabled: false }\n').releaseNotes).toEqual({ enabled: false });
    expect(() => parseConfig('kit: 1\nreleaseNotes:\n  enabled: yes please\n', 'c.yml')).toThrow(/c\.yml.*releaseNotes\.enabled/);
    expect(() => parseConfig('kit: 1\nreleaseNotes:\n  enabled: "true"\n')).toThrow(/releaseNotes\.enabled/);
    expect(() => parseConfig('kit: 1\nreleaseNotes:\n  enabled: 1\n')).toThrow(/releaseNotes\.enabled/);
    expect(() => parseConfig('kit: 1\nreleaseNotes:\n  on: true\n')).toThrow(/releaseNotes.*on/s);
  });

  it('keeps the answers switch on unless the file switches it off, and refuses one that is not a boolean (PRD 251)', () => {
    expect(parseConfig('kit: 1\n').answers).toEqual({ enabled: true });
    expect(parseConfig('kit: 1\nanswers:\n  enabled: false\n').answers).toEqual({ enabled: false });
    expect(() => parseConfig('kit: 1\nanswers:\n  enabled: yes please\n', 'c.yml')).toThrow(/c\.yml.*answers\.enabled/);
    expect(() => parseConfig('kit: 1\nanswers:\n  enabled: "false"\n')).toThrow(/answers\.enabled/);
    expect(() => parseConfig('kit: 1\nanswers:\n  enabled: 0\n')).toThrow(/answers\.enabled/);
    expect(() => parseConfig('kit: 1\nanswers:\n  on: true\n')).toThrow(/answers.*on/s);
  });

  it('names the retro label and the retro branch when the config sets neither', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.labels.retro).toBe('omni:retro');
    expect(config.branches.retro).toBe('docs/retro-{topic}');
  });

  it('reads back a retro label and a retro branch the config sets', () => {
    const config = parseConfig('kit: 1\nlabels:\n  retro: looking-back\nbranches:\n  retro: retro/{topic}\n');
    expect(config.labels.retro).toBe('looking-back');
    expect(config.branches.retro).toBe('retro/{topic}');
  });

  it('names the knowledge label and the knowledge branch when the config sets neither', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.labels.knowledge).toBe('omni:knowledge');
    expect(config.branches.knowledge).toBe('docs/knowledge-{topic}');
  });

  it('reads back a knowledge label and a knowledge branch the config sets', () => {
    const config = parseConfig('kit: 1\nlabels:\n  knowledge: harvested\nbranches:\n  knowledge: kb/{topic}\n');
    expect(config.labels.knowledge).toBe('harvested');
    expect(config.branches.knowledge).toBe('kb/{topic}');
  });

  it('names the visual label when the config does not set it', () => {
    expect(parseConfig('kit: 1\n').labels.visual).toBe('omni:visual');
  });

  it('reads back a visual label the config sets', () => {
    expect(parseConfig('kit: 1\nlabels:\n  visual: looks\n').labels.visual).toBe('looks');
  });

  it('names the bug-fix labels when the config does not set them (PRD 556)', () => {
    expect(parseConfig('kit: 1\n').labels).toMatchObject({
      bug: 'omni:bug',
      regression: 'omni:regression',
      riskCritical: 'omni:risk-critical',
      riskHigh: 'omni:risk-high',
      riskMedium: 'omni:risk-medium',
      riskLow: 'omni:risk-low',
    });
  });

  it('reads back bug-fix labels the config sets', () => {
    const text = 'kit: 1\nlabels:\n  bug: defect\n  regression: broke\n  riskCritical: p0\n  riskHigh: p1\n  riskMedium: p2\n  riskLow: p3\n';
    expect(parseConfig(text).labels).toMatchObject({
      bug: 'defect', regression: 'broke', riskCritical: 'p0', riskHigh: 'p1', riskMedium: 'p2', riskLow: 'p3',
    });
  });

  it('names the concept label and the concept branch when the config sets neither (PRD 686)', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.labels.concept).toBe('omni:concept');
    expect(config.branches.concept).toBe('docs/concept-{topic}');
  });

  it('reads back a concept label and a concept branch the config sets (PRD 686)', () => {
    const config = parseConfig('kit: 1\nlabels:\n  concept: big-idea\nbranches:\n  concept: concept/{topic}\n');
    expect(config.labels.concept).toBe('big-idea');
    expect(config.branches.concept).toBe('concept/{topic}');
  });

  it('has no mutation command unless the config sets one (PRD 556)', () => {
    expect(parseConfig('kit: 1\n').commands.mutation).toBeNull();
    expect(parseConfig('kit: 1\ncommands:\n  mutation: pnpm stryker run\n').commands.mutation).toBe('pnpm stryker run');
  });

  it('puts the playbook under the knowledge folder and names the invade branch when both are unset', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.paths.playbook).toBe('.omni-loop/knowledge/playbook');
    expect(config.branches.invade).toBe('docs/omni-invade');
  });

  it('keeps a playbook folder and an invade branch the file sets', () => {
    const config = parseConfig('kit: 1\npaths:\n  playbook: handbook/how-we-work\nbranches:\n  invade: chore/fill-forms\n');
    expect(config.paths.playbook).toBe('handbook/how-we-work');
    expect(config.branches.invade).toBe('chore/fill-forms');
  });

  it('refuses the renamed branch key, naming the key that replaced it', () => {
    let error: any;
    try { parseConfig('kit: 1\nbranches:\n  terraform: docs/omni-terraform\n', 'c.yml'); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.message.split('\n')[0]).toMatch(/^c\.yml.*branches\.terraform.*branches\.invade/);
  });

  it('still refuses a key the schema does not hold beside the new ones', () => {
    expect(() => parseConfig('kit: 1\npaths:\n  playbooks: x\n', 'c.yml')).toThrow(/c\.yml.*paths.*playbooks/s);
    expect(() => parseConfig('kit: 1\nbranches:\n  invades: x\n', 'c.yml')).toThrow(/branches.*invades/s);
  });

  it('refuses a missing or wrong schema version', () => {
    expect(() => parseConfig('repo: {}\n', 'c.yml')).toThrow(/c\.yml.*kit/s);
    expect(() => parseConfig('kit: 2\n', 'c.yml')).toThrow(ConfigError);
  });

  it('names the file, the key path and the unknown key for a typo', () => {
    let error: any;
    try { parseConfig('kit: 1\nlabels:\n  outboxgo: go\n', '.omni-loop/config.yml'); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.message).toContain('.omni-loop/config.yml');
    expect(error.message).toContain('labels');
    expect(error.message).toContain('outboxgo');
  });

  it('refuses acceptance enabled without a directory', () => {
    expect(() => parseConfig('kit: 1\nacceptance:\n  enabled: true\n')).toThrow(/acceptance\.dir/);
  });

  it('refuses a risk pattern that is not a regular expression', () => {
    expect(() => parseConfig("kit: 1\nrisk:\n  storedShape: ['(']\n")).toThrow(/risk\.storedShape\.0/);
  });

  it('refuses a marker prefix that could break an HTML comment', () => {
    expect(() => parseConfig('kit: 1\nmarkers:\n  prefix: "a -->"\n')).toThrow(/markers\.prefix/);
  });

  it('reports YAML syntax errors with the file', () => {
    expect(() => parseConfig('kit: [1\n', 'x.yml')).toThrow(/x\.yml/);
  });
});

describe('dossierSwitch (PRD 216)', () => {
  const at = (yaml: string) => dossierSwitch(parseConfig(`kit: 1\n${yaml}`));

  it('is off by default, saying the switch is off', () => {
    expect(at('ask:\n  url: https://ask.example.com\n')).toEqual({ on: false, reason: 'dossier.enabled is false' });
  });

  it('is on when the file switches it on and ask.url is set, naming where the switch is', () => {
    expect(at('ask:\n  url: https://ask.example.com\ndossier:\n  enabled: true\n')).toEqual({
      on: true,
      reason: 'dossier.enabled is true in .omni-loop/config.yml',
      askUrl: 'https://ask.example.com',
    });
  });

  it('reads true with ask.url null as off, saying ask.url is not set', () => {
    expect(at('dossier:\n  enabled: true\n')).toEqual({ on: false, reason: 'ask.url is not set' });
    expect(at('ask:\n  url: null\ndossier:\n  enabled: true\n')).toEqual({ on: false, reason: 'ask.url is not set' });
  });
});

describe('the signature section (PRD #99, PRD #215)', () => {
  const DEFAULT = {
    name: 'Omni-man',
    email: '333776611+omni-loop-invader[bot]@users.noreply.github.com',
    home: 'https://vertuo-omni-loop-galaxy.vercel.app',
    footer: '🦸 {name} by [Omni Loop]({home}) ©',
  };

  it('signs as Omni-man, linking home, when the file has no signature section', () => {
    expect(parseConfig('kit: 1\n').signature).toEqual(DEFAULT);
  });

  it('keeps the defaults for the keys an override leaves out', () => {
    const config = parseConfig('kit: 1\nsignature:\n  name: Robo\n  email: robo@example.com\n');
    expect(config.signature).toEqual({ ...DEFAULT, name: 'Robo', email: 'robo@example.com' });
  });

  it('moves the link alone when an override sets only home', () => {
    expect(parseConfig('kit: 1\nsignature:\n  home: https://example.com\n').signature).toEqual({
      ...DEFAULT,
      home: 'https://example.com',
    });
  });

  it('refuses a home that is not an absolute https URL, naming signature.home', () => {
    for (const home of ['http://example.com', 'http://127.0.0.1:4321', 'ftp://example.com', 'not a url', 'example.com', '""', 'null']) {
      expect(() => parseConfig(`kit: 1\nsignature:\n  home: ${home}\n`), home).toThrow(/signature\.home/);
    }
  });

  it('refuses a home that would break the footer line: a space or a line break in it', () => {
    for (const home of ['"https://example.com/a b"', '"https://example.com/\\nnext"']) {
      expect(() => parseConfig(`kit: 1\nsignature:\n  home: ${home}\n`), home).toThrow(/signature\.home/);
    }
  });

  it('accepts signature: null, which switches signing off', () => {
    expect(parseConfig('kit: 1\nsignature: null\n').signature).toBeNull();
  });

  it('refuses an unknown key under signature, naming it', () => {
    expect(() => parseConfig('kit: 1\nsignature:\n  avatar: x.png\n', 'c.yml')).toThrow(/c\.yml.*signature.*avatar/s);
  });

  it('refuses a name or an address that would break the trailer line', () => {
    expect(() => parseConfig('kit: 1\nsignature:\n  name: "Omni <Man>"\n')).toThrow(/signature\.name/);
    expect(() => parseConfig('kit: 1\nsignature:\n  email: "a\\nb@example.com"\n')).toThrow(/signature\.email/);
    expect(() => parseConfig('kit: 1\nsignature:\n  footer: ""\n')).toThrow(/signature\.footer/);
  });
});

describe('omni config', () => {
  const io = () => {
    const out: string[] = [];
    return { out, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} } };
  };
  const files = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

  it('prints paths.playbook and branches.invade from their defaults when the file sets neither', async () => {
    const { root } = makeRepo({ git: true, files });
    for (const [key, value] of [['paths.playbook', '.omni-loop/knowledge/playbook'], ['branches.invade', 'docs/omni-invade']] as const) {
      const s = io();
      expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
  });

  it('prints labels.concept and branches.concept, from their defaults or as the file sets them (PRD 686)', async () => {
    const cases: Array<[Record<string, string>, string[][]]> = [
      [files, [['labels.concept', 'omni:concept'], ['branches.concept', 'docs/concept-{topic}']]],
      [
        { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlabels:\n  concept: big-idea\nbranches:\n  concept: concept/{topic}\n' },
        [['labels.concept', 'big-idea'], ['branches.concept', 'concept/{topic}']],
      ],
    ];
    for (const [repoFiles, expected] of cases) {
      const { root } = makeRepo({ git: true, files: repoFiles });
      for (const [key, value] of expected as Array<[string, string]>) {
        const s = io();
        expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
        expect(s.out.join('')).toBe(`${value}\n`);
      }
    }
  });

  it('prints the default signature when the file has no signature section (AC 1)', async () => {
    const { root } = makeRepo({ git: true, files });
    const s = io();
    expect(await main(['config', 'signature'], { cwd: root, ...s })).toBe(0);
    expect(JSON.parse(s.out.join(''))).toEqual({
      name: 'Omni-man',
      email: '333776611+omni-loop-invader[bot]@users.noreply.github.com',
      home: 'https://vertuo-omni-loop-galaxy.vercel.app',
      footer: '🦸 {name} by [Omni Loop]({home}) ©',
    });
  });

  it('prints signature.home, and the footer as its template, unfilled (PRD #215)', async () => {
    const { root } = makeRepo({ git: true, files });
    for (const [key, value] of [
      ['signature.home', 'https://vertuo-omni-loop-galaxy.vercel.app'],
      ['signature.footer', '🦸 {name} by [Omni Loop]({home}) ©'],
    ] as const) {
      const s = io();
      expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
  });

  it('prints releaseNotes.enabled, false by default and true once the file switches it on (PRD 262)', async () => {
    for (const [text, value] of [[files['.omni-loop/config.yml'], 'false'], ['kit: 1\nreleaseNotes:\n  enabled: true\n', 'true']]) {
      const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': text } });
      const s = io();
      expect(await main(['config', 'releaseNotes.enabled'], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
  });

  it('exits 2 for a key the schema does not hold', async () => {
    const { root } = makeRepo({ git: true, files });
    expect(await main(['config', 'paths.playbooks'], { cwd: root, ...io() })).toBe(2);
  });
});

describe('loadConfig', () => {
  it('says the repository is not installed when the file is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    expect(() => loadConfig(root)).toThrow(/not installed.*\.omni-loop\/config\.yml/s);
  });

  it('reads the file under root', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    mkdirSync(join(root, '.omni-loop'));
    writeFileSync(join(root, CONFIG_FILE), 'kit: 1\nrepo:\n  slug: acme/widgets\n');
    expect(loadConfig(root).repo.slug).toBe('acme/widgets');
  });
});

describe('branches.update and the migration step (PRD 347)', () => {
  it('names the update branch chore/omni-update-{version} when the file does not', () => {
    expect(parseConfig('kit: 1\n').branches.update).toBe('chore/omni-update-{version}');
  });

  it('keeps an update branch the file sets, and refuses an empty one', () => {
    expect(parseConfig('kit: 1\nbranches:\n  update: kit/{version}\n').branches.update).toBe('kit/{version}');
    expect(() => parseConfig('kit: 1\nbranches:\n  update: ""\n', 'c.yml')).toThrow(/c\.yml.*branches\.update/);
  });

  it('has no migration yet: a kit-1 file reads the same through the migration step', () => {
    expect(MIGRATIONS).toEqual([]);
    const raw = { kit: 1, branches: { feature: 'f/{topic}' } };
    expect(migrateConfig(raw)).toEqual(raw);
    expect(parseConfig('kit: 1\n', CONFIG_FILE, { migrate: true })).toEqual(parseConfig('kit: 1\n'));
  });

  it("runs each migration from the file's kit up, keeping every value", () => {
    const migrations = [
      { from: 1, migrate: (raw: any) => ({ ...raw, kit: 2, moved: raw.old }) },
      { from: 2, migrate: (raw: any) => ({ ...raw, kit: 3 }) },
    ];
    expect(migrateConfig({ kit: 1, old: 'x' }, migrations)).toEqual({ kit: 3, old: 'x', moved: 'x' });
    expect(migrateConfig({ kit: 2 }, migrations)).toEqual({ kit: 3 });
    expect(migrateConfig({ kit: 3 }, migrations)).toEqual({ kit: 3 });
  });
});

describe('the plan section and branches.megaInvade (PRD 522)', () => {
  const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
  const target = (fields: Record<string, string>) =>
    Object.entries(fields).map(([key, value], index) => `${index === 0 ? '    - ' : '      '}${key}: ${value}`).join('\n');
  const plan = (targets: Array<Record<string, string>>, guide = 'docs/git-repositories/README.md') =>
    `kit: 1\nplan:\n  guide: ${guide}\n  targets:\n${targets.map(target).join('\n')}\n`;
  const IMPORTED = { repo: 'acme/back', role: 'back-end', knowledge: 'imported', readAt: SHA };
  const OWN = { repo: 'acme/front', role: 'front-end', knowledge: 'own' };
  const NONE = { repo: 'acme/legacy', role: 'legacy', knowledge: 'none' };
  const firstLine = (source: string) => {
    try {
      parseConfig(source, 'c.yml');
    } catch (error: any) {
      return error.message.split('\n')[0];
    }
    throw new Error('it parsed');
  };

  it('leaves a config with no plan section exactly as it parses today: no plan key at all', () => {
    const config = parseConfig('kit: 1\n');
    expect(Object.hasOwn(config, 'plan')).toBe(false);
    expect(Object.keys(config)).toEqual([
      'kit', 'repo', 'github', 'branches', 'worktrees', 'paths', 'labels', 'prLinks', 'board', 'ci', 'commands',
      'acceptance', 'laws', 'risk', 'notify', 'limits', 'ask', 'dossier', 'releaseNotes', 'answers', 'proof', 'markers', 'signature',
    ]);
  });

  it('names the mega-invade branch docs/omni-mega-invade when the file does not, and keeps one it sets', () => {
    expect(parseConfig('kit: 1\n').branches.megaInvade).toBe('docs/omni-mega-invade');
    expect(parseConfig('kit: 1\nbranches:\n  megaInvade: kb/targets\n').branches.megaInvade).toBe('kb/targets');
  });

  it('reads a valid plan section: the guide, then each target in order, readAt null where it has none', () => {
    expect(parseConfig(plan([IMPORTED, OWN, NONE])).plan).toEqual({
      guide: 'docs/git-repositories/README.md',
      targets: [IMPORTED, { ...OWN, readAt: null }, { ...NONE, readAt: null }],
    });
  });

  it('takes a null guide, and reads a guide left out as null', () => {
    expect(parseConfig(plan([OWN], 'null')).plan!.guide).toBeNull();
    expect(parseConfig(`kit: 1\nplan:\n  targets:\n${target(OWN)}\n`).plan!.guide).toBeNull();
  });

  it('refuses a repo not in owner/name form, and a repo listed twice', () => {
    expect(firstLine(plan([{ ...OWN, repo: 'front' }]))).toMatch(/^c\.yml .*: plan\.targets\.0\.repo: owner\/name/);
    expect(firstLine(plan([OWN, { ...NONE, repo: 'acme/front' }]))).toMatch(/: plan\.targets\.1\.repo: acme\/front is listed twice/);
  });

  it('refuses an empty or missing targets list', () => {
    expect(firstLine('kit: 1\nplan:\n  guide: null\n  targets: []\n')).toMatch(/: plan\.targets: at least one target/);
    expect(firstLine('kit: 1\nplan:\n  guide: null\n')).toMatch(/: plan\.targets: /);
  });

  it('refuses a knowledge other than own, imported or none', () => {
    expect(firstLine(plan([{ ...OWN, knowledge: 'copied' }]))).toMatch(/: plan\.targets\.0\.knowledge: /);
  });

  it('refuses an imported target without readAt, a readAt on an own or none target, and a readAt that is not 40 hex characters', () => {
    const { readAt, ...withoutReadAt } = IMPORTED;
    expect(firstLine(plan([withoutReadAt]))).toMatch(/: plan\.targets\.0\.readAt: required when knowledge is imported/);
    expect(firstLine(plan([{ ...OWN, readAt }]))).toMatch(/: plan\.targets\.0\.readAt: only an imported target has one/);
    expect(firstLine(plan([{ ...NONE, readAt }]))).toMatch(/: plan\.targets\.0\.readAt: only an imported target has one/);
    expect(firstLine(plan([{ ...IMPORTED, readAt: '3f2a9c1' }]))).toMatch(/: plan\.targets\.0\.readAt: the full 40-character commit/);
    expect(firstLine(plan([{ ...IMPORTED, readAt: `${SHA.slice(0, 39)}g` }]))).toMatch(/: plan\.targets\.0\.readAt: the full 40-character commit/);
  });

  it('refuses a role that is not one kebab-case word', () => {
    for (const role of ['Back-end', 'back end', 'back_end', '-back', 'back-', 'back--end', '""']) {
      expect(firstLine(plan([{ ...OWN, role }])), role).toMatch(/: plan\.targets\.0\.role: one kebab-case word/);
    }
  });

  it('refuses a key the plan section or a target does not hold', () => {
    expect(firstLine(plan([{ ...OWN, url: 'x' }]))).toMatch(/: plan\.targets\.0: .*unrecognized: url/);
    expect(firstLine(`kit: 1\nplan:\n  repos: []\n  targets:\n${target(OWN)}\n`)).toMatch(/: plan: .*unrecognized: repos/);
  });
});

describe('the proof section (PRD 798)', () => {
  const firstLine = (source: string) => {
    try { parseConfig(source, 'c.yml'); } catch (error: any) { return error.message.split('\n')[0]; }
    return 'parsed';
  };

  it('is all null with maxSeconds 60 when the file has no proof section', () => {
    expect(parseConfig('kit: 1\n').proof).toEqual({ url: null, deployment: null, setup: null, bypassEnv: null, maxSeconds: 60 });
  });

  it('reads back every key the file sets', () => {
    const config = parseConfig(
      'kit: 1\nproof:\n  url: github-deployment\n  deployment: Preview – web\n  setup: pnpm proof:signin\n  bypassEnv: VERCEL_AUTOMATION_BYPASS_SECRET\n  maxSeconds: 30\n',
    );
    expect(config.proof).toEqual({
      url: 'github-deployment',
      deployment: 'Preview – web',
      setup: 'pnpm proof:signin',
      bypassEnv: 'VERCEL_AUTOMATION_BYPASS_SECRET',
      maxSeconds: 30,
    });
  });

  it('takes github-deployment or an absolute http(s) URL, and refuses anything else', () => {
    expect(parseConfig('kit: 1\nproof:\n  url: https://preview.example.com\n').proof.url).toBe('https://preview.example.com');
    expect(parseConfig('kit: 1\nproof:\n  url: http://127.0.0.1:3000\n').proof.url).toBe('http://127.0.0.1:3000');
    expect(firstLine('kit: 1\nproof:\n  url: preview\n')).toMatch(/^c\.yml.*proof\.url/);
    expect(firstLine('kit: 1\nproof:\n  url: ftp://preview.example.com\n')).toMatch(/proof\.url/);
  });

  it('refuses a maxSeconds that is not a positive whole number, naming it', () => {
    for (const bad of ['0', '-5', '1.5', 'sixty', '""']) {
      expect(firstLine(`kit: 1\nproof:\n  maxSeconds: ${bad}\n`)).toMatch(/^c\.yml.*proof\.maxSeconds/);
    }
  });

  it('refuses a bypassEnv that is not an environment variable name, and an unknown key', () => {
    expect(firstLine('kit: 1\nproof:\n  bypassEnv: the secret value\n')).toMatch(/proof\.bypassEnv/);
    expect(firstLine('kit: 1\nproof:\n  video: true\n')).toMatch(/proof.*video/);
  });

  it('is printed by omni config', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const out: string[] = [];
    const code = await main(['config', 'proof'], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(JSON.parse(out.join(''))).toEqual({ url: null, deployment: null, setup: null, bypassEnv: null, maxSeconds: 60 });
  });
});
