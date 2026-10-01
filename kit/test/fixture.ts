// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { ConfigSchema } from '../lib/config.ts';
import { createContext } from '../lib/context.ts';

export function deepMerge(base, over) {
  if (Array.isArray(over) || over === null || typeof over !== 'object') return over;
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = base && typeof base[key] === 'object' && base[key] !== null && !Array.isArray(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return out;
}

export function testContext(root, overrides = {}) {
  const config = ConfigSchema.parse(deepMerge({ kit: 1, repo: { slug: 'acme/widgets' } }, overrides));
  return createContext(root, config);
}

export function makeRepo({ files = {}, config = {}, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'omni-'));
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const [path, text] of Object.entries(files)) write(path, text);
  if (git) {
    const run = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    run('init', '-q', '-b', 'main');
    run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
    if (Object.keys(files).length) {
      run('add', '-A');
      run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture');
    }
  }
  return { root, ctx: testContext(root, config), write, read: (path) => readFileSync(join(root, path), 'utf8') };
}

/** One slot's `<!-- slot: … -->` marker, fields in the order the parser reads them. */
export function slotMarker({ id, required = false, by = null, verified = null }) {
  const fields = [`slot: ${id}`, required ? 'required' : 'optional'];
  if (by) fields.push(`by: ${by}`);
  if (verified) fields.push(`verified: ${verified}`);
  return `<!-- ${fields.join(' · ')} -->`;
}

/**
 * A form file's text, shaped as `kit/lib/playbook/forms.ts` reads it: front matter, the title, the
 * opener, then per slot its `## <heading>`, its marker and its body. A front-matter key set to
 * `undefined` is left out; a slot's `marker` replaces its marker line (`null` drops it).
 */
export function formText({ frontMatter = {}, title = 'Testing', opener = 'Use this page when adding, changing, or choosing tests.', slots = [] } = {}) {
  const fm = { form: 'testing', 'form-version': 1, state: 'blank', 'points-to': null, evidence: [], invaded: null, ...frontMatter };
  const lines = ['---', stringify(fm).trimEnd(), '---', '', `# ${title}`, ''];
  if (opener !== null) lines.push(opener, '');
  for (const slot of slots) {
    const heading = slot.heading ?? slot.id[0].toUpperCase() + slot.id.slice(1);
    lines.push(`## ${heading}`);
    const marker = slot.marker === undefined ? slotMarker(slot) : slot.marker;
    if (marker !== null) lines.push(marker);
    if (slot.body) lines.push(slot.body);
    lines.push('');
  }
  return lines.join('\n');
}
