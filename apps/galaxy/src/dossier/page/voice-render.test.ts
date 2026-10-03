import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import type { DossierRow, DossierVersionRow } from '../store';
import { DEMO_VIEWER, demoContent, demoDossier } from './demo';
import { DossierPage } from './DossierPage';
import { readVoice, voiceView, VOICE_EMPTY, type VoiceCast } from './voice';
import { REWORK_LABEL } from './VoicePane';
import { dossierView, type DossierRead } from './view';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The User voice tab as the server renders it (PRD 822, s3): its place beside Spec, Plan and
// Before/after, the empty line, one round, three rounds with ▲ ▼ =, the outlined objection with how it
// was settled, the Rework button's command, a layout that holds at 393 px, and demo mode.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const dossier: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(822), title: 'The customer voice',
  opened_by: PIERRE.user_id, created_at: '2026-09-30T09:00:00Z', numbered_at: '2026-09-30T10:00:00Z',
};
const version = (id: string, kind: DossierVersionRow['kind']): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: '2026-09-30T11:00:00Z',
});
const read = (versions: DossierVersionRow[], more: Partial<DossierRow> = {}): DossierRead =>
  ({ dossier: { ...dossier, ...more }, versions, members: [PIERRE], rounds: [] });

const AVATAR = { v: 1 as const, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const CAST: VoiceCast[] = [{ name: 'Marc', trade: 'plumber', avatar: AVATAR }];
const EXAMPLE = readFileSync(fileURLToPath(new URL('../../../../../kit/lib/voice/example.json', import.meta.url)), 'utf8');

const persona = (name: string, score: number) => ({ name, stance: 'skeptical', score, reaction: `${name} gives ${score}.`, citations: [`persona:${name}`] });
const round = (stage: string, personas: unknown[]) => ({ stage, date: '2026-09-30', personas, objection: null, fit: null });

/** A voice.json version the test expects to read. */
function voiceOf(text: string) {
  const voice = readVoice(text);
  assertDefined(voice, 'the voice file, read');
  return voice;
}

function html(voiceText: string | null, versions = [version('v1', 'voice')], more: Partial<DossierRow> = {}) {
  const view = dossierView(read(versions, more), PIERRE.user_id, { tab: 'voice', version: null });
  const voice = voiceText === null ? null : voiceView(voiceOf(voiceText), CAST);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, voice, supabase: null }));
}

