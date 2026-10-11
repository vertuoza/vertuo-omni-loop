// PRD 1559, s2: the parts check's two halves, pure — over a mockup page's marked screens, and over a
// diff's changes — and how a part's name is matched.
import { describe, expect, it } from 'vitest';
import { parseSelector, type Selector } from '../words/selector.ts';
import { formatDiffParts, parseNameStatus, partsOfDiff } from './diff.ts';
import { isListed, partKey } from './names.ts';
import { formatPageParts, partsOfPage, type PartRules } from './page.ts';

const selector = (source: string): Selector => {
  const parsed = parseSelector(source);
  if (!parsed) throw new Error(source);
  return parsed;
};

const RULES: PartRules = { screen: selector('[data-screen]'), primary: selector('[data-primary]'), content: selector('[data-content]'), parts: ['Button', 'EmptyState'] };

describe('part names', () => {
  it('match whatever their case, spaces, dashes or underscores', () => {
    expect(partKey('Empty state')).toBe('emptystate');
    expect(isListed(['EmptyState'], 'empty-state')).toBe(true);
    expect(isListed(['EmptyState'], 'empty_STATE')).toBe(true);
    expect(isListed(['EmptyState'], 'Empty')).toBe(false);
    expect(isListed(['EmptyState'], '--')).toBe(false);
  });
});

describe('partsOfPage', () => {
  it('reads each marked screen on its own, a nested one included', () => {
    const page = '<div data-screen="outer"><button data-part="Button">A</button><div data-screen="inner"><button>B</button></div></div>';
    expect(partsOfPage(page, RULES)).toEqual({
      skipped: false,
      screens: [
        { name: 'outer', tagged: 1, offList: [], untagged: [] },
        { name: 'inner', tagged: 0, offList: [], untagged: ['button "B"'] },
      ],
    });
  });

  it('counts a link classed as a button, a select, a textarea, a role and a primary mark as controls, and nothing hidden', () => {
    const page = `<main id="form">
      <a href="/a" class="btn-primary">Go</a><a href="/b">Plain link</a><select name="kind"></select><textarea aria-label="Note"></textarea>
      <div role="switch"></div><div data-primary>Send</div><input type="submit" value="Ok"><input type="hidden">
      <button hidden>Gone</button><div aria-hidden="true"><button>Gone</button></div>
    </main>`;
    const rules = { ...RULES, screen: selector('main') };
    expect(partsOfPage(page, rules).screens[0]?.untagged).toEqual(['a "Go"', 'select "kind"', 'textarea "Note"', 'div', 'div "Send"', 'input "Ok"']);
  });

  it('names a tag off the list once per screen, and reads nothing inside content', () => {
    const page = '<section data-screen="s"><i data-part="Chip"></i><i data-part="chip "></i><i data-part="Chip"></i><div data-content><button data-part="Pasted">x</button></div></section>';
    expect(partsOfPage(page, RULES).screens).toEqual([{ name: 's', tagged: 3, offList: ['Chip', 'chip'], untagged: [] }]);
  });

  it('names an unnamed screen by its place, and skips a page with no screen', () => {
    expect(partsOfPage('<div data-screen><button data-part="Button">Ok</button></div>', RULES).screens[0]?.name).toBe('#1');
    const skipped = partsOfPage('<button>Go</button>', RULES);
    expect(formatPageParts('p.html', skipped, RULES)).toEqual(['p.html', '  no screen marked: skipped ([data-screen])']);
  });

  it('prints one tag in the singular', () => {
    const read = partsOfPage('<div data-screen="s"><button data-part="Button">Ok</button></div>', RULES);
    expect(formatPageParts('p.html', read, RULES)).toEqual(['p.html', '  screen s · 1 part tagged', '    parts: all listed']);
  });
});

describe('partsOfDiff', () => {
  const parts = [{ name: 'Button', code: ['src/ui/Button.tsx'] }, { name: 'Table', code: ['src/ui/table/'] }];

  it('names each part whose code changed, in the list order, and each new component file nothing holds', () => {
    const changes = [
      { path: 'src/ui/table/Row.tsx', added: true },
      { path: 'src/ui/Button.tsx', added: false },
      { path: 'src/ui/Card.vue', added: true },
      { path: 'src/ui/Old.tsx', added: false },
      { path: 'src/pages/Home.svelte', added: true },
      { path: 'src/ui/theme.css', added: true },
    ];
    expect(partsOfDiff(changes, { parts, claimed: ['src/pages/'], paths: ['src/'] })).toEqual({ changed: ['Button', 'Table'], offList: ['src/ui/Card.vue'] });
  });

  it('cannot tell what is off the list with design.paths empty', () => {
    const read = partsOfDiff([{ path: 'src/ui/Card.tsx', added: true }], { parts, claimed: [], paths: [] });
    expect(read).toEqual({ changed: [], offList: null });
    expect(formatDiffParts(read)).toEqual(['parts changed: none', 'parts: unknown — design.paths is empty: judge from the diff whether a new file is a part']);
  });

  it('reads git name-status output, an added path apart from the rest', () => {
    expect(parseNameStatus('M\0src/a.tsx\0A\0src/b.tsx\0D\0src/c.tsx\0')).toEqual([
      { path: 'src/a.tsx', added: false },
      { path: 'src/b.tsx', added: true },
      { path: 'src/c.tsx', added: false },
    ]);
    expect(parseNameStatus('')).toEqual([]);
  });
});
