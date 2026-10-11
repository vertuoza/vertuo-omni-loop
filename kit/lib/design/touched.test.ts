// PRD 1369: whether a diff touches a screen, as `omni design touched` says it.
import { describe, expect, it } from 'vitest';
import { designTouched, formatScreensTouched, formatStaleMocks, formatTouched, screensRead, screensTouched, staleMocks, type MockedScreen, type ScreenRead, type ScreenTouch } from './touched.ts';

const CHANGED = ['src/ui/Button.tsx', 'src/api/route.ts', 'styles/global.css', 'README.md'];

describe('designTouched', () => {
  it('is off while design.enabled is false, whatever the paths and the diff', () => {
    expect(designTouched({ enabled: false, paths: ['src/ui/**'] }, CHANGED)).toEqual({ ui: 'off' });
    expect(designTouched({ enabled: false, paths: [] }, CHANGED)).toEqual({ ui: 'off' });
  });

  it('is unknown when design.paths is empty', () => {
    expect(designTouched({ enabled: true, paths: [] }, CHANGED)).toEqual({ ui: 'unknown' });
  });

  it('is yes with every changed path a glob matches, in the diff order, each once', () => {
    expect(designTouched({ enabled: true, paths: ['src/ui/**', '**/*.css', 'src/ui/'] }, CHANGED)).toEqual({
      ui: 'yes',
      paths: ['src/ui/Button.tsx', 'styles/global.css'],
    });
  });

  it('is no when no changed path matches, or nothing changed', () => {
    expect(designTouched({ enabled: true, paths: ['src/ui/**'] }, ['src/api/route.ts'])).toEqual({ ui: 'no' });
    expect(designTouched({ enabled: true, paths: ['src/ui/**'] }, [])).toEqual({ ui: 'no' });
  });
});

describe('formatTouched', () => {
  it('prints design: off, ui: no, ui: unknown with its reason, or ui: yes and each path', () => {
    expect(formatTouched({ ui: 'off' })).toEqual(['design: off']);
    expect(formatTouched({ ui: 'no' })).toEqual(['ui: no']);
    expect(formatTouched({ ui: 'unknown' })).toEqual(['ui: unknown', 'design.paths is empty: judge from the diff whether a screen changed']);
    expect(formatTouched({ ui: 'unknown', reason: 'cannot read origin/main' })).toEqual(['ui: unknown', 'cannot read origin/main']);
    expect(formatTouched({ ui: 'yes', paths: ['a.css', 'b.tsx'] })).toEqual(['ui: yes', '  a.css', '  b.tsx']);
  });
});

// PRD 1407: the library screens a diff touches, matched by their `implements` entries.
const EDITOR: ScreenTouch = { screen: 'quote-editor', status: 'locked', routes: ['/quotes/:id'], implements: ['src/quotes/editor/'] };
const LIST: ScreenTouch = { screen: 'quote-list', status: 'draft', routes: [], implements: ['src/quotes/list/**/*.tsx', 'src/quotes/List.tsx'] };
const OLD: ScreenTouch = { screen: 'old-editor', status: 'superseded', routes: ['/q', '/q/:id'], implements: ['./src/old/{a,b}.tsx'] };

describe('screensTouched', () => {
  it('keeps each screen an implements entry matches, with the design.paths semantics, in the library order', () => {
    const changed = ['src/quotes/editor/Toolbar.tsx', 'src/quotes/list/deep/Row.tsx', 'src/old/b.tsx'];
    expect(screensTouched([EDITOR, LIST, OLD], changed)).toEqual([EDITOR, LIST, OLD]);
    expect(screensTouched([EDITOR, LIST, OLD], ['src/quotes/List.tsx'])).toEqual([LIST]);
    expect(screensTouched([EDITOR, LIST, OLD], ['src/quotes/editor'])).toEqual([EDITOR]);
  });

  it('keeps none when no entry matches, a screen implements nothing, or nothing changed', () => {
    expect(screensTouched([EDITOR, LIST, OLD], ['src/quotes/editorial.tsx', 'src/quotes/list/Row.ts', 'src/old/c.tsx'])).toEqual([]);
    expect(screensTouched([{ ...EDITOR, implements: [] }], ['src/quotes/editor/a.tsx'])).toEqual([]);
    expect(screensTouched([EDITOR], [])).toEqual([]);
  });
});

