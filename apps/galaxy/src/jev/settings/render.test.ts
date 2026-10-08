import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { jevRecords, type JevRecords } from '../record/record';
import type { JevCallRow, JevDecisionSettings, JevKeyStatus } from '../store';
import { initialState, jevReducer, type JevAction } from './model';
import { JevScreen, NOT_AVAILABLE_TITLE, type JevScreenView } from './JevScreen';
import { ONLY_OWNER, SENDS, SWITCH_OFF, JevView } from './JevView';
import { sure } from '../../arcade/test/sure';

// Settings › Jev as the server renders it (PRD 812 s1): the owner's view with and without a key, the
// key field, a refused test call, a member's view (no key field, no last four), and each situation of
// the page, all under the Settings tabs with Jev marked.

const NONE: JevKeyStatus = { stored: false, lastFour: null, setAt: null };
const STORED: JevKeyStatus = { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' };
const MEMBER_STORED: JevKeyStatus = { stored: true, lastFour: null, setAt: null };

const state = (key: JevKeyStatus, ...actions: JevAction[]) => actions.reduce(jevReducer, initialState(key));
const page = (key: JevKeyStatus, { owner = true, actions = [] as JevAction[], decisions = [] as JevDecisionSettings[], records = undefined as JevRecords | null | undefined } = {}) =>
  renderToStaticMarkup(createElement(JevView, { state: actions.reduce(jevReducer, initialState(key, decisions)), owner, records }));
/** The head and the key card: the page before its decision rows (PRD 812 s2). */
const render = (key: JevKeyStatus, options: { owner?: boolean; actions?: JevAction[] } = {}) => {
  const html = page(key, options);
  return html.slice(0, html.indexOf('<section class="ask-card jev-decisions"'));
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(sure(m[2], 'm[2]')) }));
const theSwitch = (html: string) => buttons(html).find((b) => sure(b.attrs, 'b.attrs').includes('role="switch"'));
const inputs = (html: string) => [...html.matchAll(/<input\b([^>]*)\/?>/g)].map((m) => m[1]);

describe('the owner\'s view, with no key', () => {
  it('shows Jev off, and no key field until the switch is pressed', () => {
    const html = render(NONE);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Jev');
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(theSwitch(html)?.attrs).not.toContain('disabled');
    expect(text(html)).toContain('Off');
    expect(inputs(html)).toHaveLength(0);
    expect(text(html)).toContain('tested with one call, stored encrypted, and never shown again');
  });

  it('opens the key field, a password input, with what switching on sends, once the switch is pressed', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }] });
    const [input] = inputs(html);
    expect(input).toContain('type="password"');
    expect(input).toContain('name="key"');
    expect(input).toContain('autoComplete="off"');
    expect(text(html)).toContain(SENDS);
    expect(buttons(html).map((b) => b.text)).toEqual(['', 'Test and save', 'Cancel']);
  });

  it('keeps the field open and shows TypeSafe\'s reason when the test call is refused, and stores nothing', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }, { type: 'refused', message: 'TypeSafe refused this key: Invalid API key' }] });
    expect(/<p class="jev-refusal" role="alert">([^<]*)<\/p>/.exec(html)?.[1]).toBe('TypeSafe refused this key: Invalid API key');
    expect(inputs(html)).toHaveLength(1);
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(text(html)).not.toContain('••••');
  });

  it('waits while the test call is on its way', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }] });
    expect(buttons(html).find((b) => b.text === 'Testing…')?.attrs).toContain('disabled');
    expect(inputs(html)[0]).toContain('disabled');
  });
});

