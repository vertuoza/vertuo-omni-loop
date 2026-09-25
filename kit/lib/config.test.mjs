import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
    expect(config.ask).toEqual({ url: null });
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
