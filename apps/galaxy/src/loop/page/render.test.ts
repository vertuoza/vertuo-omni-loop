import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { present } from '../../ask/test/test-item';
import { DEMO_LOOP, demoLoopPage } from './demo';
import { LoopScreen } from './LoopScreen';
import type { LoopPageView } from './model';

// /app/loop as the server renders it (PRD 1139 s5), to static markup, on the demo's loops: the list
// with one loop in each state, one loop opened with its plan timeline, its versions, its ledger and its
// parked PRDs, the empty list, and every situation before the list.

const NOW = new Date('2026-10-07T14:25:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const render = (view: LoopPageView, supabase: { url: string; key: string } | null = null) =>
  renderToStaticMarkup(createElement(LoopScreen, { view, supabase, signinError: null }));
const list = () => present(demoLoopPage(NOW), 'the demo list');
const opened = (id = DEMO_LOOP) => present(demoLoopPage(NOW, id), 'the demo loop');

describe('the list of loops', () => {
  const html = render(list());
  const t = text(html);

  it('is headed by the workspace\'s name and says what a loop is', () => {
    expect(html).toContain('<h1 class="dash-name">Acme</h1>');
    expect(t).toContain('/loop /omni:drive');
  });

  it('shows one loop in each state: live, sleeping with its wake, parked, stopped and silent with how long', () => {
    for (const state of ['live', 'sleeping', 'parked', 'stopped', 'silent']) expect(html).toContain(`loop-state is-${state}`);
    expect(t).toContain('sleeping · wakes 14:32 UTC');
    expect(t).toContain('silent · no tick for 37 min');
  });

  it('names who runs each loop, its repository, its last tick and its PRDs, and links to its page', () => {
    expect(t).toContain('Ada');
    expect(t).toContain('acme/widgets');
    expect(t).toContain('last tick 14:21 UTC');
    expect(t).toContain('driving PRD 1030, PRD 1017, PRD 971');
    expect(html).toContain(`href="/app/loop/${DEMO_LOOP}"`);
  });

  it('tells a silent loop how to resume, and a parked one how many PRDs wait on a person', () => {
    expect(t).toContain('run /loop /omni:drive again to resume');
    expect(t).toContain('1 PRD waits on a person');
  });
});

describe('one loop opened', () => {
  const html = render(opened());
  const t = text(html);

  it('leads back to every loop, and names who runs it, where, and its state', () => {
    expect(html).toContain('href="/app/loop"');
    expect(t).toContain('Ada');
    expect(t).toContain('acme/widgets');
    expect(t).toContain('sleeping · wakes 14:32 UTC');
    expect(t).toContain('plan v2 · step 3/6');
  });

  it('draws the latest plan as one timeline row per PRD, each linking to its page, the collision marked with its reason', () => {
    const latest = html.slice(html.indexOf('data-version="2"'), html.indexOf('data-version="1"'));
    expect(latest.match(/class="loop-row"/g)).toHaveLength(3);
    for (const prd of [971, 1030, 1017]) expect(latest).toContain(`href="/prd/${prd}"`);
    expect(latest).toMatch(/class="loop-step is-collision"[^>]*title="1017 s2 after 1030 s3: both touch apps\/galaxy\/src\/nav\/"/);
    expect(text(latest)).toContain('Step 4: 1017 s2 after 1030 s3: both touch apps/galaxy/src/nav/');
    expect(latest).toContain('loop-step is-current');
    expect(latest.match(/is-done/g)).toHaveLength(2);
  });

  it('keeps every version, the latest open, each with its reason', () => {
    expect(html.indexOf('data-version="2"')).toBeLessThan(html.indexOf('data-version="1"'));
    expect(t).toContain('v2 s4 of PRD 1030 stuck → PRD 1017 moves up');
    expect(t).toContain('v1 first plan');
    expect(html).toMatch(/<details class="loop-version" data-version="2" open="">/);
    expect(html).toMatch(/<details class="loop-version" data-version="1">/);
  });

  it('lists its ledger, the newest first, each tick linking to its PRD\'s page, the replan between them', () => {
    const ledger = text(html.slice(html.indexOf('loop-ledger')));
    expect(ledger.indexOf('step 3/6 · wait')).toBeLessThan(ledger.indexOf('replanned v2'));
    expect(ledger.indexOf('replanned v2')).toBeLessThan(ledger.indexOf('step 2/6 · wave'));
    expect(ledger).toContain('step 2/6 · wave · PRD 1030 → 3 sub-PRs merged, 2 outbox items');
    expect(html).toMatch(/<li class="loop-line"><time>13:25 UTC<\/time> step 2\/6 · wave · <a href="\/prd\/1030">PRD 1030<\/a>/);
  });

  it('names the repositories a tick\'s step touched on its ledger line, in a plan repository (PRD 1162)', () => {
    const view = opened();
    if (view.kind !== 'loop') throw new Error('the demo loop');
    const ledger = view.loop.ledger.map((line) => (line.kind === 'tick' && line.step === 2 ? { ...line, repos: ['crew', 'ai-domain'] } : line));
    const shown = text(render({ ...view, loop: { ...view.loop, ledger } }));
    expect(shown).toContain('step 2/6 · wave · PRD 1030 · in crew, ai-domain → 3 sub-PRs merged');
    expect(shown).toContain('step 3/6 · wait · PRD 1030 → CI running');
  });

  it('says it has no parked PRD when none waits', () => {
    expect(t).toContain('No PRD waits on a person.');
  });
});

describe('a parked loop opened', () => {
  const html = render(opened('5d1e0c3a-7b2f-4e8a-b1c9-0a2b3c4d5e6f'));
  const t = text(html);

  it('lists each parked PRD with who it waits on, on what, and where to act', () => {
    expect(t).toContain('PRD 1101 waits on the PM for answers to 2 outbox questions');
    expect(html).toContain('href="/prd/1101"');
    expect(html).toContain('href="https://github.com/acme/mobile/pull/1102"');
  });

  it('says a loop with no plan has none yet, and a loop with no tick an empty ledger', () => {
    expect(t).toContain('No plan yet.');
    expect(t).toContain('No tick yet.');
  });
});

describe('a plan the page cannot read', () => {
  it('says so, and still shows the rest', () => {
    const loop = opened();
    if (loop.kind !== 'loop') throw new Error('the demo loop');
    const view: LoopPageView = { ...loop, loop: { ...loop.loop, versions: [{ version: 1, reason: 'first plan', at: '14:00 UTC', plan: { kind: 'unreadable' }, steps: 0, rows: [] }] } };
    const t = text(render(view));
    expect(t).toContain('This plan cannot be read here.');
    expect(t).toContain('step 3/6 · wait');
  });
});

describe('the empty list, and every situation before it', () => {
  it('names how to start a loop when the workspace has none', () => {
    const t = text(render({ kind: 'list', name: 'Acme', loops: [] }));
    expect(t).toContain('No loop has run in this workspace yet.');
    expect(t).toContain('Start one from a checkout with /loop /omni:drive');
  });

  it('signed out, shows the sign-in card; with no database, the page is closed', () => {
    const signin = render({ kind: 'sign-in' }, { url: 'https://x.supabase.co', key: 'k' });
    expect(signin).not.toContain('loop-list');
    expect(text(signin)).toMatch(/sign in/i);
    expect(text(render({ kind: 'sign-in' }))).toContain('The Loop page is not open here');
    expect(text(render({ kind: 'closed' }))).toContain('The Loop page is not open here');
  });

  it('in no workspace, the notice; a workspace it cannot read, a line saying so', () => {
    expect(text(render({ kind: 'no-workspace' }))).toContain('The Loop page is for the members of a workspace');
    expect(text(render({ kind: 'unreadable' }))).toContain('The loops could not be read. Try again in a moment.');
  });
});