describe('the User voice tab', () => {
  it('sits beside Spec, Plan and Before/after on a PRD, and on no fix', () => {
    const tabs = dossierView(read([]), PIERRE.user_id, { tab: null, version: null }).tabs.map((t) => t.label);
    expect(tabs.slice(0, 5)).toEqual(['Questions', 'Before/after', 'Spec', 'Plan', 'User voice']);
    const bug = dossierView(read([], { kind: 'bug' }), PIERRE.user_id, { tab: null, version: null });
    expect(bug.tabs.map((t) => t.kind)).not.toContain('voice');
  });

  it('without a voice artifact says so, the tab dimmed', () => {
    const view = dossierView(read([]), PIERRE.user_id, { tab: 'voice', version: null });
    expect(view.tabs.find((t) => t.kind === 'voice')).toMatchObject({ empty: true, badge: null });
    const page = renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, voice: null, supabase: null }));
    expect(page).toContain(VOICE_EMPTY);
    expect(page).not.toContain(REWORK_LABEL);
  });

  it('shows one round: a row per persona with its portrait, name, stance chip and latest reaction', () => {
    const page = html(JSON.stringify({ rounds: [round('design', [persona('Marc', 3), persona('Sofia', 4)])] }));
    expect(page).toContain('<svg');
    expect(page).toContain('aria-label="Sofia">S</span>');
    expect(page).toContain('data-stance="skeptical">Skeptical</span>');
    expect(page).toContain('Marc gives 3.');
    expect(page).toContain('<th scope="col">Design<small>30 Sep</small></th>');
    expect(page).toContain('<strong>3/5</strong>');
    expect(page).not.toContain('voice-move');
  });

  it('shows three rounds with each score\'s move ▲ ▼ =, the reaction behind a tap', () => {
    const page = html(JSON.stringify({ rounds: [
      round('design', [persona('Marc', 3), persona('Sofia', 4)]),
      round('spec', [persona('Marc', 5), persona('Sofia', 3)]),
      round('rework-1', [persona('Marc', 5), persona('Sofia', 3)]),
    ] }));
    expect(page).toContain('data-move="up">▲</span>');
    expect(page).toContain('data-move="down">▼</span>');
    expect(page).toContain('data-move="the same">=</span>');
    expect(page).toContain('aria-label="Marc, Spec: 3/5 → 5/5, up. Show the reaction"');
    expect(page).toMatch(/<details class="voice-score"><summary[^>]*><strong>5\/5<\/strong>.*?<\/summary><p class="voice-reaction">.*?Marc gives 5\.<\/p><\/details>/);
    expect(page).toContain('Rework 1');
  });

  it('outlines each round\'s objection with how it was settled', () => {
    const page = html(EXAMPLE);
    expect(page).toContain('<blockquote class="voice-objection" data-settled="Accepted: the PRD changed">');
    expect(page).toContain('<strong>Marc objects:</strong> I would never set up six entities.');
    expect(page).toContain('persona:Marc · size#2');
    expect(page).toContain('Saved as a claim');
    expect(page).toContain('Overruled for this run');
    expect(page).toContain('fits persona:Marc ✓ · persona:Sofia ✓ · beats rival#20 ✓');
    expect(page).toContain('voice-cell voice-objected');
  });

  it('says so when nobody objected in a round', () => {
    expect(html(JSON.stringify({ rounds: [round('design', [persona('Marc', 5)])] }))).toContain('Nobody objected.');
  });

  it('copies the rework of the PRD\'s number with Rework with this feedback', () => {
    const page = html(EXAMPLE);
    expect(page).toContain(`>${REWORK_LABEL}</button>`);
    expect(page).toContain('<code class="stage-command">/omni:brainstorm --rework 822</code>');
  });

  it('says a version that could not be read, keeping its picker', () => {
    const page = html(null);
    expect(page).toContain('This version could not be read.');
    expect(page).toContain('v1');
  });
});

describe('the layout at 393 px', () => {
  const css = readFileSync(fileURLToPath(new URL('./dossier.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (selector: string) => {
    const at = css.lastIndexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(at, css.indexOf('}', at));
  };

  it('scrolls the grid inside its own box, never the page', () => {
    expect(rule('.voice-scroll')).toContain('overflow-x: auto');
    expect(rule('.voice-scroll')).toContain('max-width: 100%');
    expect(rule('.voice')).toContain('min-width: 0');
  });

  it('keeps a persona\'s column narrow enough for a phone, the reactions wrapping', () => {
    expect(rule('.voice-who')).toContain('min-width: 0');
    expect(rule('.voice-latest')).toContain('overflow-wrap: anywhere');
    expect(rule('.voice-grid th[scope=\'row\']')).toMatch(/max-width: min\(\d+px, \d+vw\)/);
  });
});

describe('demo mode', () => {
  it('has a User voice version on its PRD, read like a real one, with no database', () => {
    const demo = demoDossier(Date.parse('2026-09-30T10:00:00Z'));
    const view = dossierView(demo, DEMO_VIEWER, { tab: 'voice', version: null });
    expect(view.tabs.find((t) => t.kind === 'voice')).toMatchObject({ empty: false, badge: 'v1' });
    assertDefined(view.shown, 'the shown version');
    const text = demoContent(view.shown.id);
    const voice = readVoice(text ?? '');
    expect(voice?.rounds.length).toBeGreaterThanOrEqual(2);
    expect(view.rework).toBe('/omni:brainstorm --rework 71');
  });
});
