import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SETUP_ERRORS } from './installed';
import { readView, SignupScreen, type SignupView } from './SignupScreen';

const INSTALL = 'https://github.com/apps/omni-loop/installations/new';
const render = (view: SignupView, installUrl: string | null = INSTALL) => renderToStaticMarkup(createElement(SignupScreen, { view, installUrl }));

describe('/signup\'s screen, from its address', () => {
  it('is the install link by default', () => {
    expect(readView({})).toEqual({ kind: 'install' });
  });

  it('waits for the orgs named, GitHub logins only', () => {
    expect(readView({ waiting: 'acme,Globex' })).toEqual({ kind: 'waiting', orgs: ['acme', 'Globex'] });
    expect(readView({ waiting: '<script>,acme' })).toEqual({ kind: 'waiting', orgs: ['acme'] });
    expect(readView({ waiting: '<b>' })).toEqual({ kind: 'install' });
  });

  it('shows a known error only', () => {
    expect(readView({ error: 'not-yours' })).toEqual({ kind: 'error', reason: 'not-yours' });
    expect(readView({ error: 'Your account was hacked, call 555' })).toEqual({ kind: 'install' });
  });
});

describe('/signup\'s screens', () => {
  it('links to the App\'s install page on GitHub', () => {
    const html = render({ kind: 'install' });
    expect(html).toContain('Install Omni Loop on your org');
    expect(html).toContain(`href="${INSTALL}"`);
  });

  it('says sign-up is not open without the App set up', () => {
    const html = render({ kind: 'install' }, null);
    expect(html).not.toContain('github.com/apps');
    expect(html).toContain('sign-up is not open here');
  });

  it('waits for one org\'s owner', () => {
    const html = render({ kind: 'waiting', orgs: ['acme'] });
    expect(html).toContain('Waiting for acme&#x27;s owner');
    expect(html).toContain('href="/play"');
  });

  it('waits for the owner of several orgs', () => {
    expect(render({ kind: 'waiting', orgs: ['acme', 'globex', 'initech'] })).toContain('Waiting for the owner of acme, globex or initech');
  });

  it.each(SETUP_ERRORS)('shows the %s error as an alert, with the install link to start again', (reason) => {
    const html = render({ kind: 'error', reason });
    expect(html).toContain('role="alert"');
    expect(html).toContain(`href="${INSTALL}"`);
  });

  it('says nothing was created when the installation is not the visitor\'s', () => {
    expect(render({ kind: 'error', reason: 'not-yours' })).toContain('nothing was created');
  });
});

describe('the App\'s secrets stay on the server', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
  const sources = [...files(join(root, 'src')), ...files(join(root, 'app'))].map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  it('no client component reads them, or imports what does', () => {
    const client = sources.filter((s) => /^\s*['"]use client['"]/.test(s.text));
    expect(client.length).toBeGreaterThan(0);
    for (const { path, text } of client) {
      expect(text, path).not.toMatch(/GITHUB_APP_(ID|PRIVATE_KEY)|SUPABASE_SERVICE_ROLE_KEY|signup\/github-app|sign-in-live|signup\/store/);
    }
  });

  it('none is ever a public variable', () => {
    for (const { path, text } of sources) expect(text, path).not.toMatch(/NEXT_PUBLIC_GITHUB_APP/);
    expect(readFileSync(join(root, '.env.example'), 'utf8')).not.toMatch(/NEXT_PUBLIC_GITHUB_APP/);
  });

  it('.env.example lists them, server only', () => {
    const env = readFileSync(join(root, '.env.example'), 'utf8');
    for (const name of ['GITHUB_APP_ID', 'GITHUB_APP_SLUG', 'GITHUB_APP_PRIVATE_KEY']) expect(env).toMatch(new RegExp(`^${name}=`, 'm'));
    expect(env).toMatch(/server only/i);
  });
});
