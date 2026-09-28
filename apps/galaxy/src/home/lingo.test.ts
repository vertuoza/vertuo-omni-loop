import { describe, expect, it } from 'vitest';
import { BANNED_WORDS, bannedWords, LINGO, lingoFindings, LOOP_TERMS, unglossedTerms, unusedGlosses } from './lingo';

// LOOP LINGO (PRD 285, s3): the five loop terms HOME glosses, the loop words it never says, and the
// checks that keep a text to them.

describe('LOOP LINGO', () => {
  it('holds the five terms in the loop\'s order', () => {
    expect(LINGO.map((e) => e.term)).toEqual(['HARNESS', 'PRD', 'SLICE', 'WAVE', 'OUTBOX']);
    expect(LOOP_TERMS).toEqual(['HARNESS', 'PRD', 'SLICE', 'WAVE', 'OUTBOX']);
  });

  it('glosses each term in the spec\'s words', () => {
    expect(Object.fromEntries(LINGO.map((e) => [e.term, e.gloss]))).toEqual({
      HARNESS: 'Your repository\'s rules for agents: how to test, build, review and release.',
      PRD: 'The brief for one feature: the problem, the stories, and what done means.',
      SLICE: 'One small piece of a feature, built test-first, with its own pull request.',
      WAVE: 'The slices that can be built at the same time.',
      OUTBOX: 'The decisions the agents took without asking, waiting for your answer.',
    });
  });

  it('bans the other loop words', () => {
    expect(BANNED_WORDS).toEqual(['phase-0', 'worktree', 'sub-PR', 'dossier', 'territory', 'yolo']);
  });
});

describe('an unglossed term', () => {
  const noWave = LINGO.filter((e) => e.term !== 'WAVE');

  it('is a loop term the text uses that the sidebar does not gloss', () => {
    expect(unglossedTerms('The next wave starts now.', noWave)).toEqual(['WAVE']);
  });

  it('is none when every term used is glossed', () => {
    expect(unglossedTerms('The next wave starts now.')).toEqual([]);
  });

  it('matches a whole word only, in any case, with or without a plural s', () => {
    expect(unglossedTerms('WAVES of work', noWave)).toEqual(['WAVE']);
    expect(unglossedTerms('Wave after wave', noWave)).toEqual(['WAVE']);
    expect(unglossedTerms('A microwave, wavelength, waved, awave.', noWave)).toEqual([]);
  });
});

describe('an unused gloss', () => {
  it('is a glossed term the text never uses', () => {
    expect(unusedGlosses('Write the PRD, then cut each slice.')).toEqual(['HARNESS', 'WAVE', 'OUTBOX']);
  });

  it('counts a plural and any case as a use', () => {
    expect(unusedGlosses('Harnesses? No: prds, Slices, waves and the Outbox.')).toEqual(['HARNESS']);
    expect(unusedGlosses('the harness, prds, Slices, waves and the Outbox')).toEqual([]);
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
    const text = 'Your harness sets the rules. A PRD is split into slices; each wave builds some. '
      + 'The outbox holds the decisions.';
    expect(lingoFindings(text)).toEqual({ unglossed: [], unused: [], banned: [] });
  });

  it('names each kind of finding', () => {
    const glossary = LINGO.filter((e) => e.term !== 'PRD');
    expect(lingoFindings('A PRD, a wave, a worktree.', glossary))
      .toEqual({ unglossed: ['PRD'], unused: ['HARNESS', 'SLICE', 'OUTBOX'], banned: ['worktree'] });
  });
});
