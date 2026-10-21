// `omni design words <page>…` (PRD 1407, s4): the word pass over a mockup — each screen's visible
// strings and word count, then its findings under four rules; a page with no marked screen is
// skipped (PRD 1550, s1). It reads structure, never style, and it
// only reports: exit 0 whatever it finds, on a fixture repository.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ON = 'design:\n  enabled: true\n';
const DESIGN = '.omni-loop/knowledge/playbook/design.md';

async function words(root: string, args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['design', 'words', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const page = (body: string) => `<!doctype html><html><head><title>Mock</title><style>.x{color:red}</style></head><body>${body}</body></html>`;

/** A design form whose `product` section is `product`. */
const form = (product: string) =>
  `---\nform: design\nform-version: 1\nstate: filled\npoints-to: null\nevidence: []\ninvaded: null\n---\n\n# Design\n\n## Product\n<!-- slot: product · required -->\n${product}\n\n## System\n<!-- slot: system · required -->\nTokens live in src/tokens.\n`;

describe('omni design words', () => {
  it('prints each screen, its strings and its word count, and no finding on a clean page', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<section data-screen="quotes"><h1>Quotes</h1><p>Three open quotes</p><button data-primary>New quote</button><a href="#">Archive</a></section>'),
      },
    });
    expect(await words(root, ['mock.html'])).toEqual({
      code: 0,
      out: ['mock.html', '  screen quotes · 7 words', '    Quotes (1)', '    Three open quotes (3)', '    [control] New quote (2)', '    [control] Archive (1)', '    findings: none', ''].join('\n'),
      err: '',
    });
  });

  it('flags a control whose label holds design.words.sentence words or more (sentence-on-control)', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<div data-screen="send"><button data-primary>Send this quote to the customer now</button><button>Send it now please today ok</button></div>'),
      },
    });
    const { code, out } = await words(root, ['mock.html']);
    expect(code).toBe(0);
    expect(out).toContain('    ! sentence-on-control: "Send this quote to the customer now" — 7 words on a control (7 or more)\n');
    expect(out).not.toContain('"Send it now please today ok"');
  });

  it('flags more than one primary action in one screen (two-primaries), screen by screen', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<main data-screen="a"><button data-primary>Save</button><a data-primary href="#">Send</a></main><main data-screen="b"><button data-primary>Save</button></main>'),
      },
    });
    const { code, out } = await words(root, ['mock.html']);
    expect(code).toBe(0);
    expect(out).toContain('  screen a · 2 words\n    [control] Save (1)\n    [control] Send (1)\n    ! two-primaries: 2 primary actions — "Save", "Send"\n');
    expect(out).toContain('  screen b · 1 word\n    [control] Save (1)\n    findings: none\n');
  });

  it('flags a sentence outside any control longer than design.words.sentence (explains-at-rest)', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<div data-screen="home"><p>This screen lets you see every quote you have sent</p><p>Seven words here are just fine ok</p></div>'),
      },
    });
    const { code, out } = await words(root, ['mock.html']);
    expect(code).toBe(0);
    expect(out).toContain('    ! explains-at-rest: "This screen lets you see every quote you have sent" — 10 words at rest (more than 7)\n');
    expect(out).not.toContain('! explains-at-rest: "Seven');
  });

  it('flags a word from design.words.avoid and from an explicit list in the form\'s product section (avoided-word)', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON + '  words:\n    avoid: [Submit]\n',
        [DESIGN]: form('Builders on site, in daylight.\n\nWords we avoid: utilize, click here'),
        'mock.html': page('<div data-screen="s"><p>Utilize the list</p><a href="#">Click here</a><button>submit</button><p>Resubmit later</p></div>'),
      },
    });
    const { code, out } = await words(root, ['mock.html']);
    expect(code).toBe(0);
    expect(out).toContain('    ! avoided-word: "utilize" in "Utilize the list"\n');
    expect(out).toContain('    ! avoided-word: "click here" in "Click here"\n');
    expect(out).toContain('    ! avoided-word: "Submit" in "submit"\n');
    expect(out).not.toContain('in "Resubmit later"');
  });

  it('never guesses an avoid list from prose in the product section', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        [DESIGN]: form('Its voice is plain; it tends to avoid jargon such as synergy.'),
        'mock.html': page('<div data-screen="s"><p>Synergy jargon</p></div>'),
      },
    });
    const { out } = await words(root, ['mock.html']);
    expect(out).not.toContain('avoided-word');
  });

  it("honours a repository's own selectors and threshold", async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON + '  words:\n    sentence: 3\n    screen: "section.screen, [role=dialog]"\n    primary: .btn-primary\n',
        'mock.html': page('<section class="screen" id="editor"><button class="btn btn-primary">Save</button><button class="btn-primary">Save and close now</button></section><div role="dialog" aria-label="Confirm"><p>Are you sure</p></div><div data-screen="ignored"></div>'),
      },
    });
    const { code, out } = await words(root, ['mock.html']);
    expect(code).toBe(0);
    expect(out).toContain('  screen editor · 5 words\n');
    expect(out).toContain('    ! sentence-on-control: "Save and close now" — 4 words on a control (3 or more)\n');
    expect(out).toContain('    ! two-primaries: 2 primary actions — "Save", "Save and close now"\n');
    expect(out).toContain('  screen Confirm · 3 words\n    Are you sure (3)\n    findings: none\n');
    expect(out).not.toContain('ignored');
  });

  it('skips a page with no marked screen, with no finding', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'plain.html': page('<h1>Hello</h1><p>PRD 1342. Nothing on a screen changes, only the words of this caption.</p><button data-primary>Go</button><button data-primary>Stop</button>'),
      },
    });
    expect(await words(root, ['plain.html'])).toEqual({ code: 0, out: ['plain.html', '  no screen marked: skipped ([data-screen])', ''].join('\n'), err: '' });
  });

  it("reads PRD 1407's before/after: its two primaries and its explanation at rest, the caption outside left alone", async () => {
    const before = readFileSync(resolve(REPO, '.omni-loop/delivery/shipped/1407-design-memory/before-after.html'), 'utf8');
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'before-after.html': before } });
    const { code, out } = await words(root, ['before-after.html']);
    expect(code).toBe(0);
    expect(out).toContain('  screen today · ');
    expect(out).toContain('    [control] Save (1)\n');
    expect(out).toContain('    ! two-primaries: 2 primary actions — "Save", "Click here to send this quote to the customer now"\n');
    expect(out).toContain('    ! explains-at-rest: "Use this screen to create a new quote for your customer and send it." — 14 words at rest (more than 7)\n');
    expect(out).not.toContain('Nobody read its words');
    expect(out).not.toContain('no screen marked');
  });

  it('names a page it cannot read and goes on to the next, still exit 0', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON, 'ok.html': page('<div data-screen="s"><p>Fine</p></div>') } });
    const { code, out } = await words(root, ['missing.html', 'ok.html']);
    expect(code).toBe(0);
    expect(out).toMatch(/^missing\.html: cannot read — /);
    expect(out).toContain('ok.html\n  screen s · 1 word\n');
  });

  it('prints design: off while the flag is off, and exits 2 on a usage mistake only', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD, 'mock.html': page('<p>x</p>') } });
    expect(await words(root, ['mock.html'])).toEqual({ code: 0, out: 'design: off\n', err: '' });
    const on = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD + ON } });
    expect((await words(on.root, [])).code).toBe(2);
  });

  it('counts the text inside [data-content] apart, as content · <n> words, with no finding on it (PRD 1584)', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<section data-screen="dossier"><h1>Spec</h1><article data-content><p>This PRD explains at length what the screen shows to its reader.</p></article></section>'),
      },
    });
    expect(await words(root, ['mock.html'])).toEqual({
      code: 0,
      out: ['mock.html', '  screen dossier · 1 word', '    Spec (1)', '    content · 12 words', '    findings: none', ''].join('\n'),
      err: '',
    });
  });

  it('reads the content mark design.words.content sets (PRD 1584)', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON + '  words:\n    content: .figures\n',
        'mock.html': page('<div data-screen="dash"><p class="figures">12 quotes sent and 4 signed this week by the crew</p><p data-content>Six words that are now copy</p></div>'),
      },
    });
    const { out } = await words(root, ['mock.html']);
    expect(out).toContain('    Six words that are now copy (6)\n    content · 11 words\n    findings: none\n');
  });

  it("reads a sentence whole across its inline code, and a control's parts with a space (PRD 1584)", async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': HEAD + ON,
        'mock.html': page('<div data-screen="s"><p>on <code>main</code> (2026-10-11)</p><button><b>CREW TOP 5</b><span>NO SCORES YET</span></button><div><span>ask.client.ts</span><span>POST</span></div></div>'),
      },
    });
    const { out } = await words(root, ['mock.html']);
    expect(out).toContain('    on main (2026-10-11) (3)\n    [control] CREW TOP 5 NO SCORES YET (6)\n    ask.client.ts (1)\n    POST (1)\n');
  });

  describe("the product's glossary (PRD 1795, s6)", () => {
    const COPY = '.omni-loop/local/product-knowledge.json';
    const copy = (glossary: unknown) => JSON.stringify({ product: 'Acme', readAt: '2026-10-16T10:00:00.000Z', legal: [], glossary });
    const mock = page('<div data-screen="s"><p>Ask for a refund</p><p>Utilize it</p></div>');

    it("adds the glossary's avoided words from the local copy and names the product's term, without duplicates", async () => {
      const { root } = makeRepo({
        git: true,
        files: {
          '.omni-loop/config.yml': HEAD + ON + '  words:\n    avoid: [Refund]\n',
          [DESIGN]: form('Plain.\n\nWords we avoid: utilize'),
          [COPY]: copy([{ term: 'Credit note', meaning: 'Cancels an invoice.', avoid: ['refund', 'Utilize', 'reimbursement'] }]),
          'mock.html': mock,
        },
      });
      const { code, out } = await words(root, ['mock.html']);
      expect(code).toBe(0);
      expect(out).toContain('    ! avoided word: Refund → say Credit note (in "Ask for a refund")\n');
      expect(out.match(/avoided word: Refund/g)).toHaveLength(1);
      expect(out.match(/avoided[ -]word: "?utilize/gi)).toHaveLength(1);
    });

    it("uses today's avoid list when there is no copy, or one out of shape", async () => {
      for (const extra of [{}, { [COPY]: '{not json' }, { [COPY]: JSON.stringify({ glossary: 3 }) }]) {
        const { root } = makeRepo({
          git: true,
          files: { '.omni-loop/config.yml': HEAD + ON + '  words:\n    avoid: [utilize]\n', 'mock.html': mock, ...extra },
        });
        const { out } = await words(root, ['mock.html']);
        expect(out).not.toContain('the product says');
        expect(out).not.toContain('"refund"');
        expect(out).toContain('    ! avoided-word: "utilize" in "Utilize it"\n');
      }
    });
  });
});
