import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { defaultPitchSettings, presetLook, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { sure } from '../arcade/test/sure';
import type { PitchedProduct, ProductRow } from './model';
import { PITCH_HINT, PitchSection, READ_ONLY } from './pitch-form';
import { initialPitchForm, pitchFormReducer, withFont, withMusicProvider, type PitchFormAction } from './pitch-form-model';
import { ProductPage } from './ProductPage';
import { DEMO_PRODUCTS, ProductScreen, ProductsScreen, type ProductScreenView, type ProductsScreenView } from './ProductsScreen';
import { NO_PRODUCTS, ProductsView } from './ProductsView';

// Settings › Products as the server renders it (PRD 859 s1, PRD 1108 s2): the list (each product a link
// to its own page, with its look), the empty list, a product's page with its Pitch section — Look,
// Voice, Intro / outro, Music and Length — as controls for whoever may edit the business and as text
// for anyone else, a refusal, and every situation under the Settings tabs with Products marked. Its
// Approvers list moved to the product home (PRD 1364 s11): the page links there.

const VERTUOZA: ProductRow = { id: 'p-1', name: 'Vertuoza', look: 'arcade' };
const OMNI: ProductRow = { id: 'p-2', name: 'Omni Loop', look: 'keynote' };
const PITCHED: PitchedProduct = { ...VERTUOZA, pitch: defaultPitchSettings('arcade') };
const COLOURS = ['Ink', 'Paper', 'Accent', 'Call to action'];

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: text(group(m, 2)) }));
const headings = (html: string, level: number) => [...html.matchAll(new RegExp(`<h${String(level)}[^>]*>([\\s\\S]*?)</h${String(level)}>`, 'g'))].map((m) => text(group(m, 1)));
/** Each labelled field: its label, and its control's markup. */
const fields = (html: string) => [...html.matchAll(/<label class="pitch-field"><span>([^<]*)<\/span>([\s\S]*?)<\/label>/g)].map((m) => ({ label: group(m, 1), control: group(m, 2) }));
const field = (html: string, label: string, nth = 0) => fields(html).filter((f) => f.label === label)[nth]?.control ?? '';
const options = (control: string) => [...control.matchAll(/<option ([^>]*)>([^<]*)<\/option>/g)].map((m) => ({ value: /value="([^"]*)"/.exec(group(m, 1))?.[1], selected: group(m, 1).includes('selected'), text: m[2] }));
const valueOf = (control: string) => /value="([^"]*)"/.exec(control)?.[1];
const selected = (control: string) => options(control).find((o) => o.selected)?.value;
const buttons = (html: string) => [...html.matchAll(/<button ([^>]*)>([^<]*)<\/button>/g)].map((m) => ({ text: m[2], disabled: group(m, 1).includes('disabled') }));

const section = (pitch: PitchSettings, { editable = true, actions = [] as PitchFormAction[] } = {}) =>
  renderToStaticMarkup(createElement(PitchSection, { state: actions.reduce(pitchFormReducer, initialPitchForm(pitch)), editable }));

describe('the products list', () => {
  it('is headed Products and lists each product with its look, linking to its own page', () => {
    const html = renderToStaticMarkup(createElement(ProductsView, { products: [VERTUOZA, OMNI] }));
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Products');
    expect(links(html)).toEqual([
      { href: '/app/settings/products/p-1', text: 'Vertuoza Arcade poster' },
      { href: '/app/settings/products/p-2', text: 'Omni Loop Clean keynote' },
    ]);
  });

  it('says where products are named when there is none yet', () => {
    const html = renderToStaticMarkup(createElement(ProductsView, { products: [] }));
    expect(text(html)).toContain(NO_PRODUCTS);
    expect(links(html)).toEqual([{ href: '/app/settings/business', text: 'Open Business →' }]);
  });
});