describe('the owner\'s view, with a key', () => {
  it('shows Jev on, the key\'s last four only, when it was saved, Replace key, and what switching off does', () => {
    const html = render(STORED);
    expect(theSwitch(html)?.attrs).toContain('aria-checked="true"');
    expect(text(html)).toContain('API key •••• 1a2b');
    expect(text(html)).toContain('saved 30 Sep 2026');
    expect(buttons(html).map((b) => b.text)).toContain('Replace key');
    expect(text(html)).toContain(SWITCH_OFF);
    expect(inputs(html)).toHaveLength(0);
  });

  it('shows the new last four once a key is saved', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }, { type: 'saved', key: { ...STORED, lastFour: '9z9z' } }] });
    expect(text(html)).toContain('•••• 9z9z');
    expect(inputs(html)).toHaveLength(0);
  });

  it('is off again once the key is removed', () => {
    const html = render(STORED, { actions: [{ type: 'busy' }, { type: 'saved', key: NONE }] });
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(text(html)).not.toContain('••••');
  });
});

describe('a member\'s view', () => {
  it('shows whether Jev is on, and no key field, no last four, no control', () => {
    for (const key of [MEMBER_STORED, NONE]) {
      const html = render(key, { owner: false });
      expect(inputs(html)).toHaveLength(0);
      expect(text(html)).not.toContain('••••');
      expect(text(html)).toContain(ONLY_OWNER);
      expect(buttons(html).filter((b) => !sure(b.attrs, 'b.attrs').includes('disabled'))).toEqual([]);
      expect(buttons(html).map((b) => b.text)).not.toContain('Replace key');
    }
    expect(text(render(MEMBER_STORED, { owner: false }))).toContain('Jev is on for this workspace.');
    expect(text(render(NONE, { owner: false }))).toContain('Jev is off for this workspace.');
  });

  it('never shows a last four even if one were handed to it', () => {
    expect(text(render(STORED, { owner: false }))).not.toContain('1a2b');
  });
});

