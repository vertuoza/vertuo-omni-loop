import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.mjs';
import { FORM_IDS, FORMS, parseForm } from './forms.mjs';
import { fillConfig } from './resolve.mjs';
import { FRONT_DOOR_TEMPLATE, formTemplate, frontDoorTemplate, readTemplates, templatePath } from './templates.mjs';

const kitRoot = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(kitRoot, 'dist/omni.mjs');
const PROVENANCE = /^<!-- Ported from vertuo-ai-domain@db67fd9da:(.+) — changes in (kit\/porting\/templates--[a-z-]+\.md) -->$/m;

/** Every template's text, keyed by its path under the templates folder: the thirteen forms, then the front door. */
const ALL = () => [...FORM_IDS.map((id) => [templatePath(id), formTemplate(id)]), [FRONT_DOOR_TEMPLATE, frontDoorTemplate()]];

describe('the kit’s templates folder', () => {
  it('holds one template per form and the front door’s README, and nothing else', () => {
    expect(Object.keys(readTemplates()).sort()).toEqual([FRONT_DOOR_TEMPLATE, ...FORM_IDS.map(templatePath)].sort());
    expect(templatePath('testing')).toBe('playbook/testing.md');
    expect(templatePath('decisions')).toBe('playbook/decisions.md');
    expect(FRONT_DOOR_TEMPLATE).toBe('README.md');
  });

  it('refuses a form the kit does not have', () => {
    expect(() => formTemplate('deploying')).toThrow('the kit has no form "deploying"');
  });
});

describe('each form template — the forms table, as the one parser reads it', () => {
  for (const form of FORMS) {
    it(`${form.id}: parses as its form, blank, and declares exactly its slots, required as marked, in order`, () => {
      const parsed = parseForm(formTemplate(form.id), { file: templatePath(form.id) });
      expect(parsed.errors ?? []).toEqual([]);
      expect(parsed.form).toMatchObject({ id: form.id, formVersion: 1, state: 'blank', pointsTo: null, evidence: [], invaded: null, oldSpellings: [], unmarked: [] });
      expect(parsed.form.slots.map((slot) => ({ id: slot.id, required: slot.required }))).toEqual(
        form.slots.map((slot) => ({ id: slot.id, required: slot.required })),
      );
      expect(parsed.form.slots.every((slot) => slot.by === null && slot.verified === null)).toBe(true);
    });

    it(`${form.id}: has a title and an opener, and a kit default in every slot`, () => {
      const { form: parsed } = parseForm(formTemplate(form.id));
      expect(parsed.title).toMatch(/\S/);
      expect(parsed.opener).toMatch(/^Use this page when /);
      for (const slot of parsed.slots) {
        expect({ slot: slot.id, kind: slot.body.kind, questions: slot.body.questions }).toEqual({ slot: slot.id, kind: 'text', questions: [] });
      }
    });
  }
});

describe('every template — provenance, and the config it names', () => {
  it('carries one provenance line pinned to vertuo-ai-domain@db67fd9da, naming a porting record that exists', () => {
    for (const [path, text] of ALL()) {
      const match = text.match(PROVENANCE);
      expect(match, `${path} has no provenance line`).not.toBeNull();
      expect(existsSync(join(kitRoot, '..', match[2])), `${path}: ${match[2]} is missing`).toBe(true);
    }
  });

  it('names only config keys that hold one value — never an unknown key, a list or a section', () => {
    const config = ConfigSchema.parse({ kit: 1 });
    for (const [path, text] of ALL()) {
      const wrong = fillConfig(text, config).unresolved.filter(({ reason }) => reason !== 'is not set in the config');
      expect(wrong, path).toEqual([]);
    }
  });

  it('the testing form’s commands default names the repository’s test command', () => {
    const config = ConfigSchema.parse({ kit: 1, commands: { test: 'make check' } });
    const commands = parseForm(formTemplate('testing')).form.slots.find((slot) => slot.id === 'commands');
    expect(fillConfig(commands.body.text, config).text).toContain('make check');
  });

  it('the front door’s README names the playbook, the knowledge registers and the decision records by config', () => {
    const text = frontDoorTemplate();
    for (const key of ['paths.playbook', 'paths.knowledge', 'paths.adr']) expect(text).toContain(`{config:${key}}`);
    expect(text).not.toMatch(/^---/);
  });
});

describe('the committed bundle carries the same templates', () => {
  it('from source and from kit/dist/omni.mjs alone, the same loader returns the same text', () => {
    const alone = join(mkdtempSync(join(tmpdir(), 'omni-templates-')), 'omni.mjs');
    copyFileSync(DIST, alone);
    const script = [
      `import { formTemplate, frontDoorTemplate } from ${JSON.stringify(pathToFileURL(alone).href)};`,
      `const ids = ${JSON.stringify(FORM_IDS)};`,
      'process.stdout.write(JSON.stringify([...ids.map((id) => formTemplate(id)), frontDoorTemplate()]));',
    ].join('\n');
    const run = spawnSync('node', ['--input-type=module', '-e', script], { cwd: tmpdir(), encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toEqual(ALL().map(([, text]) => text));
  });
});