describe('a product\'s page, for whoever may edit the business', () => {
  it('is headed by the product, links back to the list, and has a Pitch section in five parts', () => {
    const html = renderToStaticMarkup(createElement(ProductPage, { source: { kind: 'demo' }, editable: true, product: PITCHED }));
    expect(headings(html, 1)).toEqual(['Vertuoza']);
    expect(links(html)[0]).toEqual({ href: '/app/settings/products', text: '← Products' });
    expect(headings(html, 2)).toEqual(['Pitch', 'Approvers']);
    expect(headings(html, 3)).toEqual(['Look', 'Voice', 'Intro / outro', 'Music', 'Length']);
    expect(text(html)).toContain(PITCH_HINT);
    expect(text(html)).not.toContain(READ_ONLY);
  });

  it('shows the Look: a preset, four colours, the Heading and Text fonts, a logo and a theme', () => {
    const html = section(defaultPitchSettings('arcade'));
    expect(options(field(html, 'Preset'))).toEqual([
      { value: 'arcade', selected: true, text: 'Arcade poster' },
      { value: 'keynote', selected: false, text: 'Clean keynote' },
    ]);
    expect(COLOURS.map((label) => valueOf(field(html, label)))).toEqual(['#e7e7ff', '#07071a', '#4ee1ff', '#ffd23f']);
    expect(text(html)).toContain('Heading font');
    expect(text(html)).toContain('Text font');
    expect(valueOf(field(html, 'Family', 0))).toBe('Anton');
    expect(valueOf(field(html, 'Family', 1))).toBe('Inter');
    expect(selected(field(html, 'Weight', 1))).toBe('500');
    expect(field(html, 'Logo')).toContain('type="file"');
    expect(field(html, 'Logo')).toContain('accept=".svg,.png,.jpg,.jpeg,.webp"');
    expect(selected(field(html, 'Theme'))).toBe('dark');
  });

  it('fills the whole Look when Keynote is chosen, keeping the product\'s logo', () => {
    const withLogo = { ...defaultPitchSettings('arcade'), look: { ...presetLook('arcade'), logo: 'asset:logo.svg' } };
    const html = section(withLogo, { actions: [{ type: 'preset', preset: 'keynote' }] });
    expect(selected(field(html, 'Preset'))).toBe('keynote');
    expect(COLOURS.map((label) => valueOf(field(html, label)))).toEqual(['#0b0b12', '#fbfbfd', '#6d28d9', '#db2777']);
    expect(valueOf(field(html, 'Family', 0))).toBe('Inter');
    expect(selected(field(html, 'Weight', 0))).toBe('900');
    expect(selected(field(html, 'Theme'))).toBe('light');
    expect(text(field(html, 'Logo'))).toContain('logo.svg');
  });

  it('shows the Voice, the Intro / outro and the Length', () => {
    const pitch: PitchSettings = { ...defaultPitchSettings('arcade'), voice: { preset: 'formal', instructions: 'Say worksite.' } };
    const html = section(pitch);
    expect(options(field(html, 'Preset', 1)).map((o) => o.text)).toEqual(['Confident &amp; warm', 'Playful', 'Formal', 'Hype (inside only)']);
    expect(selected(field(html, 'Preset', 1))).toBe('formal');
    expect(field(html, 'Instructions')).toContain('maxLength="600"');
    expect(field(html, 'Instructions')).toContain('Say worksite.');
    expect(valueOf(field(html, 'Intro eyebrow'))).toBe('New');
    expect(valueOf(field(html, 'Outro call to action'))).toBe('Available now');
    expect(html).toMatch(/<input type="checkbox" checked=""\/><span>Show credits<\/span>/);
    expect([valueOf(field(html, 'Shortest')), valueOf(field(html, 'Longest'))]).toEqual(['20', '40']);
  });

  it('offers no music, FreePD\'s five moods, or the product\'s own track', () => {
    const none = section(defaultPitchSettings('arcade'));
    expect(options(field(none, 'Source', 2)).map((o) => o.value)).toEqual(['none', 'freepd', 'file']);
    expect(field(none, 'Mood')).toBe('');
    const freepd = section(withMusicProvider(defaultPitchSettings('arcade'), 'freepd'));
    expect(options(field(freepd, 'Mood')).map((o) => o.value)).toEqual(['upbeat', 'calm', 'epic', 'playful', 'electronic']);
    const file = section({ ...defaultPitchSettings('arcade'), music: { provider: 'file', file: 'asset:theme.mp3' } });
    expect(field(file, 'Track')).toContain('accept=".mp3,.wav,.ogg"');
    expect(text(field(file, 'Track'))).toContain('theme.mp3');
  });

  it('takes a font file in place of a family when the font is an uploaded file', () => {
    const html = section(withFont(defaultPitchSettings('arcade'), 'heading', { provider: 'file' }));
    expect(field(html, 'Heading font file')).toContain('accept=".woff2,.woff,.ttf,.otf"');
    expect(fields(html).filter((f) => f.label === 'Family')).toHaveLength(1);
  });

  it('saves only a change, and waits while it is on its way', () => {
    const pitch = defaultPitchSettings('arcade');
    expect(buttons(section(pitch))).toEqual([{ text: 'Save', disabled: true }, { text: 'Discard changes', disabled: true }]);
    const changed: PitchFormAction = { type: 'preset', preset: 'keynote' };
    expect(buttons(section(pitch, { actions: [changed] }))).toEqual([{ text: 'Save', disabled: false }, { text: 'Discard changes', disabled: false }]);
    const busy = section(pitch, { actions: [changed, { type: 'busy' }] });
    expect(buttons(busy)).toEqual([{ text: 'Saving…', disabled: true }, { text: 'Discard changes', disabled: true }]);
    expect(field(busy, 'Preset')).toContain('disabled');
  });

  it('says why a save was refused, keeping the draft, and says when it was saved', () => {
    const message = 'Check the Pitch settings: length.min: the length is 15 to 60 seconds';
    const refused = section(defaultPitchSettings('arcade'), { actions: [{ type: 'preset', preset: 'keynote' }, { type: 'busy' }, { type: 'refused', message }] });
    expect(refused).toMatch(/role="alert">Check the Pitch settings: length\.min/);
    expect(selected(field(refused, 'Preset'))).toBe('keynote');
    const saved = section(defaultPitchSettings('arcade'), { actions: [{ type: 'busy' }, { type: 'saved', pitch: defaultPitchSettings('keynote') }] });
    expect(saved).toMatch(/role="status">Saved\.</);
    expect(selected(field(saved, 'Preset'))).toBe('keynote');
  });
});