describe('formatScreensTouched', () => {
  it('prints one screens: line, a lock on a locked screen, the status of any other, then its routes', () => {
    expect(formatScreensTouched([EDITOR, LIST, OLD])).toEqual(['screens: quote-editor 🔒 (/quotes/:id) · quote-list (draft) · old-editor (superseded) (/q, /q/:id)']);
    expect(formatScreensTouched([{ ...EDITOR, routes: [] }])).toEqual(['screens: quote-editor 🔒']);
  });

  it('prints no line when no screen is touched', () => {
    expect(formatScreensTouched([])).toEqual([]);
  });
});

// PRD 1550: a screen's `reads` — the code behind it — is named apart and never trips a lock; a change
// to its `implements` that leaves its mockup alone names the mockup as maybe stale.
const GAMES: ScreenRead = { screen: 'game-room', implements: ['src/arcade/scenes/games.tsx'], reads: ['src/arcade/games/'] };
const LOCKED_GAMES: ScreenTouch & ScreenRead = { ...GAMES, status: 'locked', routes: ['/play'] };

describe('screensRead', () => {
  it('keeps each screen a reads entry matches and no implements entry does, in the library order', () => {
    expect(screensRead([GAMES], ['src/arcade/games/kart/physics.ts'])).toEqual([GAMES]);
    expect(screensRead([GAMES], ['src/arcade/games/kart/physics.ts', 'src/arcade/scenes/games.tsx'])).toEqual([]);
    expect(screensRead([GAMES, { ...GAMES, screen: 'b', reads: [] }], ['src/arcade/games/a.ts'])).toEqual([GAMES]);
    expect(screensRead([GAMES], ['src/arcade/scenes/other.tsx'])).toEqual([]);
  });

  it('names no locked screen on the screens: line for a change under reads alone', () => {
    const changed = ['src/arcade/games/kart/physics.ts'];
    expect(screensTouched([LOCKED_GAMES], changed)).toEqual([]);
    expect(formatScreensTouched(screensTouched([LOCKED_GAMES], changed), screensRead([LOCKED_GAMES], changed))).toEqual(['screens: reads game-room']);
  });

  it('prints the screens an implements entry touches first, then each screen read, on one line', () => {
    expect(formatScreensTouched([EDITOR], [GAMES])).toEqual(['screens: quote-editor 🔒 (/quotes/:id) · reads game-room']);
    expect(formatScreensTouched([], [])).toEqual([]);
  });
});

describe('staleMocks', () => {
  const DIR = 'kb/design/screens/';
  const WITH_MOCK: MockedScreen = { screen: 'quote-editor', mock: 'quote-editor.html' };

  it('names each touched screen whose mockup the change leaves alone', () => {
    expect(staleMocks([WITH_MOCK], ['src/quotes/editor/a.tsx'], DIR)).toEqual(['quote-editor']);
  });

  it('names none whose mockup changed too, or that has no mockup', () => {
    expect(staleMocks([WITH_MOCK], ['src/quotes/editor/a.tsx', 'kb/design/screens/quote-editor.html'], DIR)).toEqual([]);
    expect(staleMocks([WITH_MOCK], ['src/quotes/editor/a.tsx', 'kb/design/screens/quote-editor.html'], 'kb/design/screens')).toEqual([]);
    expect(staleMocks([{ ...WITH_MOCK, mock: null }], ['src/quotes/editor/a.tsx'], DIR)).toEqual([]);
  });

  it('prints one mock may be stale: line per screen', () => {
    expect(formatStaleMocks(['a', 'b'])).toEqual(['mock may be stale: a', 'mock may be stale: b']);
    expect(formatStaleMocks([])).toEqual([]);
  });
});
