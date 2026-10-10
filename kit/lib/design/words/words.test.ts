// PRD 1407, s4: the word pass's parts — the selectors it reads, its forgiving HTML read, the avoid
// list it takes from the `design` form's `product` section, and the pass itself.
import { describe, expect, it } from 'vitest';
import { assertDefined } from '../../../test/assert.ts';
import { avoidedWords } from './avoid.ts';
import { decodeEntities, type Element, parseHtml } from './html.ts';
import { countWords, wordPass, type WordRules } from './pass.ts';
import { matches, namingAttributes, parseSelector, type Selector } from './selector.ts';

const selector = (source: string): Selector => {
  const parsed = parseSelector(source);
  assertDefined(parsed, source);
  return parsed;
};
const markup = (tag: string, attributes: Record<string, string>) => ({ tag, attributes: new Map(Object.entries(attributes)) });
const rules = (over: Partial<WordRules> = {}): WordRules => ({ sentence: 7, screen: selector('[data-screen]'), primary: selector('[data-primary]'), avoid: [], ...over });

describe('the word pass selectors', () => {
  it('reads tags, ids, classes, bare and valued attributes, and comma lists', () => {
    expect(matches(selector('[data-screen]'), markup('div', { 'data-screen': '' }))).toBe(true);
    expect(matches(selector('[data-screen]'), markup('div', {}))).toBe(false);
    expect(matches(selector('section.screen'), markup('section', { class: 'a screen b' }))).toBe(true);
    expect(matches(selector('section.screen'), markup('div', { class: 'screen' }))).toBe(false);
    expect(matches(selector('#main'), markup('div', { id: 'main' }))).toBe(true);
    expect(matches(selector('[role=dialog]'), markup('div', { role: 'dialog' }))).toBe(true);
    expect(matches(selector('[role="dialog"]'), markup('div', { role: 'alert' }))).toBe(false);
    expect(matches(selector("*[data-kind='x']"), markup('p', { 'data-kind': 'x' }))).toBe(true);
    expect(matches(selector('.a, .b'), markup('p', { class: 'b' }))).toBe(true);
    expect(matches(selector('BUTTON'), markup('button', {}))).toBe(true);
  });

  it('refuses a combinator, a pseudo-class, an empty piece or loose text', () => {
    for (const bad of ['main > section', 'main section', 'button:hover', '.a,', '', '[x', '.']) expect(parseSelector(bad)).toBeNull();
  });

  it('names a screen only by an attribute asked for by name alone', () => {
    expect(namingAttributes(selector('[data-screen], [role=dialog], [data-view][data-screen]'))).toEqual(['data-screen', 'data-view']);
  });
});

describe('the HTML read', () => {
  const texts = (element: Element): string[] => element.children.flatMap((child) => (child.kind === 'text' ? [child.text] : texts(child)));

  it('decodes entities and leaves an unknown one as written', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#8212; &#x2192; &nbsp;&bogus; &mdash;')).toBe('a & b <c> — →  &bogus; —');
  });

  it('skips comments, doctype, script and style bodies, and forgives stray and missing end tags', () => {
    const root = parseHtml('<!doctype html><!-- note --><div><p>One<script>var a = "<p>no</p>";</script><style>p{}</style></span>Two<br/><img src=x alt="y">Three</div>');
    expect(texts(root).join('|')).toBe('One|Two|Three');
    const div = root.children.find((child): child is Element => child.kind === 'element');
    expect(div?.tag).toBe('div');
  });

  it('reads attributes quoted, unquoted and bare, lowercasing their names', () => {
    const root = parseHtml('<Button DATA-Primary class=big title="a &amp; b" disabled>Go</Button>');
    const button = root.children[0];
    expect(button?.kind === 'element' && Object.fromEntries(button.attributes)).toEqual({ 'data-primary': '', class: 'big', title: 'a & b', disabled: '' });
  });
});

describe('the avoid list of the product section', () => {
  it('reads an explicit list on its labelled line, in any of its labels and dress', () => {
    expect(avoidedWords('Builders on site.\n\nWords we avoid: utilize, `click here`; "leverage".')).toEqual(['utilize', 'click here', 'leverage']);
    expect(avoidedWords('- **Avoid:** synergy')).toEqual(['synergy']);
    expect(avoidedWords('Words to avoid: a\nAvoided words: b, A')).toEqual(['a', 'b']);
  });

  it('reads a bullet list under a label alone on its line, stopping where it ends', () => {
    expect(avoidedWords('Words the product avoids:\n- utilize\n- click here\n\nNot this: one')).toEqual(['utilize', 'click here']);
    expect(avoidedWords('- Voice: plain\n- Avoid:\n  - jargon\n- Tone: warm')).toEqual(['jargon']);
  });

  it('never guesses from prose', () => {
    expect(avoidedWords('Its voice is plain; it avoids jargon such as synergy.')).toEqual([]);
    expect(avoidedWords('We avoid: nothing in particular, really, as a rule')).toEqual([]);
    expect(avoidedWords('TODO(human): Who uses this product? Which words does it use and avoid?')).toEqual([]);
  });
});

describe('the pass', () => {
  it('counts the tokens that hold a letter or a digit', () => {
    expect(countWords('  Save — and 2 close  · ')).toBe(4);
  });

  it('reads a nested screen on its own, never inside its parent', () => {
    const page = wordPass('<div data-screen="outer"><p>Outer</p><div data-screen="inner"><button data-primary>In</button></div><button data-primary>Out</button></div>', rules());
    expect(page.screens.map((screen) => [screen.name, screen.phrases.map((phrase) => phrase.text), screen.findings.length])).toEqual([
      ['outer', ['Outer', 'Out'], 0],
      ['inner', ['In'], 0],
    ]);
  });

  it('leaves out what the markup hides, and reads an input button by its value', () => {
    const page = wordPass('<div data-screen="s"><p hidden>Gone</p><span aria-hidden="true">Icon</span><input type="submit" value="Send it"><input type="text" value="typed"></div>', rules());
    expect(page.screens[0]?.phrases).toEqual([{ text: 'Send it', words: 2, control: true }]);
  });

  it('matches an avoided phrase whole, across spaces, in any case', () => {
    const page = wordPass('<div data-screen="s"><p>Please CLICK   here now</p><p>Clicker</p></div>', rules({ avoid: ['click here', 'click'] }));
    expect(page.screens[0]?.findings.map((finding) => finding.message)).toEqual(['"click here" in "Please CLICK here now"', '"click" in "Please CLICK here now"']);
  });

  it('names a screen by its id or its label when its own attribute is empty, else by its place', () => {
    const page = wordPass('<div data-screen id="a"><p>x</p></div><div data-screen aria-label="B"><p>y</p></div><div data-screen><p>z</p></div>', rules());
    expect(page.screens.map((screen) => screen.name)).toEqual(['a', 'B', '#3']);
  });
});
