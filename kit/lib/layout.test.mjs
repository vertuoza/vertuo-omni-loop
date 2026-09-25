import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { foldersLayout, padPrd, parseFolderName } from './layout.mjs';

const PATHS = { delivery: '.omni-loop/delivery', knowledge: '.omni-loop/knowledge', adr: 'docs-adr', glossary: null, context: [] };

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'layout-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('padPrd / parseFolderName', () => {
  it('pads to at least four digits and never truncates', () => {
    expect(padPrd(42)).toBe('0042');
    expect(padPrd('985')).toBe('0985');
    expect(padPrd(12345)).toBe('12345');
  });
  it('parses a PRD folder name and refuses anything else', () => {
    expect(parseFolderName('0042-delivery-folder')).toEqual({ prd: 42, topic: 'delivery-folder' });
    expect(parseFolderName('12345-x')).toEqual({ prd: 12345, topic: 'x' });
    expect(parseFolderName('42-short')).toBeNull();
    expect(parseFolderName('README.md')).toBeNull();
    expect(parseFolderName('0042-Bad_Topic')).toBeNull();
  });
});

describe('foldersLayout', () => {
  it('finds a PRD in the inbox whatever width it is asked with', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0042-topic/spec.md': 'x' });
    const layout = foldersLayout(root, PATHS);
    expect(layout.whereIs(42)).toEqual({ name: '0042-topic', state: 'inbox', dir: '.omni-loop/delivery/inbox/0042-topic' });
    expect(layout.whereIs('0042')?.name).toBe('0042-topic');
    expect(layout.specPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/spec.md');
    expect(layout.planPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/plan.md');
    expect(layout.beforeAfterPath(42)).toBe('.omni-loop/delivery/inbox/0042-topic/before-after.html');
  });

  it('puts an in-flight outbox beside the inbox folder, named the same, even before it exists', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0042-topic/spec.md': 'x' });
    expect(foldersLayout(root, PATHS).outboxDir(42)).toBe('.omni-loop/delivery/outbox/0042-topic');
  });

  it('puts a shipped outbox inside the shipped folder', () => {
    const root = tree({ '.omni-loop/delivery/shipped/0042-topic/outbox/settled.md': 'x' });
    const layout = foldersLayout(root, PATHS);
    expect(layout.whereIs(42).state).toBe('shipped');
    expect(layout.outboxDir(42)).toBe('.omni-loop/delivery/shipped/0042-topic/outbox');
  });

  it('returns null for a PRD it cannot find anywhere', () => {
    expect(foldersLayout(tree({}), PATHS).whereIs(7)).toBeNull();
    expect(foldersLayout(tree({}), PATHS).outboxDir(7)).toBeNull();
  });

  it('lists every outbox, in flight and shipped, and ignores READMEs', () => {
    const root = tree({
      '.omni-loop/delivery/outbox/README.md': 'x',
      '.omni-loop/delivery/outbox/0042-a/s1-01-x.md': 'x',
      '.omni-loop/delivery/shipped/0007-b/outbox/settled.md': 'x',
      '.omni-loop/delivery/shipped/0008-c/spec.md': 'x',
    });
    expect(foldersLayout(root, PATHS).outboxDirs()).toEqual([
      { prd: 42, dir: '.omni-loop/delivery/outbox/0042-a', shipped: false },
      { prd: 7, dir: '.omni-loop/delivery/shipped/0007-b/outbox', shipped: true },
    ]);
  });

  it('lists the spec path of every inbox folder, present or not', () => {
    const root = tree({ '.omni-loop/delivery/inbox/0001-a/spec.md': 'x', '.omni-loop/delivery/inbox/0002-b/plan.md': 'x' });
    expect(foldersLayout(root, PATHS).specFiles()).toEqual([
      '.omni-loop/delivery/inbox/0001-a/spec.md',
      '.omni-loop/delivery/inbox/0002-b/spec.md',
    ]);
  });
});
