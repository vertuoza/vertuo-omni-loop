import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MENU_ATTR, MENU_COOKIE, menuCookie, menuScript, readMenu, setMenu } from './menu-rail';

// The menu's rail (PRD 733): the cookie that keeps it, and the script that draws it before the first
// paint, run in a bare browser-like global against readMenu().

describe('the menu cookie', () => {
  it('reads rail only when omni-menu=rail is one of the pairs', () => {
    expect(readMenu('omni-menu=rail')).toBe('rail');
    expect(readMenu('a=1; omni-menu=rail; b=2')).toBe('rail');
    for (const cookie of [null, undefined, '', 'omni-menu=', 'omni-menu=open', 'omni-menu=railway', 'x-omni-menu=rail', 'a=omni-menu=rail', 'omni-menu-x=rail']) {
      expect(readMenu(cookie), String(cookie)).toBe('open');
    }
  });

  it('keeps the rail for a year, on the whole site, sent only on the site\'s own navigations', () => {
    expect(menuCookie('rail')).toBe(`${MENU_COOKIE}=rail; Max-Age=31536000; Path=/; SameSite=Lax`);
  });

  it('deletes it to open the menu again', () => {
    expect(menuCookie('open')).toBe(`${MENU_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`);
  });

  it('collapsing marks the shell and writes the cookie; expanding unmarks it and deletes the cookie', () => {
    const attrs = new Map<string, string>();
    const shell = { setAttribute: (n: string, v: string) => void attrs.set(n, v), removeAttribute: (n: string) => void attrs.delete(n) };
    const doc = { cookie: '' };
    setMenu(shell, doc, 'rail');
    expect(attrs.get(MENU_ATTR)).toBe('rail');
    expect(doc.cookie).toBe(menuCookie('rail'));
    setMenu(shell, doc, 'open');
    expect(attrs.has(MENU_ATTR)).toBe(false);
    expect(doc.cookie).toBe(menuCookie('open'));
  });

  it('still folds when the cookie is refused, and does nothing without a shell', () => {
    const attrs = new Map<string, string>();
    const shell = { setAttribute: (n: string, v: string) => void attrs.set(n, v), removeAttribute: (n: string) => void attrs.delete(n) };
    const refused = { get cookie() { return ''; }, set cookie(_: string) { throw new Error('SecurityError'); } };
    expect(() => { setMenu(shell, refused, 'rail'); }).not.toThrow();
    expect(attrs.get(MENU_ATTR)).toBe('rail');
    expect(() => { setMenu(null, null, 'open'); }).not.toThrow();
  });
});

/** Runs the inline script the shell puts before the first paint; the attribute it set, if any. */
function boot(cookie: unknown) {
  const attrs = new Map<string, string>();
  const document: Record<string, unknown> = { currentScript: { parentElement: { setAttribute: (name: string, value: string) => attrs.set(name, value) } } };
  if (cookie !== undefined) document.cookie = cookie;
  runInNewContext(menuScript, { document });
  return attrs.get(MENU_ATTR) ?? null;
}

describe('the script applied before the first paint', () => {
  it('marks the shell rail exactly when readMenu says rail, for every cookie', () => {
    for (const cookie of ['omni-menu=rail', 'a=1; omni-menu=rail', 'omni-menu=rail; b=2', 'a=1;omni-menu=rail', '', 'omni-menu=', 'omni-menu=open', 'omni-menu=railway', 'x-omni-menu=rail', 'omni-menu-x=rail']) {
      expect(boot(cookie), cookie).toBe(readMenu(cookie) === 'rail' ? 'rail' : null);
    }
  });

  it('never throws: no document.cookie, a cookie that throws, no parent, no document', () => {
    expect(boot(undefined)).toBeNull();
    const throwing = { get cookie(): string { throw new Error('SecurityError'); }, currentScript: null };
    expect(() => { runInNewContext(menuScript, { document: throwing }); }).not.toThrow();
    expect(() => { runInNewContext(menuScript, { document: { cookie: 'omni-menu=rail', currentScript: null } }); }).not.toThrow();
    expect(() => { runInNewContext(menuScript, {}); }).not.toThrow();
  });

  it('is one small self-contained statement', () => {
    expect(menuScript.length).toBeLessThan(400);
    expect(menuScript).not.toMatch(/<\/script/i);
    expect(menuScript).not.toMatch(/\bimport\b|=>|\blet\b|\bconst\b/);
  });
});
