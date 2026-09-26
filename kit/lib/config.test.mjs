import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.mjs';
import { makeRepo } from '../test/fixture.mjs';
import { CONFIG_FILE, ConfigError, loadConfig, parseConfig } from './config.mjs';

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
  });

  it('puts the playbook under the knowledge folder and names the terraform branch when both are unset', () => {
    const config = parseConfig('kit: 1\n');
    expect(config.paths.playbook).toBe('.omni-loop/knowledge/playbook');
    expect(config.branches.terraform).toBe('docs/omni-terraform');
  });

  it('keeps a playbook folder and a terraform branch the file sets', () => {
    const config = parseConfig('kit: 1\npaths:\n  playbook: handbook/how-we-work\nbranches:\n  terraform: chore/fill-forms\n');
    expect(config.paths.playbook).toBe('handbook/how-we-work');
    expect(config.branches.terraform).toBe('chore/fill-forms');
  });

  it('still refuses a key the schema does not hold beside the new ones', () => {
    expect(() => parseConfig('kit: 1\npaths:\n  playbooks: x\n', 'c.yml')).toThrow(/c\.yml.*paths.*playbooks/s);
    expect(() => parseConfig('kit: 1\nbranches:\n  terraforms: x\n', 'c.yml')).toThrow(/branches.*terraforms/s);
  });

  it('refuses a missing or wrong schema version', () => {
    expect(() => parseConfig('repo: {}\n', 'c.yml')).toThrow(/c\.yml.*kit/s);
    expect(() => parseConfig('kit: 2\n', 'c.yml')).toThrow(ConfigError);
  });

  it('names the file, the key path and the unknown key for a typo', () => {
    let error;
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

describe('omni config', () => {
  const io = () => {
    const out = [];
    return { out, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } };
  };
  const files = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

  it('prints paths.playbook and branches.terraform from their defaults when the file sets neither', async () => {
    const { root } = makeRepo({ git: true, files });
    for (const [key, value] of [['paths.playbook', '.omni-loop/knowledge/playbook'], ['branches.terraform', 'docs/omni-terraform']]) {
      const s = io();
      expect(await main(['config', key], { cwd: root, ...s })).toBe(0);
      expect(s.out.join('')).toBe(`${value}\n`);
    }
  });

  it('exits 2 for a key the schema does not hold', async () => {
    const { root } = makeRepo({ git: true, files });
    expect(await main(['config', 'paths.playbooks'], { cwd: root, ...io() })).toBe(2);
  });
});

describe('loadConfig', () => {
  it('says the repository is not terraformed when the file is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    expect(() => loadConfig(root)).toThrow(/not terraformed.*\.omni-loop\/config\.yml/s);
  });

  it('reads the file under root', () => {
    const root = mkdtempSync(join(tmpdir(), 'cfg-'));
    mkdirSync(join(root, '.omni-loop'));
    writeFileSync(join(root, CONFIG_FILE), 'kit: 1\nrepo:\n  slug: acme/widgets\n');
    expect(loadConfig(root).repo.slug).toBe('acme/widgets');
  });
});