describe('the decision rows (PRD 812 s2)', () => {
  const CATEGORY_ON: JevDecisionSettings = { decision: 'question-category', mode: 'on', threshold: 0.65, floor: 0.3 };
  const rows = (html: string) => [...html.matchAll(/<li class="jev-decision" data-decision="([^"]+)">([\s\S]*?)<\/li>/g)].map((m) => ({ name: m[1], html: m[2] }));
  const row = (html: string, name: string) => sure(rows(html).find((r) => r.name === name), 'rows(html).find((r) => r.name === name)').html;
  const valueOf = (html: string, name: string) => new RegExp(`name="${name}"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="${name}"`).exec(html)?.slice(1).find(Boolean);

  it('lists the six decisions, each with what it sends, Off at the defaults (PRD 855 s4 adds Unknown worth asking, PRD 871 s4 Constituent break, PRD 1217 s3 Human work kind)', () => {
    const html = page(STORED);
    expect(rows(html).map((r) => r.name)).toEqual(['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking', 'constituent-break', 'hitl-category']);
    expect(text(sure(row(html, 'hitl-category'), 'the value'))).toContain('Sends: The entry’s source, text, act and repository, and its PRD’s title.');
    expect(row(html, 'hitl-category')).toMatch(/<option value="off" selected="">Off<\/option>/);
    expect(text(sure(row(html, 'unknown-worth-asking'), 'the value'))).toContain('Sends: The agent’s question, its repository and file');
    expect(row(html, 'unknown-worth-asking')).toMatch(/<option value="off" selected="">Off<\/option>/);
    expect(text(sure(row(html, 'constituent-break'), 'the value'))).toContain('Sends: The spec, the product’s Statement and Never lines');
    expect(text(sure(row(html, 'question-category'), 'the value'))).toContain('Sends: The round’s questions, their options and descriptions (never a preview)');
    expect(text(sure(row(html, 'outbox-risk'), 'the value'))).toContain('Sends: The item’s decision text and options');
    expect(text(sure(row(html, 'bug-risk'), 'the value'))).toContain('Sends: The issue’s title and body');
    expect(row(html, 'question-category')).toMatch(/<option value="off" selected="">Off<\/option>/);
    expect(valueOf(sure(row(html, 'question-category'), 'the value'), 'threshold')).toBe('0.50');
    expect(valueOf(sure(row(html, 'question-category'), 'the value'), 'floor')).toBe('0.40');
  });

  it('gives the owner a form for each decision, none of them coming any more (s5 registers bug-risk)', () => {
    const html = page(STORED, { decisions: [CATEGORY_ON] });
    const category = row(html, 'question-category');
    expect(category).toMatch(/<option value="on" selected="">On<\/option>/);
    expect(valueOf(sure(category, 'category'), 'threshold')).toBe('0.65');
    expect(valueOf(sure(category, 'category'), 'floor')).toBe('0.30');
    expect(buttons(sure(category, 'category')).map((b) => b.text)).toEqual(['Save']);
    for (const name of ['outbox-risk', 'bug-risk', 'constituent-break']) {
      expect(buttons(sure(row(html, name), 'row(html, name)')).map((b) => b.text)).toEqual(['Save']);
      expect(text(sure(row(html, name), 'row(html, name)'))).not.toContain('Coming in this PRD');
    }
  });

  it('offers Shadow and On only once Jev is on', () => {
    const off = row(page(NONE), 'question-category');
    expect(off).toMatch(/<option value="shadow" disabled="">Shadow<\/option>/);
    expect(off).toMatch(/<option value="on" disabled="">On<\/option>/);
    expect(text(page(NONE))).toContain('Switch Jev on above to put a decision in Shadow or On.');
    const on = row(page(STORED), 'question-category');
    expect(on).toMatch(/<option value="shadow">Shadow<\/option>/);
  });

  it('shows a member every decision read-only: no form, no control', () => {
    const html = page(MEMBER_STORED, { owner: false, decisions: [CATEGORY_ON] });
    expect(html).not.toContain('<select');
    expect(inputs(html)).toHaveLength(0);
    expect(text(sure(row(html, 'question-category'), 'the value'))).toContain('Mode On Threshold 0.65 Confidence floor 0.30');
    expect(buttons(html).filter((b) => !sure(b.attrs, 'b.attrs').includes('disabled'))).toEqual([]);
  });

  it('moves only the saved decision, and says why a save was refused on its own row', () => {
    const other: JevDecisionSettings = { decision: 'outbox-risk', mode: 'off', threshold: 0.7, floor: 0.5 };
    const saved = state(STORED, { type: 'decision-saving', decision: 'question-category' }, { type: 'decision-saved', settings: CATEGORY_ON });
    expect(saved.savingDecision).toBeNull();
    const after = jevReducer(initialState(STORED, [other]), { type: 'decision-saved', settings: CATEGORY_ON });
    expect(after.decisions).toEqual(expect.arrayContaining([other, CATEGORY_ON]));
    expect(after.decisions).toHaveLength(2);
    const again = jevReducer(after, { type: 'decision-saved', settings: { ...CATEGORY_ON, mode: 'shadow' } });
    expect(again.decisions.find((d) => d.decision === 'outbox-risk')).toEqual(other);
    expect(again.decisions.filter((d) => d.decision === 'question-category')).toEqual([{ ...CATEGORY_ON, mode: 'shadow' }]);

    const html = page(STORED, { actions: [{ type: 'decision-saving', decision: 'question-category' }, { type: 'decision-refused', decision: 'question-category', message: 'Mode: switch Jev on with a key first.' }] });
    expect(/<p class="jev-refusal" role="alert">([^<]*)<\/p>/.exec(sure(row(html, 'question-category'), 'the value'))?.[1]).toBe('Mode: switch Jev on with a key first.');
    expect(row(html, 'outbox-risk')).not.toContain('jev-refusal');
  });

  it('waits on every row while one is saved', () => {
    const html = page(STORED, { actions: [{ type: 'decision-saving', decision: 'question-category' }] });
    const b = buttons(sure(row(html, 'question-category'), 'the value'))[0];
    expect(sure(b, 'b').text).toBe('Saving…');
    expect(sure(b, 'b').attrs).toContain('disabled');
  });

  it('sets every decision Off, tuning kept, once the key is removed', () => {
    const removed = state(STORED, { type: 'busy' }, { type: 'saved', key: NONE });
    expect(removed.decisions).toEqual([]);
    const after = ([{ type: 'busy' }, { type: 'saved', key: NONE }] as JevAction[]).reduce(jevReducer, initialState(STORED, [CATEGORY_ON]));
    expect(after.decisions).toEqual([{ ...CATEGORY_ON, mode: 'off' }]);
    expect(text(sure(row(page(NONE, { decisions: after.decisions }), 'question-category'), 'the value'))).not.toContain('Mode On');
  });
});

