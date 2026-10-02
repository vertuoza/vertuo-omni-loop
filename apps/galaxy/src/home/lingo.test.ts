import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Home } from './Home';
import { BANNED_WORDS, bannedWords, LINGO, lingoFindings, LOOP_TERMS, unglossedTerms, unusedGlosses } from './lingo';

// LOOP LINGO (PRD 285, s3; trimmed by PRD 971, s2): the loop terms HOME glosses, the loop words it never says, and the
// checks that keep a text to them.

// HOME is rendered as the server renders it; its server-only guard has no server to check here.
vi.mock('server-only', () => ({}));

describe('LOOP LINGO', () => {
  it('glosses the three terms HOME still says, in the loop\'s order', () => {
    expect(LINGO.map((e) => e.term)).toEqual(['PRD', 'SLICE', 'OUTBOX']);
  });

  it('still counts HARNESS and WAVE as loop terms: out of the sidebar, so out of HOME\'s prose', () => {
    expect(LOOP_TERMS).toEqual(['HARNESS', 'PRD', 'SLICE', 'WAVE', 'OUTBOX']);
  });

  it('glosses each term in the spec\'s words', () => {
    expect(Object.fromEntries(LINGO.map((e) => [e.term, e.gloss]))).toEqual({
      PRD: 'The brief for one feature: the problem, the stories, and what done means.',
      SLICE: 'One small piece of a feature, built test-first, with its own pull request.',
      OUTBOX: 'The decisions the agents took without asking, waiting for your answer.',
    });
  });

  it('bans the other loop words', () => {
    expect(BANNED_WORDS).toEqual(['phase-0', 'worktree', 'sub-PR', 'dossier', 'territory', 'yolo']);
  });
});

describe('an unglossed term', () => {
  it('is a loop term the text uses that the sidebar does not gloss', () => {
    expect(unglossedTerms('The next wave starts now.')).toEqual(['WAVE']);
  });

  it('is none when every term used is glossed', () => {
    expect(unglossedTerms('The next slice starts now.')).toEqual([]);
  });

  it('matches a whole word only, in any case, with or without a plural s', () => {
    expect(unglossedTerms('WAVES of work')).toEqual(['WAVE']);
    expect(unglossedTerms('Wave after wave')).toEqual(['WAVE']);
    expect(unglossedTerms('A microwave, wavelength, waved, awave.')).toEqual([]);
  });
});

describe('an unused gloss', () => {
  it('is a glossed term the text never uses', () => {
    expect(unusedGlosses('Write the PRD, then cut each slice.')).toEqual(['OUTBOX']);
  });

  it('counts a plural and any case as a use', () => {
    expect(unusedGlosses('No brief yet: Slices and the Outbox.')).toEqual(['PRD']);
    expect(unusedGlosses('prds, SLICES and the OutBox')).toEqual([]);
  });
});

describe('a banned word', () => {
  it('is found wherever the text says it, in any case, singular or plural', () => {
    expect(bannedWords('Open a Sub-PR per slice, each in its own worktrees.')).toEqual(['worktree', 'sub-PR']);
    expect(bannedWords('PHASE-0 first. Then yolo. The dossier, the territory.'))
      .toEqual(['phase-0', 'dossier', 'territory', 'yolo']);
  });

  it('matches a whole word only', () => {
    expect(bannedWords('Territorial dossiers? A phase-01 and a yolos.')).toEqual(['dossier', 'yolo']);
    expect(bannedWords('A subPR, a work tree, extraterritory.')).toEqual([]);
  });
});

describe('the findings on a text', () => {
  it('are none when the text uses every term and no banned word', () => {
    const text = 'A PRD is split into slices. The outbox holds the decisions.';
    expect(lingoFindings(text)).toEqual({ unglossed: [], unused: [], banned: [] });
  });

  it('names each kind of finding', () => {
    const glossary = LINGO.filter((e) => e.term !== 'PRD');
    expect(lingoFindings('A PRD, a wave, a worktree.', glossary))
      .toEqual({ unglossed: ['PRD', 'WAVE'], unused: ['SLICE', 'OUTBOX'], banned: ['worktree'] });
  });
});

// The guard on HOME itself (PRD 285, s8): the text a visitor reads, with what is not prose left out.
// A command in <code> or a key in <kbd> is not prose; a fleet card's motto and rule are the game's own
// data; the LOOP LINGO sidebar is the glossary, so it cannot count as a use of its own glosses.
const prose = (markup: string) => markup
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<code\b[\s\S]*?<\/code>/g, ' ')
  .replace(/<kbd\b[\s\S]*?<\/kbd>/g, ' ')
  .replace(/<button\b[^>]*class="home-card"[\s\S]*?<\/button>/g, ' ')
  .replace(/<aside\b[^>]*class="home-lingo"[\s\S]*?<\/aside>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

describe('the prose filter', () => {
  it('drops scripts, <code>, <kbd>, the fleet cards and the LOOP LINGO sidebar, and keeps the rest', () => {
    const sample = '<script>yolo()</script><p>Run <code>omni yolo</code>, press <kbd>B A</kbd>.</p>'
      + '<button type="button" class="home-card" aria-pressed="false"><span>Eight arms, eight sub-PRs.</span></button>'
      + '<aside class="home-lingo"><dt>WAVE</dt></aside><p>A PRD &amp; a slice.</p>';
    expect(prose(sample)).toBe('Run , press . A PRD & a slice.');
  });
});

describe('HOME\'s prose', () => {
  const markup = renderToStaticMarkup(Home());
  const page = prose(markup);

  // HOME says no command since the strategy guide became the loop (PRD 971): the filter's own test
  // above still holds <code> to it.
  it('is read from a render that has keys, fleet cards and the sidebar to leave out', () => {
    for (const part of [/<kbd\b/, /class="home-card"/, /class="home-lingo"/]) expect(markup).toMatch(part);
    expect(page).not.toContain('Loop lingo');
    expect(page).not.toContain(LINGO[0]!.gloss);
    expect(page).toContain('AGENTS SHIP. YOU STEER.');
    expect(page).toContain('Join the loop!');
  });

  it('glosses in LOOP LINGO every loop term it uses', () => {
    expect(unglossedTerms(page)).toEqual([]);
  });

  it('uses every LOOP LINGO gloss at least once', () => {
    expect(unusedGlosses(page)).toEqual([]);
  });

  it('never says a banned loop word', () => {
    expect(bannedWords(page)).toEqual([]);
  });

  it('keeps to LOOP LINGO on every count', () => {
    expect(lingoFindings(page)).toEqual({ unglossed: [], unused: [], banned: [] });
  });
});
