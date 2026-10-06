// A storyboard holding all six scene types, for the tests of the schema, the check and, later, the
// engine. Its media are `clips/walk.webm` and `shots/before.png` / `shots/after.png` of the run folder.
import type { Storyboard } from './storyboard.ts';

export const FIXTURE_MEDIA = Object.freeze(['clips/walk.webm', 'shots/before.png', 'shots/after.png']);

/** A fresh copy of the fixture storyboard, safe to change in a test. */
export function fixtureStoryboard(): Storyboard {
  return {
    storyboard: 1,
    meta: {
      fps: 30,
      width: 1920,
      height: 1080,
      transition: 0.5,
      music: { sync: { scene: 2, at: 1.5 } },
      sources: ['spec.md', 'release-note.md'],
    },
    scenes: [
      { type: 'intro', duration: 3, eyebrow: 'New in Widgets', title: 'Quotes that send themselves', tag: 'PRD 7' },
      { type: 'statement', duration: 4, text: 'A quote leaves the moment the last line is priced.' },
      {
        type: 'feature',
        duration: 6,
        title: 'Send from the quote',
        layout: 'left',
        bullets: ['One click to send', 'The customer signs online'],
        media: {
          kind: 'clip',
          file: 'clips/walk.webm',
          start: 1,
          end: 7,
          rate: 1,
          device: 'browser',
          camera: [{ at: 0, zoom: 1, focus: { x: 0.5, y: 0.5 } }, { at: 2, zoom: 2.2, focus: { x: 0.7, y: 0.3 } }],
          callouts: [{ at: 2.5, until: 5, kind: 'ring', box: { x: 0.6, y: 0.2, w: 0.2, h: 0.1 }, label: 'Send' }],
          cursor: [{ at: 1, x: 0.4, y: 0.5 }, { at: 2.4, x: 0.7, y: 0.25, click: true }],
        },
      },
      {
        type: 'steps',
        duration: 6,
        media: { kind: 'clip', file: 'clips/walk.webm', start: 7, end: 13 },
        steps: [{ label: 'Price the lines', at: 0 }, { label: 'Send the quote', at: 3 }],
      },
      {
        type: 'beforeAfter',
        duration: 4,
        before: { kind: 'screenshot', file: 'shots/before.png' },
        after: { kind: 'screenshot', file: 'shots/after.png', crop: { x: 0, y: 0, w: 1, h: 0.8 } },
        labels: { before: 'Before', after: 'Now' },
      },
      { type: 'outro', duration: 3, cta: 'Available now', closing: 'Every quote, on its way.', credits: true },
    ],
  };
}

/** Marks a field `changedStoryboard()` removes. */
export const REMOVED = Symbol('removed');

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Sets (or removes) the field at `key` of `parent`, an object or an array. */
function setField(parent: unknown, key: string, value: unknown): void {
  if (Array.isArray(parent)) {
    parent[Number(key)] = value;
    return;
  }
  if (!isObject(parent)) throw new Error(`no field ${key} to set`);
  if (value === REMOVED) Reflect.deleteProperty(parent, key);
  else parent[key] = value;
}

/** The fixture as plain data, with the field at the dotted `path` set to `value`, or removed. */
export function changedStoryboard(path: string, value: unknown): unknown {
  const root: unknown = JSON.parse(JSON.stringify(fixtureStoryboard()));
  const keys = path.split('.');
  const last = keys.pop() ?? '';
  const parent = keys.reduce<unknown>((node, key) => (isObject(node) ? node[key] : undefined), root);
  setField(parent, last, value);
  return root;
}
