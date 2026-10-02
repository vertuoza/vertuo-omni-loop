import { describe, expect, it } from 'vitest';
import { heading, html, text } from './render';
import { SeeEverything } from './SeeEverything';
import { item } from '../../ask/test-item';

describe('You see everything', () => {
  const markup = html(SeeEverything());
  const bullets = [...markup.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => item(m, 1));
  // A bullet's words as read: its inline tags (the name, the link) run on with the words around them.
  const words = (li: string) => text(li.replace(/<\/?(?:a|b)\b[^>]*>/g, ''));

  it('opens on its own h2, then its line', () => {
    expect(heading(markup)).toBe('You see everything');
    expect(text(markup)).toMatch(/^You see everything Every step leaves something a person can read\. /);
  });

  it('lists the six bullets in the spec\'s order and words, each a name then what it gives', () => {
    expect(bullets.map(words)).toEqual([
      'The outbox lists every decision the agents took without asking; you adopt it or change it.',
      'One page per feature keeps its brief, its plan and its before/after, every version, with the questions that shaped them.',
      'Questions on a web page: the agents ask in your browser, not only in a terminal; a teammate can answer, and every answer is kept.',
      'A knowledge base that grows: settled decisions become rules and decision records the next loop reads, mapped as one graph.',
      'Release notes: every shipped feature, in plain words, on a public page.',
      'The galaxy: every feature a planet, every team a fleet, so the whole company sees what moves and what is stuck.',
    ]);
    expect(bullets.map((li) => text(/<b>([\s\S]*?)<\/b>/.exec(li)?.[1] ?? ''))).toEqual([
      'The outbox', 'One page per feature', 'Questions on a web page:', 'A knowledge base that grows:', 'Release notes:', 'The galaxy:',
    ]);
  });

  it('links public page to /releases, and links nowhere else', () => {
    const links = [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    expect(links).toHaveLength(1);
    expect(item(item(links, 0), 1)).toContain('href="/releases"');
    expect(text(item(item(links, 0), 2))).toBe('public page');
    expect(bullets[4]).toContain(item(item(links, 0), 0));
  });
});
