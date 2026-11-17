import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { GithubSummary } from '../github/summary';
import type { DossierRow } from '../store';
import { SendToTerminalScope, SendToTerminalView } from '../../runners/send/SendToTerminal';
import type { SendSetup } from '../../runners/send/targets';
import { readyView, type ReadyRow } from './ready';
import { ReadyPanel } from './ReadyPanel';
import { PitchAction, PitchPanel } from './PitchAction';
import { StageAction } from './StageHeader';
import { StageHeaderCopy } from './StageHeaderCopy';
import { stageView } from './stage';
import { dossierView, readPick } from './view';

vi.mock('server-only', () => ({}));

// next/link as an anchor marked `data-next-link`, so a render shows which links navigate in the app.
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: (given: Record<string, unknown>) => {
      const props: Record<string, unknown> = { ...given, 'data-next-link': '' };
      delete props.prefetch;
      return h('a', props);
    },
  };
});

const { DossierPage } = await import('./DossierPage');

// Bug #3011: the PRD page rebuilt in omni-loop-10 (#2987) lost what the page did before it. Its tabs
// switch in the app (PRD 2401, next/link), its facts strip shows its first labels whole, its stage
// link opens GitHub in a new window, its chips keep their hover titles, and every button of its head
// and panels is @omni/ui's Button.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@example.com', name: 'Pierre' };
const dossier: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'acme/widgets', prd: parsePrd(216), title: 'PRD dossiers',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const FEATURE = { number: parsePr(221), url: 'https://github.com/acme/widgets/pull/221', state: 'open' as const, draft: false };
const CARE = { ci: 'green' as const, failedUrl: null, conflict: false, base: 'main', threads: [], watchingSince: null, lastRound: null };
const github: GithubSummary = {
  repo: 'acme/widgets', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
  phase0: null, feature: FEATURE, mergedSlices: 1, outbox: null, outboxComment: null, care: CARE,
};
const page = () => {
  const view = dossierView({ dossier, versions: [], members: [PIERRE], rounds: [], github }, PIERRE.user_id, readPick({}), Date.parse('2026-09-30T12:00:00Z'));
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: null }));
};
const SETUP: SendSetup = { repo: 'acme/widgets', options: [{ key: 'any', group: 'any', label: 'Any runner', state: null, target: { kind: 'any' } }] };

describe('the PRD page after its rebuild on @omni/ui (bug #3011)', () => {
  it('switches tabs in the app: every tab is a next/link (PRD 2401)', () => {
    const nav = /<nav[^>]*aria-label="Artifacts"[^>]*>([\s\S]*?)<\/nav>/.exec(page())?.[1] ?? '';
    const tabs = [...nav.matchAll(/<a [^>]*>/g)].map(([tag]) => tag);
    expect(tabs.length).toBeGreaterThan(3);
    for (const tab of tabs) expect(tab).toContain('data-next-link');
  });

  it('declares every custom property its stylesheet reads, so the facts strip is pulled as far as it is clipped', () => {
    const css = readFileSync(new URL('./dossier.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const read = new Set([...css.matchAll(/var\((--dossier-[a-z-]+)\)/g)].map((m) => m[1]));
    const declared = new Set([...css.matchAll(/(--dossier-[a-z-]+)\s*:/g)].map((m) => m[1]));
    expect([...read].filter((name) => !declared.has(name))).toEqual([]);
  });

  it('opens the stage\'s GitHub link in a new window', () => {
    const stage = stageView({ prd: parsePrd(216), rows: [{ stage: 'outbox', reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }], github });
    expect(stage.action).toMatchObject({ kind: 'link', href: 'https://github.com/acme/widgets/pull/221' });
    const html = renderToStaticMarkup(createElement(StageAction, { stage }));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('keeps the hover titles: PR care on the health chip, the command on Build it', () => {
    expect(page()).toMatch(/<span class="omni-badge[^"]*" title="PR care">CI ✓/);
    expect(renderToStaticMarkup(createElement(StageHeaderCopy, { label: 'Build it', command: '/omni:yolo 216' })))
      .toMatch(/<button [^>]*title="\/omni:yolo 216"[^>]*>Build it<\/button>/);
  });

  it('draws Pitch, its Copy, Send to terminal, Send and the Ready panel\'s action as @omni/ui Buttons', () => {
    const noop = () => {};
    const pitch = renderToStaticMarkup(createElement(PitchAction, { prd: parsePrd(216), disabled: false }));
    const panel = renderToStaticMarkup(createElement(SendToTerminalScope, {
      setup: SETUP, children: createElement(PitchPanel, { prd: parsePrd(216), audience: 'customers', disabled: false, copied: 'idle', onChoose: noop, onCopy: noop }),
    }));
    const send = renderToStaticMarkup(createElement(SendToTerminalView, {
      line: '/omni:yolo 216', setup: SETUP, state: { kind: 'open', choice: 'any', sending: false }, name: 'n', onToggle: noop, onChoose: noop, onSend: noop,
    }));
    const row: ReadyRow = {
      repo: 'acme/widgets', prd: parsePrd(2803), pr_number: 2817, head_sha: 'a41f9c2'.padEnd(40, '0'), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
      checks: [], criteria: [], decided_at: '2026-11-15T07:00:00Z',
    };
    const ready = renderToStaticMarkup(createElement(ReadyPanel, { ready: readyView(row) }));
    for (const html of [pitch, panel, send, ready]) {
      expect(html).not.toContain('ask-button');
      expect(html).toContain('omni-button');
    }
    expect(ready).toMatch(/<a class="omni-button omni-button--primary[^"]*" href="https:\/\/github.com\/acme\/widgets\/pull\/2817"/);
  });
});