describe('each decision\'s record (PRD 812 s4)', () => {
  const NOW = new Date('2026-09-30T12:00:00Z');
  const rows = (html: string) => [...html.matchAll(/<li class="jev-decision" data-decision="([^"]+)">([\s\S]*?)<\/li>(?=<li class="jev-decision"|<\/ul><\/section>)/g)].map((m) => ({ name: m[1], html: m[2] }));
  const row = (html: string, name: string) => sure(rows(html).find((r) => r.name === name), 'rows(html).find((r) => r.name === name)').html;
  const record = (html: string) => /<div class="jev-record">([\s\S]*)<\/div>$/.exec(html)?.[1] ?? '';
  let id = 0;
  const call = (over: Partial<JevCallRow>): JevCallRow => ({
    id: ++id, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jevAnswer: 'product', confidence: 0.8,
    oldAnswer: 'product', counted: 'product', decidedBy: 'old', ref: null, reason: null, ms: 100, calledAt: '2026-09-29T10:00:00Z', ...over,
  });
  const CALLS = [
    call({}), call({}), call({ outcome: 'failed', jevAnswer: null, confidence: null }),
    call({ calledAt: '2026-09-28T09:00:00Z', jevAnswer: 'ux', oldAnswer: 'product', ref: 'round:r-1' }),
    call({ calledAt: '2026-09-29T09:00:00Z', mode: 'on', jevAnswer: 'business', oldAnswer: 'other', counted: 'business', decidedBy: 'jev', confidence: 0.91, ref: 'vertuoza/vertuo-omni-loop#812' }),
    call({ decision: 'outbox-risk', calledAt: '2026-09-27T09:00:00Z', jevAnswer: 'true', oldAnswer: 'false', ref: 's3-01-some-item' }),
  ];
  const RECORDS = jevRecords(CALLS, NOW);
  const SHADOW: JevDecisionSettings = { decision: 'question-category', mode: 'shadow', threshold: 0.5, floor: 0.4 };

  it('shows the calls, the agreement rate and the last disagreements, newest first, each with both answers and a link', () => {
    const html = record(sure(row(page(STORED, { decisions: [SHADOW], records: RECORDS }), 'question-category'), 'the value'));
    expect(text(html)).toContain('Last 30 days: 5 calls · Jev agreed with today’s path 2 times out of 4 (50%)');
    const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(items).toHaveLength(2);
    expect(text(sure(items[0], 'items[0]'))).toBe('29 Sep 2026 · Jev business (0.91) · today’s path other · Jev decided · vertuoza/vertuo-omni-loop#812');
    expect(items[0]).toContain('href="https://github.com/vertuoza/vertuo-omni-loop/issues/812"');
    expect(text(sure(items[1], 'items[1]'))).toBe('28 Sep 2026 · Jev ux (0.80) · today’s path product · the round');
    expect(items[1]).toContain('href="/ask/q/r-1"');
  });

  it('shows a ref it cannot link as text', () => {
    const html = record(sure(row(page(STORED, { records: RECORDS }), 'outbox-risk'), 'the value'));
    expect(text(html)).toContain('Jev true (0.80) · today’s path false · s3-01-some-item');
    expect(html).not.toContain('href=');
  });

  it('says an Off decision with no calls does not call Jev', () => {
    expect(text(record(sure(row(page(STORED, { records: RECORDS }), 'bug-risk'), 'the value')))).toBe('Off: Jev is not called');
    expect(text(record(sure(row(page(STORED), 'question-category'), 'the value')))).toBe('Off: Jev is not called');
  });

  it('shows the record of an Off decision that was called, and says so of a decision in Shadow or On with none', () => {
    expect(text(record(sure(row(page(STORED, { records: RECORDS }), 'question-category'), 'the value')))).toContain('Last 30 days: 5 calls');
    const idle = jevRecords([], NOW);
    expect(text(record(sure(row(page(STORED, { decisions: [SHADOW], records: idle }), 'question-category'), 'the value')))).toBe('No calls to Jev in the last 30 days.');
  });

  it('has no rate when nothing could be compared', () => {
    const records = jevRecords([call({ outcome: 'no-key', jevAnswer: null, confidence: null })], NOW);
    expect(text(record(sure(row(page(STORED, { decisions: [SHADOW], records }), 'question-category'), 'the value')))).toBe('Last 30 days: 1 call · no answer to compare yet');
  });

  it('says the record could not be read, and still shows the settings', () => {
    const html = row(page(STORED, { decisions: [SHADOW], records: null }), 'question-category');
    expect(text(record(sure(html, 'html')))).toBe('The record could not be read. Reload in a moment.');
    expect(html).toContain('<select');
  });

  it('is handed from the page\'s view down to each row', () => {
    const html = renderToStaticMarkup(createElement(JevScreen, { view: { kind: 'jev', source: { kind: 'demo' }, owner: true, keyStatus: STORED, decisions: [SHADOW], records: RECORDS } }));
    expect(text(record(sure(row(html, 'question-category'), 'the value')))).toContain('Last 30 days: 5 calls');
  });

  it('shows a member the same record', () => {
    const html = record(sure(row(page(MEMBER_STORED, { owner: false, decisions: [SHADOW], records: RECORDS }), 'question-category'), 'the value'));
    expect(text(html)).toContain('Jev agreed with today’s path 2 times out of 4 (50%)');
    expect(html).toContain('href="/ask/q/r-1"');
  });
});