describe('a product\'s Approvers, moved to its home (PRD 1364 s11)', () => {
  it('says the list moved, and links to the product home\'s Repositories & approvers tab, for everyone', () => {
    for (const editable of [true, false]) {
      const html = renderToStaticMarkup(createElement(ProductPage, { source: { kind: 'demo' }, editable, product: PITCHED }));
      const section = /<section[^>]*aria-labelledby="approvers-title"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? '';
      expect(text(section)).toContain('Who approves this product’s PRDs is set on its home, under Repositories & approvers.');
      expect(links(section)).toEqual([{ href: `/app/products/${PITCHED.id}/repositories`, text: 'Open Repositories & approvers →' }]);
      expect(section).not.toMatch(/<(select|button)\b/);
    }
  });
});

describe('a product\'s page, for someone who may not edit the business', () => {
  it('shows every value as text, with no control', () => {
    const pitch: PitchSettings = { ...defaultPitchSettings('keynote'), music: { provider: 'freepd', mood: 'calm' }, voice: { preset: 'playful', instructions: '' } };
    const html = renderToStaticMarkup(createElement(ProductPage, { source: { kind: 'demo' }, editable: false, product: { ...OMNI, pitch } }));
    expect(html).not.toMatch(/<(select|input|textarea|button|form)\b/);
    expect(headings(html, 3)).toEqual([]);
    const shown = text(html);
    const lines = [
      'Preset Clean keynote', 'Ink #0B0B12', 'Heading font Inter, 900 (Google Fonts)', 'Logo None', 'Theme Light', 'Voice Playful',
      'Instructions None', 'Intro eyebrow New', 'Outro call to action Available now', 'Credits Shown',
      'Music Free music (FreePD, public domain): Calm', 'Length 20 to 40 seconds',
    ];
    for (const line of lines) expect(shown).toContain(line);
    expect(shown).toContain(READ_ONLY);
  });
});

describe('the screens', () => {
  const tabsOf = (html: string) => [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
  const MARKED = [['Fleets', false], ['Repositories', false], ['Business', false], ['Products', true], ['Jev', false]];

  it('start with the Settings tabs in every situation, Products marked', () => {
    const lists: ProductsScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'products', products: DEMO_PRODUCTS },
    ];
    const pages: ProductScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'not-found' },
      { kind: 'product', source: { kind: 'demo' }, editable: true, product: { ...sure(DEMO_PRODUCTS[0], 'the first demo product'), pitch: defaultPitchSettings('arcade') } },
    ];
    const htmls: [string, string][] = [
      ...lists.map((view): [string, string] => [view.kind, renderToStaticMarkup(createElement(ProductsScreen, { view }))]),
      ...pages.map((view): [string, string] => [view.kind, renderToStaticMarkup(createElement(ProductScreen, { view }))]),
    ];
    for (const [kind, html] of htmls) {
      expect(html.indexOf('class="section-tabs"'), kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), kind).toBeLessThan(html.indexOf('<h1'));
      expect(tabsOf(html), kind).toEqual(MARKED);
    }
  });

  it('say each situation in plain words', () => {
    const list = (view: ProductsScreenView) => text(renderToStaticMarkup(createElement(ProductsScreen, { view })));
    expect(list({ kind: 'closed' })).toContain('Products are not open here');
    expect(list({ kind: 'sign-in' })).toContain('Sign in to see your products');
    expect(list({ kind: 'no-workspace' })).toContain('Your account is not in a workspace');
    expect(list({ kind: 'unreadable' })).toContain('Couldn’t load your products');
    expect(text(renderToStaticMarkup(createElement(ProductScreen, { view: { kind: 'not-found' } })))).toContain('No such product');
  });

  it('draw the demo\'s two products, one in each look', () => {
    const html = renderToStaticMarkup(createElement(ProductsScreen, { view: { kind: 'products', products: DEMO_PRODUCTS } }));
    expect(text(html)).toContain('Widgets Arcade poster');
    expect(text(html)).toContain('Legacy Clean keynote');
  });
});
