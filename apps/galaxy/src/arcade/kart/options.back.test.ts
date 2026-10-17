// Bug 2149: a race holds the browser's Back and Forward keys. ⌘ (macOS) and ALT (Windows, Linux) sit beside SPACE, the
// race's HOP: a thumb that slides onto one while the player steers made ⌘← or ALT+←, and the browser went Back, out of the
// arcade, to the page before it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { browserBack } from './options';

const press = (key: string, mods: { meta?: boolean; alt?: boolean; ctrl?: boolean; shift?: boolean } = {}) =>
  ({ key, metaKey: mods.meta ?? false, altKey: mods.alt ?? false, ctrlKey: mods.ctrl ?? false, shiftKey: mods.shift ?? false });

describe('bug 2149: the keys the browser reads as Back or Forward', () => {
  it('are ⌘← ⌘→ ⌘[ ⌘] and ALT+← ALT+→', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', '[', ']']) expect(browserBack(press(key, { meta: true })), `⌘${key}`).toBe(true);
    for (const key of ['ArrowLeft', 'ArrowRight']) expect(browserBack(press(key, { alt: true })), `ALT+${key}`).toBe(true);
  });

  it('are none of the race\'s own keys, nor the browser\'s other shortcuts', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift', '[', ']']) expect(browserBack(press(key)), key).toBe(false);
    expect(browserBack(press('ArrowUp', { meta: true }))).toBe(false); // the top of the page
    expect(browserBack(press('r', { meta: true }))).toBe(false); // reload
    expect(browserBack(press('ArrowLeft', { meta: true, alt: true }))).toBe(false); // the tab before
    expect(browserBack(press('[', { meta: true, shift: true }))).toBe(false); // the tab before
    expect(browserBack(press('ArrowLeft', { ctrl: true }))).toBe(false); // the desktop before (macOS), the word before
    expect(browserBack(press('ArrowLeft', { alt: true, shift: true }))).toBe(false);
  });
});

// The guard: the arcade's keydown handler asks `browserBack` during a race's countdown and race, before it hands a key
// pressed with ⌘, CTRL or ALT to the browser, and keeps the browser from acting on it.
describe('the arcade\'s keyboard holds them during a race (bug 2149)', () => {
  const app = readFileSync(new URL('../ArcadeApp.tsx', import.meta.url), 'utf8');
  const handler = sure(/\n {4}const onKey = \(e: KeyboardEvent\) => \{\n([\s\S]*?)\n {4}\};\n/.exec(app)?.[1], 'the keydown handler in ArcadeApp.tsx');

  it('asks before any modified key goes to the browser, and prevents what it holds', () => {
    const asked = handler.indexOf('browserBack(e)'), handed = handler.indexOf('if (modified) return;');
    expect(asked, 'browserBack(e) in the keydown handler').toBeGreaterThan(-1);
    expect(handed).toBeGreaterThan(asked);
    expect(sure(handler.split('\n').find((line) => line.includes('browserBack(e)')), 'the line that asks')).toMatch(/racing && api\?\.browserBack\(e\)\) \{ e\.preventDefault\(\); return; \}/);
  });

  it('holds them in the countdown and the race only', () => {
    expect(handler).toContain("const racing = waiting?.hud?.phase === 'countdown' || waiting?.hud?.phase === 'race';");
  });
});