describe('the page\'s situations', () => {
  const screen = (view: JevScreenView) => renderToStaticMarkup(createElement(JevScreen, { view }));
  const VIEWS: JevScreenView[] = [
    { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'unavailable' },
    { kind: 'jev', source: { kind: 'demo' }, owner: true, keyStatus: NONE, decisions: [] },
  ];

  it('says what is wrong when there are no settings to show', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('Jev is not open here');
    expect(text(screen({ kind: 'sign-in' }))).toContain('Sign in to see your Jev settings');
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
    expect(text(screen({ kind: 'unreadable' }))).toContain('Couldn’t load your Jev settings');
  });

  it('says Jev is not available on this deployment without SECRETS_MASTER_KEY, with no key field', () => {
    const html = screen({ kind: 'unavailable' });
    expect(NOT_AVAILABLE_TITLE).toBe('Jev is not available on this deployment');
    expect(text(html)).toContain('Jev is not available on this deployment');
    expect(inputs(html)).toHaveLength(0);
    expect(html).not.toContain('role="switch"');
  });

  it('starts with the Fleets · Repositories · Business · Products · Jev tabs in every situation, Jev marked', () => {
    for (const view of VIEWS) {
      const html = screen(view);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', false], ['Products', false], ['Jev', true]]);
    }
  });
});

describe('the page\'s look', () => {
  it('keeps the key field within the window at 393 px', () => {
    const css = readFileSync(fileURLToPath(new URL('./jev.css', import.meta.url)), 'utf8');
    const at = css.indexOf('.jev-key-input {');
    expect(css.slice(at, css.indexOf('}', at))).toContain('max-width: 100%');
  });

  it('is imported by the route', () => {
    const page = readFileSync(fileURLToPath(new URL('../../../app/app/settings/jev/page.tsx', import.meta.url)), 'utf8');
    expect(page).toContain('src/jev/settings/jev.css');
  });
});
