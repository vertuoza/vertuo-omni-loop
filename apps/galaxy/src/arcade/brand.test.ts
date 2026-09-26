import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { ArcadeApp } from './ArcadeApp';
import { closedAccount } from './account-closed';
import { demoAccount } from './account-demo';
import { logoSvg, OMNI_LOOP } from '@omni/design';
import { brandLook, brandWord, HOUSE_BRAND, type Brand } from './brand';
import { letterOf, markFor } from './mark';
import { DEFAULT_THEME } from './theme';
import Icon, { contentType, size } from '../../app/icon';
import type { Account, FleetRow } from './types';

describe('the house brand', () => {
  it('is Omni Loop, drawn with its crest and no colour of its own', () => {
    expect(HOUSE_BRAND).toEqual({ name: OMNI_LOOP.name, theme: {}, logo: OMNI_LOOP.logo });
    expect(brandWord(HOUSE_BRAND)).toBe('OMNI LOOP');
    expect(brandLook(HOUSE_BRAND).logo).toBe('full');
  });

  it('gives the page its favicon: the crest\'s own 16×16 drawing, as a crisp SVG', async () => {
    expect(size).toEqual({ width: 16, height: 16 });
    expect(contentType).toBe('image/svg+xml');
    const res = Icon();
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(await res.text()).toBe(logoSvg(OMNI_LOOP.icon));
  });
});

describe('a workspace\'s brand', () => {
  it('draws Vertuoza\'s V, pixel for pixel, and no crest', () => {
    const vertuoza: Brand = { name: 'Vertuoza', theme: {} };
    const look = brandLook(vertuoza);
    expect(letterOf(vertuoza.name)).toBe('V');
    expect(look.mark).toEqual(markFor('Vertuoza', DEFAULT_THEME));
    expect(look.logo).toBeNull();
  });
});

describe('the brand\'s word', () => {
  it('is its name upper-cased, as the arcade writes every word', () => {
    expect(brandWord({ name: 'Acme', theme: {} })).toBe('ACME');
    expect(brandWord({ name: 'Élan', theme: {} })).toBe('ÉLAN');
    expect(brandWord({ name: '42 Labs', theme: {} })).toBe('42 LABS');
  });
});

describe('the arcade\'s brand', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
  const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams)
    .map(([name, t]) => ({ name, ...lookOf(name, t) }))
    .sort((a, b) => a.sort - b.sort);
  const signedOut: Account = { ...closedAccount(), kind: 'supabase' };
  /** The words of the arcade's first screen, the boot, as the server renders it. */
  const boot = (props: { view: typeof view | null; account: Account; brand?: Brand }) =>
    renderToStaticMarkup(createElement(ArcadeApp, { fleets, ...props }))
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('is the house brand when it is given none: in demo mode (the artifact\'s too), signed out, and closed', () => {
    for (const [what, props] of [
      ['demo', { view, account: demoAccount() }],
      ['signed out', { view: null, account: signedOut }],
      ['closed', { view: null, account: closedAccount() }],
    ] as const) {
      expect(boot(props), what).toContain('OMNI LOOP PRESENTS');
      expect(boot(props), what).not.toContain('VERTUOZA');
    }
  });

  it('is the workspace\'s when it is given one', () => {
    const words = boot({ view, account: signedOut, brand: { name: 'Acme', theme: {} } });
    expect(words).toContain('ACME PRESENTS');
    expect(words).not.toContain('OMNI LOOP PRESENTS');
  });
});
