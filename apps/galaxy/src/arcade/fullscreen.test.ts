import { describe, expect, it } from 'vitest';
import { ESC_AFTER_LEAVING_MS, fullscreenFor, type FullscreenPage, type FullscreenPress } from './fullscreen';
import type { Form } from './form';
import type { SceneName } from './scenes/common.ts';

const key = (k: string, scene: SceneName = 'menu', more: Partial<{ modified: boolean; repeat: boolean }> = {}): FullscreenPress =>
  ({ kind: 'key', key: k, scene, modified: false, repeat: false, ...more });
const tap: FullscreenPress = { kind: 'pointer' };
const toggle: FullscreenPress = { kind: 'toggle' };

/**
 * A page as a browser shows it: every request is recorded, a granted one enters or leaves at once,
 * and `refuse` makes it refuse the way a browser does (a rejected promise, or a throw).
 */
function fakePage({ enabled = true, refuse = null as null | 'reject' | 'throw', api = true, form = 'handheld' }: {
  enabled?: boolean; refuse?: null | 'reject' | 'throw'; api?: boolean; form?: Form;
} = {}) {
  const asked: string[] = [];
  let clock = 0;
  const page: FullscreenPage & { fullscreenElement: unknown } = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    documentElement: {},
    exitFullscreen() {
      asked.push('exit');
      page.fullscreenElement = null;
      fs.changed();
      return Promise.resolve();
    },
  };
  if (api) {
    page.documentElement.requestFullscreen = () => {
      asked.push('enter');
      if (refuse === 'throw') throw new TypeError('Failed to execute requestFullscreen');
      if (refuse === 'reject') return Promise.reject(new TypeError('Permissions check failed'));
      page.fullscreenElement = page.documentElement;
      fs.changed();
      return Promise.resolve();
    };
  }
  const fs = fullscreenFor(page, () => clock, () => form);
  return {
    fs, asked,
    /** Time passes. */
    wait(ms: number) { clock += ms; },
    /** The player leaves fullscreen the browser's way (its own Esc, or its button). */
    leave() { page.fullscreenElement = null; fs.changed(); },
  };
}

