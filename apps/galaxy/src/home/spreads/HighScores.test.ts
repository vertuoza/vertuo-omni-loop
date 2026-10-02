import { describe, expect, it } from 'vitest';
import { HighScores } from './HighScores';
import { heading, html, text } from './render';
import { item } from '../../ask/test-item';

describe('the high scores', () => {
  // As the build would count them: two counters read, one out of reach.
  const markup = html(HighScores({ scores: { prdsShipped: 21, slicesMerged: 134, decisionsAdopted: '—' } }));

  it('open on their own h2, then the line that the loop built itself', () => {
    expect(heading(markup)).toBe('High scores: the loop built this');
    expect(text(markup)).toMatch(/^High scores: the loop built this Omni Loop is built with Omni Loop\. /);
  });

  it('show the three counters as the build counted them, and — for one it could not read', () => {
    const scores = [...markup.matchAll(/<div class="home-score">([\s\S]*?)<\/div>/g)].map((m) => text(item(m, 1)));
    expect(scores).toEqual(['FEATURES SHIPPED 21', 'SLICES MERGED 134', 'DECISIONS ADOPTED —']);
  });

  it('keep the note on how they are counted', () => {
    expect(text(markup)).toContain('Counted from the loop\'s own shipped work, each time this page is built.');
  });
});
