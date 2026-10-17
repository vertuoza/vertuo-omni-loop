import { describe, expect, it } from 'vitest';
import { ASK_MARKER, RECORD_MARKER, readAsk, readRecord, renderAsk, renderRecord } from './comments.ts';
import type { Decision } from './escalation.ts';

const held: Decision[] = [
  {
    thing: 'N-PRODUCT-4',
    kind: 'law',
    firstHeld: '2026-10-09T15:00:00Z',
    step: 1,
    asked: ['jdoe'],
    newlyAsked: ['jdoe'],
    nextDue: '2026-10-15T15:00:00Z',
  },
  {
    thing: 's1-01-name-a-delegate',
    kind: 'item',
    firstHeld: '2026-10-14T08:12:30Z',
    step: 0,
    asked: [],
    newlyAsked: [],
    nextDue: '2026-10-16T08:12:30Z',
  },
  {
    thing: 's2-03-calendar',
    kind: 'item',
    firstHeld: '2026-10-01T08:00:00Z',
    step: 2,
    asked: ['pierrederval', 'jdoe', 'acme/platform', 'cto-login'],
    newlyAsked: ['cto-login'],
    nextDue: null,
  },
];

describe('the escalation record', () => {
  it('opens with its marker and holds one line per held thing', () => {
    const body = renderRecord(held);
    expect(body.startsWith(RECORD_MARKER)).toBe(true);
    expect(RECORD_MARKER).toBe('<!-- omni:escalation -->');
    expect(body.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(3);
    expect(body).toContain('held since 2026-10-09T15:00:00Z');
  });

  it('reads back what it rendered, unchanged', () => {
    const read = readRecord(renderRecord(held));
    expect(read).toEqual(
      held.map((one) => ({ thing: one.thing, kind: one.kind, firstHeld: one.firstHeld, step: one.step, asked: one.asked, nextDue: one.nextDue })),
    );
  });

  it('reads back an empty record as no held thing', () => {
    expect(readRecord(renderRecord([]))).toEqual([]);
  });

  it('mentions nobody, so editing it notifies nobody', () => {
    expect(renderRecord(held)).not.toMatch(/(^|\s)@[a-z]/i);
  });

  it('reads a comment without the marker as no record', () => {
    expect(readRecord('- law `N-PRODUCT-4` · held since 2026-10-09T15:00:00Z · step 1 · asked jdoe · next step due 2026-10-15T15:00:00Z')).toBeNull();
    expect(readRecord('')).toBeNull();
  });

  it('skips a line someone edited out of shape, and keeps the rest', () => {
    const body = renderRecord(held).replace('step 1 ·', 'step one ·');
    expect(readRecord(body)?.map((one) => one.thing)).toEqual(['s1-01-name-a-delegate', 's2-03-calendar']);
  });
});

describe('the ask comment', () => {
  const due = held.filter((one) => one.newlyAsked.length > 0);

  it('carries one marker per thing and step, and mentions each person newly asked once', () => {
    const body = renderAsk(due);
    expect(body).toContain(ASK_MARKER('N-PRODUCT-4', 1));
    expect(ASK_MARKER('N-PRODUCT-4', 1)).toBe('<!-- omni:escalation-ask N-PRODUCT-4 1 -->');
    expect(body).toContain(ASK_MARKER('s2-03-calendar', 2));
    expect(body.match(/@jdoe\b/g)).toHaveLength(1);
    expect(body.match(/@cto-login\b/g)).toHaveLength(1);
    expect(body).not.toMatch(/@pierrederval\b/);
  });

  it('says since when each thing has waited, and that being asked decides nothing', () => {
    const body = renderAsk(due);
    expect(body).toContain('2026-10-09T15:00:00Z');
    expect(body).toMatch(/CODEOWNERS/);
    expect(body).toMatch(/writer/);
  });

  it('reads back the things and steps it asks about', () => {
    expect(readAsk(renderAsk(due))).toEqual([
      { thing: 'N-PRODUCT-4', step: 1 },
      { thing: 's2-03-calendar', step: 2 },
    ]);
  });

  it('reads a comment without the marker as no ask', () => {
    expect(readAsk('@jdoe please look')).toEqual([]);
    expect(readAsk(renderRecord(held))).toEqual([]);
  });
});
