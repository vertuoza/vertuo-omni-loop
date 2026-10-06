// The media's camera, callouts and cursor (PRD 1108 s4): zooms interpolated in log space and clamped so
// no edge of the media shows, callouts that follow the camera, and a cursor that moves and clicks.
import { describe, expect, it } from 'vitest';
import { calloutPresence, cameraTransform, cursorAt, sampleCamera } from './camera.ts';

const keys = [
  { at: 0, zoom: 1, focus: { x: 0.5, y: 0.5 } },
  { at: 2, zoom: 4, focus: { x: 0.5, y: 0.5 } },
];

describe('sampleCamera', () => {
  it('rests at the whole media with no keys', () => {
    expect(sampleCamera(undefined, 3)).toEqual({ zoom: 1, x: 0.5, y: 0.5 });
    expect(sampleCamera([], 3)).toEqual({ zoom: 1, x: 0.5, y: 0.5 });
  });

  it('holds the first key before it and the last key after it', () => {
    expect(sampleCamera([{ at: 1, zoom: 2, focus: { x: 0.2, y: 0.3 } }], 0)).toEqual({ zoom: 2, x: 0.2, y: 0.3 });
    expect(sampleCamera(keys, 5)).toEqual({ zoom: 4, x: 0.5, y: 0.5 });
  });

  it('zooms in log space: halfway between 1 and 4 is 2, not 2.5', () => {
    expect(sampleCamera(keys, 1).zoom).toBeCloseTo(2, 6);
  });

  it('eases the focus between keys', () => {
    const moving = [
      { at: 0, zoom: 2, focus: { x: 0.2, y: 0.2 } },
      { at: 1, zoom: 2, focus: { x: 0.8, y: 0.6 } },
    ];
    expect(sampleCamera(moving, 0.5)).toEqual({ zoom: 2, x: expect.closeTo(0.5, 6), y: expect.closeTo(0.4, 6) });
    expect(sampleCamera(moving, 0.1).x).toBeLessThan(0.2 + 0.6 * 0.1);
  });
});

describe('cameraTransform', () => {
  it('centres the focus on the frame when it can', () => {
    const transform = cameraTransform({ zoom: 2, x: 0.5, y: 0.5 }, 1000, 500);
    expect(transform).toMatchObject({ zoom: 2, x: -500, y: -250 });
    expect(transform.map({ x: 0.5, y: 0.5 })).toEqual({ x: 500, y: 250 });
  });

  it('clamps the move so no edge of the media shows', () => {
    expect(cameraTransform({ zoom: 2, x: 0, y: 0 }, 1000, 500)).toMatchObject({ x: 0, y: 0 });
    expect(cameraTransform({ zoom: 2, x: 1, y: 1 }, 1000, 500)).toMatchObject({ x: -1000, y: -500 });
    expect(cameraTransform({ zoom: 1, x: 0.9, y: 0.1 }, 1000, 500)).toMatchObject({ x: 0, y: 0 });
  });

  it('clamps the zoom to 1..4', () => {
    expect(cameraTransform({ zoom: 0.5, x: 0.5, y: 0.5 }, 100, 100).zoom).toBe(1);
    expect(cameraTransform({ zoom: 9, x: 0.5, y: 0.5 }, 100, 100).zoom).toBe(4);
  });

  it('maps a point of the media to where the camera shows it', () => {
    const transform = cameraTransform({ zoom: 2, x: 0, y: 0 }, 1000, 500);
    expect(transform.map({ x: 0.25, y: 0.5 })).toEqual({ x: 500, y: 500 });
  });
});

describe('calloutPresence', () => {
  const callout = { at: 1, until: 3, kind: 'ring' as const, box: { x: 0, y: 0, w: 0.1, h: 0.1 } };

  it('is absent before its time, arrives, holds, then leaves after its end', () => {
    expect(calloutPresence(callout, 0.5, 30)).toBe(0);
    expect(calloutPresence(callout, 1.1, 30)).toBeGreaterThan(0);
    expect(calloutPresence(callout, 1.1, 30)).toBeLessThan(1);
    expect(calloutPresence(callout, 2.9, 30)).toBeCloseTo(1, 2);
    expect(calloutPresence(callout, 3.15, 30)).toBeLessThan(1);
    expect(calloutPresence(callout, 3.5, 30)).toBe(0);
  });

  it('stays to the end of the scene with no end', () => {
    expect(calloutPresence({ ...callout, until: undefined }, 30, 30)).toBeCloseTo(1, 3);
  });
});

describe('cursorAt', () => {
  const cursor = [
    { at: 1, x: 0.2, y: 0.2 },
    { at: 2, x: 0.6, y: 0.4, click: true },
  ];

  it('is hidden well before its first key and appears just before it', () => {
    expect(cursorAt(cursor, 0)).toBeUndefined();
    expect(cursorAt(undefined, 1)).toBeUndefined();
    expect(cursorAt(cursor, 0.8)?.opacity).toBeGreaterThan(0);
    expect(cursorAt(cursor, 1)).toMatchObject({ x: 0.2, y: 0.2, opacity: 1 });
  });

  it('moves between keys, eased, and rests on the last', () => {
    expect(cursorAt(cursor, 1.5)).toMatchObject({ x: expect.closeTo(0.4, 6), y: expect.closeTo(0.3, 6) });
    expect(cursorAt(cursor, 4)).toMatchObject({ x: 0.6, y: 0.4 });
  });

  it('presses and ripples on a click, then lets go', () => {
    expect(cursorAt(cursor, 1.9)).toMatchObject({ press: 1, ripple: 0 });
    const pressed = cursorAt(cursor, 2.15);
    expect(pressed?.press).toBeLessThan(1);
    expect(pressed?.ripple).toBeGreaterThan(0);
    expect(cursorAt(cursor, 3)).toMatchObject({ press: 1, ripple: 0 });
  });
});