/** Lets a rejected promise surface: a refusal left unhandled would fail the run here. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('fullscreen, asked on the first press of each page load on a phone (handheld and advance)', () => {
  it('asks on the first key press, and the key still counts for the game', () => {
    const p = fakePage();
    expect(p.fs.press(key('Enter', 'boot'))).toBe(false);
    expect(p.asked).toEqual(['enter']);
  });

  it('asks on the first click or touch press', () => {
    const p = fakePage();
    p.fs.press(tap);
    expect(p.asked).toEqual(['enter']);
  });

  it('asks once: a press while fullscreen asks nothing', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.fs.press(key('ArrowDown'));
    p.fs.press(tap);
    expect(p.asked).toEqual(['enter']);
  });

  it('does not ask again on the next press after the player leaves', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.leave();
    p.wait(2000);
    expect(p.fs.press(key('ArrowDown'))).toBe(false);
    p.fs.press(tap);
    expect(p.asked).toEqual(['enter']);
  });

  it('asks again on F, and F leaves fullscreen too: F is fullscreen\'s alone', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.leave();
    expect(p.fs.press(key('f'))).toBe(true);
    expect(p.asked).toEqual(['enter', 'enter']);
    expect(p.fs.press(key('F'))).toBe(true);
    expect(p.asked).toEqual(['enter', 'enter', 'exit']);
  });

  it('counts F as the first press when it comes first', () => {
    const p = fakePage();
    expect(p.fs.press(key('f', 'title'))).toBe(true);
    p.leave();
    p.fs.press(key('Enter'));
    expect(p.asked).toEqual(['enter']);
  });

  it('lets F type an F on the name screen', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.leave();
    expect(p.fs.press(key('f', 'name'))).toBe(false);
    expect(p.fs.press(key('F', 'name'))).toBe(false);
    expect(p.asked).toEqual(['enter']);
  });

  it('does not toggle on a held F, nor on Ctrl+F or Cmd+F', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.leave();
    expect(p.fs.press(key('f', 'menu', { repeat: true }))).toBe(true);
    expect(p.fs.press(key('f', 'menu', { modified: true }))).toBe(false);
    expect(p.asked).toEqual(['enter']);
  });

  it('asks on the first press on advance too, and not again after the player leaves', () => {
    const p = fakePage({ form: 'advance' });
    p.fs.press(tap);
    p.leave();
    p.wait(2000);
    p.fs.press(tap);
    p.fs.press(key('Enter'));
    expect(p.asked).toEqual(['enter']);
  });

  it('asks again on a new page load', () => {
    const first = fakePage();
    first.fs.press(key('Enter', 'boot'));
    first.leave();
    const next = fakePage();
    next.fs.press(key('Enter', 'boot'));
    expect(next.asked).toEqual(['enter']);
  });

  it('never asks on a key with Ctrl, Cmd or Alt, and still asks on the next plain one', () => {
    const p = fakePage();
    expect(p.fs.press(key('r', 'boot', { modified: true }))).toBe(false);
    expect(p.asked).toEqual([]);
    p.fs.press(key('Enter', 'boot'));
    expect(p.asked).toEqual(['enter']);
  });
});

describe('the Esc that leaves fullscreen is never also B', () => {
  it('spends Esc while fullscreen, and leaves it', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    expect(p.fs.press(key('Escape', 'planet'))).toBe(true);
    expect(p.asked).toEqual(['enter', 'exit']);
  });

  it('spends it on the name screen too, where Esc goes back', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    expect(p.fs.press(key('Escape', 'name'))).toBe(true);
  });

  it('spends an Esc that arrives just after the browser left, and counts a later one as B', () => {
    const p = fakePage();
    p.fs.press(key('Enter', 'boot'));
    p.leave(); // the browser took the Esc, and tells the page afterwards
    p.wait(ESC_AFTER_LEAVING_MS - 1);
    expect(p.fs.press(key('Escape'))).toBe(true);
    p.wait(1);
    expect(p.fs.press(key('Escape'))).toBe(false);
    expect(p.asked).toEqual(['enter']);
  });

  it('keeps Esc as B outside fullscreen, and never asks on it', () => {
    const p = fakePage();
    expect(p.fs.press(key('Escape', 'coin'))).toBe(false);
    expect(p.asked).toEqual([]);
    p.fs.press(key('Enter', 'coin'));
    expect(p.asked).toEqual(['enter']);
  });
});

describe('a refused request is ignored silently', () => {
  it('leaves no error when the browser rejects it, and does not ask again on the next press', async () => {
    const p = fakePage({ refuse: 'reject' });
    expect(() => p.fs.press(key('Enter', 'boot'))).not.toThrow();
    await settle();
    p.fs.press(key('ArrowDown'));
    expect(p.asked).toEqual(['enter']);
    expect(p.fs.press(key('Escape'))).toBe(false); // never fullscreen: Esc is B
  });

  it('leaves no error when the browser throws', async () => {
    const p = fakePage({ refuse: 'throw' });
    expect(() => p.fs.press(tap)).not.toThrow();
    expect(() => p.fs.press(key('f'))).not.toThrow();
    await settle();
    expect(p.asked).toEqual(['enter', 'enter']);
  });

  it('asks nothing where fullscreen is not allowed (an iframe without the permission)', () => {
    const p = fakePage({ enabled: false });
    expect(p.fs.press(key('Enter', 'boot'))).toBe(false);
    expect(p.fs.press(key('f'))).toBe(false);
    expect(p.fs.press(key('Escape'))).toBe(false);
    expect(p.asked).toEqual([]);
  });

  it('asks nothing where there is no Fullscreen API (iPhone Safari)', () => {
    const p = fakePage({ api: false });
    expect(() => p.fs.press(tap)).not.toThrow();
    expect(p.fs.press(key('f'))).toBe(false);
    expect(p.asked).toEqual([]);
  });
});

describe('on desktop (full), no press asks for fullscreen on its own', () => {
  it('asks nothing on the first key press, click or touch press, nor on any later one', () => {
    const p = fakePage({ form: 'full' });
    expect(p.fs.press(key('Enter', 'boot'))).toBe(false);
    expect(p.fs.press(tap)).toBe(false);
    p.fs.press(key('ArrowDown'));
    p.wait(2000);
    p.fs.press(tap);
    expect(p.fs.press(key('Escape'))).toBe(false); // never fullscreen: Esc is B
    expect(p.asked).toEqual([]);
  });

  it('still toggles on F, and the Esc that leaves is never also B', () => {
    const p = fakePage({ form: 'full' });
    expect(p.fs.press(key('f'))).toBe(true);
    expect(p.asked).toEqual(['enter']);
    expect(p.fs.press(key('Escape'))).toBe(true);
    expect(p.asked).toEqual(['enter', 'exit']);
    p.fs.press(tap);
    expect(p.asked).toEqual(['enter', 'exit']);
  });

  it('lets F type an F on the name screen', () => {
    const p = fakePage({ form: 'full' });
    expect(p.fs.press(key('f', 'name'))).toBe(false);
    expect(p.asked).toEqual([]);
  });

  it('reads the form at each press: a desktop press asks nothing, the next press as a phone asks', () => {
    let form: Form = 'full';
    const asked: string[] = [];
    const page: FullscreenPage = {
      fullscreenEnabled: true,
      fullscreenElement: null,
      documentElement: { requestFullscreen: () => { asked.push('enter'); } },
    };
    const fs = fullscreenFor(page, () => 0, () => form);
    fs.press(tap);
    expect(asked).toEqual([]);
    form = 'handheld';
    fs.press(tap);
    expect(asked).toEqual(['enter']);
  });
});

describe('the toggle press (the full-screen button)', () => {
  it('enters when off and leaves when on, and is spent', () => {
    const p = fakePage({ form: 'full' });
    expect(p.fs.press(toggle)).toBe(true);
    expect(p.asked).toEqual(['enter']);
    expect(p.fs.press(toggle)).toBe(true);
    expect(p.asked).toEqual(['enter', 'exit']);
  });

  it('works on a phone too, and counts as the first press there', () => {
    const p = fakePage();
    p.fs.press(toggle);
    p.leave();
    p.wait(2000);
    p.fs.press(tap);
    expect(p.asked).toEqual(['enter']);
  });

  it('asks nothing where fullscreen is not allowed', () => {
    const p = fakePage({ form: 'full', enabled: false });
    expect(p.fs.press(toggle)).toBe(false);
    const q = fakePage({ form: 'full', api: false });
    expect(q.fs.press(toggle)).toBe(false);
    expect([...p.asked, ...q.asked]).toEqual([]);
  });
});
