// The walk-through's steps and its moments (PRD 1108 s7): the schema of walk.json, the boxes as 0..1 of the
// clip, the camera a moment suggests, and the guard that refuses a click that would change production.
import { describe, expect, it } from 'vitest';
import { boxOf, cameraOn, changingClick, parseMoments, parseWalk } from './moments.ts';

const WALK = {
  walk: 1,
  url: 'https://widgets.example/quotes',
  steps: [
    { do: 'hover', moment: 'quote-row', target: '#q1' },
    { do: 'wait', seconds: 1 },
    { do: 'click', moment: 'open-filter', target: 'button:has-text("Filter")', pause: 1.5 },
    { do: 'type', moment: 'search', target: 'input[name=q]', text: 'kitchen' },
    { do: 'scroll', moment: 'totals', target: '#totals' },
    { do: 'goto', url: 'https://widgets.example/invoices' },
  ],
};

const errorsOf = (value: unknown): string[] => parseWalk(value).errors ?? [];

describe('parseWalk', () => {
  it('reads a walk-through of every kind of step', () => {
    expect(parseWalk(WALK).walk?.steps.map((step) => step.do)).toEqual(['hover', 'wait', 'click', 'type', 'scroll', 'goto']);
  });

  it.each([
    ['a version other than 1', { ...WALK, walk: 2 }, 'walk'],
    ['an address that is not http', { ...WALK, url: 'file:///etc/passwd' }, 'url'],
    ['no steps', { ...WALK, steps: [] }, 'steps'],
    ['an unknown step', { ...WALK, steps: [{ do: 'submit', moment: 'x', target: 'form' }] }, 'steps.0.do'],
    ['a moment named with spaces', { ...WALK, steps: [{ do: 'hover', moment: 'Quote row', target: '#q1' }] }, 'steps.0.moment'],
    ['typed text with a line break', { ...WALK, steps: [{ do: 'type', moment: 'search', target: 'input', text: 'kitchen\n' }] }, 'steps.0.text'],
    ['a pause over 5 s', { ...WALK, steps: [{ do: 'hover', moment: 'a', target: '#a', pause: 6 }] }, 'steps.0.pause'],
    ['a field it does not know', { ...WALK, steps: [{ do: 'hover', moment: 'a', target: '#a', force: true }] }, 'steps.0'],
  ])('refuses %s, naming where', (_, value, path) => {
    expect(errorsOf(value).map((line) => line.slice(0, line.indexOf(':')))).toContain(path);
  });

  it('refuses two moments of the same name', () => {
    const twice = { ...WALK, steps: [{ do: 'hover', moment: 'a', target: '#a' }, { do: 'click', moment: 'a', target: '#a' }] };
    expect(errorsOf(twice)).toEqual(['walk.json: each moment is named once']);
  });
});

describe('boxOf', () => {
  it("is the element's box as 0..1 of the clip", () => {
    expect(boxOf({ x: 960, y: 270, width: 192, height: 108 }, { width: 1920, height: 1080 })).toEqual({ x: 0.5, y: 0.25, w: 0.1, h: 0.1 });
  });

  it('cuts a box that runs off the clip to the clip', () => {
    expect(boxOf({ x: -96, y: 1026, width: 192, height: 108 }, { width: 1920, height: 1080 })).toEqual({ x: 0, y: 0.95, w: 0.05, h: 0.05 });
  });
});

describe('cameraOn', () => {
  it("looks at the box's centre and zooms until it fills about half the frame", () => {
    expect(cameraOn({ x: 0.4, y: 0.2, w: 0.2, h: 0.1 })).toEqual({ focus: { x: 0.5, y: 0.25 }, zoom: 2.5 });
  });

  it('never zooms past 3 on a small element, nor below 1 on a large one', () => {
    expect(cameraOn({ x: 0.5, y: 0.5, w: 0.01, h: 0.01 }).zoom).toBe(3);
    expect(cameraOn({ x: 0, y: 0, w: 1, h: 1 }).zoom).toBe(1);
  });
});

describe('changingClick', () => {
  it.each(['Save', 'Send the quote', 'Delete', 'Supprimer le devis', 'Enregistrer', 'Créer une facture', 'Log out'])('refuses a click on "%s"', (words) => {
    expect(changingClick({ words, submits: false })).toMatch(/^its words say "/);
  });

  it('refuses a submit button whatever its words', () => {
    expect(changingClick({ words: 'Go', submits: true })).toBe('it submits a form');
  });

  it.each(['Filter', 'Open the quote', 'Saved views', 'Address book', 'Sendinblue', 'Next'])('lets a click on "%s" through', (words) => {
    expect(changingClick({ words, submits: false })).toBeNull();
  });
});

describe('parseMoments', () => {
  const moments = { moments: 1, clip: 'walk.mp4', width: 1920, height: 1080, seconds: 9.5, steps: [{ name: 'a', do: 'click', at: 2.1, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, focus: { x: 0.2, y: 0.15 }, zoom: 2.5 }] };

  it('reads what film writes, and refuses anything out of shape', () => {
    expect(parseMoments(moments)).toEqual(moments);
    expect(parseMoments({ ...moments, clip: 'walk.webm' })).toBeNull();
    expect(parseMoments({ ...moments, steps: [{ ...moments.steps[0], zoom: 5 }] })).toBeNull();
  });
});
