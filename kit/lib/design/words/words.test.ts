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
const rules = (over: Partial<WordRules> = {}): WordRules => ({
  sentence: 7,
  screen: selector('[data-screen]'),
  primary: selector('[data-primary]'),
  content: selector('[data-content]'),
  avoid: [],
  ...over,
});
const texts = (html: string): string[] => wordPass(`<div data-screen="s">${html}</div>`, rules()).screens[0]?.phrases.map((phrase) => phrase.text) ?? [];

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

  it('skips a page with no marked screen, with no finding (PRD 1550)', () => {
    expect(wordPass('<h1>Hello</h1><p>A caption that explains the whole page at length to its reader.</p>', rules())).toEqual({ skipped: true, screens: [] });
  });

  it('reads two marked screens apart (PRD 1550)', () => {
    const page = wordPass('<p>Caption outside every screen, never read by the pass at all.</p><div data-screen="a"><p>One</p></div><div data-screen="b"><p>Two</p></div>', rules());
    expect(page.skipped).toBe(false);
    expect(page.screens.map((screen) => [screen.name, screen.phrases.map((phrase) => phrase.text)])).toEqual([
      ['a', ['One']],
      ['b', ['Two']],
    ]);
  });

  it('keeps sibling elements as two strings, and the text runs of one element as one (PRD 1550)', () => {
    const page = wordPass('<div data-screen="s"><span>ask.client.ts</span><span>POST</span><p>one <!-- c -->run &amp; more</p></div>', rules());
    expect(page.screens[0]?.phrases.map((phrase) => phrase.text)).toEqual(['ask.client.ts', 'POST', 'one run & more']);
  });

  it('reads an element the primary selector matches as a control, whatever its tag (PRD 1550)', () => {
    const page = wordPass('<div data-screen="s"><span data-primary>Save</span><div data-primary>Send it</div></div>', rules());
    expect(page.screens[0]?.phrases).toEqual([
      { text: 'Save', words: 1, control: true },
      { text: 'Send it', words: 2, control: true },
    ]);
    expect(page.screens[0]?.findings.map((finding) => finding.rule)).toEqual(['two-primaries']);
  });

  it('keeps a sentence whole across the phrasing elements inside its running text (PRD 1584)', () => {
    expect(texts('<p>on <code>main</code> (2026-10-11)</p>')).toEqual(['on main (2026-10-11)']);
    expect(texts('<p>Saved <em>two <b>quotes</b></em> for <time>today</time>, <span>see</span> below</p>')).toEqual(['Saved two quotes for today, see below']);
    expect(texts('<p>Read <a href="#">the guide</a> first</p>')).toEqual(['Read', 'the guide', 'first']);
  });

  it('keeps sibling blocks, and a layout of spans with no running text, as separate strings (PRD 1584)', () => {
    expect(texts('<div><p>One</p><p>Two</p></div>')).toEqual(['One', 'Two']);
    expect(texts('<div>\n  <span>ask.client.ts</span>\n  <span>POST</span> · <span>200</span>\n</div>')).toEqual(['ask.client.ts', 'POST', '200']);
    expect(texts('<p>Lead <span>one</span><div>Block</div> tail</p>')).toEqual(['Lead one', 'Block', 'tail']);
  });

  it("joins a control's sibling parts with a space (PRD 1584)", () => {
    const page = wordPass('<div data-screen="s"><button data-primary><b>CREW TOP 5</b><span>NO SCORES YET</span></button><a href="#">Re<b>try</b></a></div>', rules());
    expect(page.screens[0]?.phrases).toEqual([
      { text: 'CREW TOP 5 NO SCORES YET', words: 6, control: true },
      { text: 'Retry', words: 1, control: true },
    ]);
  });

  it('counts the text inside a content mark apart and raises no finding on it (PRD 1584)', () => {
    const page = wordPass(
      '<div data-screen="s"><h1>Spec</h1><article data-content><p>This PRD explains at great length what the screen should show to its reader.</p><button data-primary>Not ours</button></article><p>Updated <span data-content>three days</span> ago</p></div>',
      rules({ avoid: ['explains'] }),
    );
    const [screen] = page.screens;
    expect(screen?.phrases.map((phrase) => phrase.text)).toEqual(['Spec', 'Updated ago']);
    expect(screen?.words).toBe(3);
    expect(screen?.content).toBe(18);
    expect(screen?.findings).toEqual([]);
  });

  it('reads the content mark from the rules, so a repository may set its own (PRD 1584)', () => {
    const page = wordPass('<div data-screen="s"><p data-content>Kept as content here</p><p class="data">This long sentence is now read as words of the screen itself</p></div>', rules({ content: selector('.data') }));
    expect(page.screens[0]?.content).toBe(12);
    expect(page.screens[0]?.phrases.map((phrase) => phrase.text)).toEqual(['Kept as content here']);
  });
});
