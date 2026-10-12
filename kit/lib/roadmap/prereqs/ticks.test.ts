// PRD 1218, slice s2: a person row's tick, written as a marked comment and read back from the issue.
import { describe, expect, it } from 'vitest';
import { parseCommentId } from '../../ids.ts';
import { readTicks, tickComment, tickMarker, tickOf } from './ticks.ts';

const comment = (id: number, body: string | null) => ({ id: parseCommentId(id), body });

describe('a tick comment', () => {
  it('opens with the marker and names the row', () => {
    expect(tickMarker('p3')).toBe('<!-- omni-roadmap-tick: p3 -->');
    expect(tickComment('p3')).toBe('<!-- omni-roadmap-tick: p3 -->\nPrerequisite **p3** is done.\n');
  });

  it('is read back as the row it ticks', () => {
    expect(tickOf(tickComment('p3'))).toBe('p3');
    expect(tickOf('<!-- omni-roadmap-tick: p12 -->')).toBe('p12');
  });

  it('ticks nothing without the marker on the first line, or with an id that is none', () => {
    expect(tickOf('done')).toBeNull();
    expect(tickOf('see below\n<!-- omni-roadmap-tick: p3 -->')).toBeNull();
    expect(tickOf('<!-- omni-roadmap-tick: not an id! -->')).toBeNull();
    expect(tickOf('<!-- omni-roadmap-answer: p3 -->\nyes')).toBeNull();
  });
});

describe('readTicks', () => {
  it('collects every ticked row and ignores the other comments', () => {
    const ticks = readTicks([
      comment(1, tickComment('p3')),
      comment(2, 'I did p4 too'),
      comment(3, null),
      comment(4, tickComment('p5')),
      comment(5, tickComment('p3')),
    ]);
    expect([...ticks].sort()).toEqual(['p3', 'p5']);
  });

  it('reads none from no comments', () => {
    expect(readTicks([]).size).toBe(0);
  });
});
