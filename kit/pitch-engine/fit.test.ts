// Where a media sits (PRD 1108 s4): the largest box of its proportions that fits its region with its
// device frame around it, and the second of its file a scene shows.
import { describe, expect, it } from 'vitest';
import { CHROME, fit, mediaSeconds } from './fit.ts';

const room = { width: 1000, height: 800 };
const wide = { width: 1600, height: 1000 };

describe('fit', () => {
  it('fills the width when the media is wider than the room', () => {
    expect(fit({ kind: 'screenshot', file: 'a.png' }, wide, room)).toEqual({ width: 1000, height: 625, outer: { width: 1000, height: 625 } });
  });

  it('fills the height when the media is taller than the room', () => {
    expect(fit({ kind: 'screenshot', file: 'a.png' }, { width: 500, height: 1000 }, room)).toEqual({ width: 400, height: 800, outer: { width: 400, height: 800 } });
  });

  it('leaves room for the device frame around the media', () => {
    const browser = fit({ kind: 'screenshot', file: 'a.png', device: 'browser' }, wide, { width: 1000, height: 600 });
    expect(browser.outer.height).toBe(600);
    expect(browser.height).toBe(600 - CHROME.browserBar);
    const phone = fit({ kind: 'screenshot', file: 'a.png', device: 'phone' }, { width: 400, height: 800 }, room);
    expect(phone.outer).toEqual({ width: phone.width + 2 * CHROME.phoneBezel, height: 800 });
    const laptop = fit({ kind: 'screenshot', file: 'a.png', device: 'laptop' }, wide, room);
    expect(laptop.outer.width).toBe(1000);
    expect(laptop.width).toBe(1000 - 2 * CHROME.laptopBezel);
  });

  it('keeps the proportions of the crop, not of the whole media', () => {
    // Half of a 1600×1000 screen is 800×1000: in a 1000×800 room, 640×800.
    expect(fit({ kind: 'screenshot', file: 'a.png', crop: { x: 0, y: 0, w: 0.5, h: 1 } }, wide, room)).toEqual({ width: 640, height: 800, outer: { width: 640, height: 800 } });
  });
});

describe('mediaSeconds', () => {
  it('starts at the media start, plays at its rate and holds its end', () => {
    const media = { kind: 'clip' as const, file: 'a.webm', start: 2, end: 5, rate: 2 };
    expect(mediaSeconds(media, 0)).toBe(2);
    expect(mediaSeconds(media, 1)).toBe(4);
    expect(mediaSeconds(media, 3)).toBe(5);
    expect(mediaSeconds({ kind: 'clip', file: 'a.webm' }, 1.5)).toBe(1.5);
  });
});
