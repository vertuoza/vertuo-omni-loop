// PRD omni-loop-13, slice s5: this repository's design form names its design system in one line,
// `See: packages/design/design-system.json`, the file `design.manifest` names, and `omni kb show
// design` prints the components index there, never the raw JSON. Read from this checkout; no
// network, no model.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { loadConfig } from '../config.ts';
import { formatComponents, parseManifest } from '../design/manifest.ts';
import { parseForm } from './forms.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MANIFEST = 'packages/design/design-system.json';
const FORM = '.omni-loop/knowledge/playbook/design.md';

async function kbShowDesign() {
  const out: string[] = [];
  const err: string[] = [];
  const io = { cwd: ROOT, env: {}, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
  const code = await main(['kb', 'show', 'design'], io);
  return { code, out: out.join(''), err: err.join('') };
}

/** The components index, as `omni design components` prints it from the committed manifest. */
function componentsIndex(): string {
  const read = parseManifest(JSON.parse(readFileSync(join(ROOT, MANIFEST), 'utf8')) as unknown);
  if (read.kind !== 'ok') throw new Error(`the committed manifest is refused: ${read.kind === 'refused' ? read.refusals.join('; ') : 'none'}`);
  return formatComponents(read.manifest).join('\n');
}

describe("this repository's design form (PRD omni-loop-13)", () => {
  it('AC-5: omni kb show design prints the System section as a See: line naming the manifest, showing the components index', async () => {
    const { code, out } = await kbShowDesign();
    expect(code).toBe(0);
    expect(out).toContain(`## System  [→ ${MANIFEST}]\n${componentsIndex()}\n\n## Deliberate`);
    expect(out).not.toContain('"omni-design"');
  });

  it('holds the System section as the one line See: <manifest>, and leaves every other section as text', () => {
    const { form } = parseForm(readFileSync(join(ROOT, FORM), 'utf8'), { file: FORM });
    if (!form) throw new Error(`${FORM} does not parse`);
    const system = form.slots.find((slot) => slot.id === 'system');
    expect(system?.body).toMatchObject({ kind: 'pointer', text: `See: ${MANIFEST}`, see: { path: MANIFEST, anchor: null } });
    expect(form.slots.filter((slot) => slot.id !== 'system' && slot.body.kind === 'pointer')).toEqual([]);
  });

  it('names the file the config names as design.manifest', () => {
    expect(loadConfig(ROOT).design.manifest).toBe(MANIFEST);
  });
});
