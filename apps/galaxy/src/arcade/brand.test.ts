import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf } from '@omni/galaxy';
import { ArcadeApp } from './ArcadeApp';
import { closedAccount } from './account-closed';
import { demoAccount } from './account-demo';
import { brandWord, HOUSE_BRAND, type Brand } from './brand';
import { letterOf } from './mark';
import type { Account, FleetRow } from './types';

describe('the house brand', () => {
  it('is Vertuoza, with no colour of its own: today\'s arcade', () => {
    expect(HOUSE_BRAND).toEqual({ name: 'Vertuoza', theme: {} });
    expect(letterOf(HOUSE_BRAND.name)).toBe('V');
    expect(brandWord(HOUSE_BRAND)).toBe('VERTUOZA');
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
      expect(boot(props), what).toContain('VERTUOZA PRESENTS');
    }
  });

  it('is the workspace\'s when it is given one', () => {
    const words = boot({ view, account: signedOut, brand: { name: 'Acme', theme: {} } });
    expect(words).toContain('ACME PRESENTS');
    expect(words).not.toContain('VERTUOZA');
  });
});
