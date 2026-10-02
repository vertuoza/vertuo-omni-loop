import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ForYou } from './ForYou';
import { heading, html, text } from './render';

describe('What\'s in it for you?', () => {
  const markup = html(ForYou());

  // Each card as a visitor reads it: its h3, its promise and its three proofs.
  const cards = [...markup.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(([, card]) => ({
    role: text(card!.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? ''),
    promise: text(card!.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
    proofs: [...card!.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, li]) => text(li!)),
  }));

  it('opens on its own h2', () => {
    expect(heading(markup)).toBe('What\'s in it for you?');
  });

  it('shows three role cards, each an h3, in the spec\'s order', () => {
    expect([...markup.matchAll(/<h3\b/g)]).toHaveLength(3);
    expect(cards.map((c) => c.role)).toEqual(['HEAD OF ENGINEERING', 'DEVELOPER', 'PRODUCT MANAGER']);
  });

  it('gives each card its promise and its three proofs, in the spec\'s words', () => {
    expect(cards).toEqual([
      {
        role: 'HEAD OF ENGINEERING',
        promise: 'More shipped, same guardrails.',
        proofs: [
          'Nothing reaches main without a person: the agents never merge.',
          'Your rules for agents (how you test, review and release) live in your repository, and every agent follows them.',
          'One folder to adopt; delete it to stop.',
        ],
      },
      {
        role: 'DEVELOPER',
        promise: 'Review small pull requests, not prompts.',
        proofs: [
          'Each feature is cut into small pieces, each built test-first, each with its own pull request.',
          'The agents don\'t stop to ask: they write every call down, and you answer once, at the end.',
          'A red CI check is the agent\'s to fix, not yours.',
        ],
      },
      {
        role: 'PRODUCT MANAGER',
        promise: 'Your brief becomes the build.',
        proofs: [
          'Turn an idea into a brief with Claude, with a before/after page, approved before any code is written.',
          'Follow it live: the brief, the plan and every question, on one shareable page.',
          'Every shipped feature gets a release note in plain words.',
        ],
      },
    ]);
  });

  it('shows all three with no script: nothing hidden, no tab, no toggle', () => {
    expect(markup).not.toMatch(/<script|hidden|aria-hidden|role="tab/);
  });

  it('puts the cards side by side on a wide screen and stacks them under 760 px', () => {
    const css = readFileSync(new URL('./ForYou.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.home-roles \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    const phone = [...css.matchAll(/@media \(max-width: 760px\) \{([\s\S]*?)\n\}/g)].map(([, b]) => b).join('\n');
    expect(phone).toMatch(/\.home-roles \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  });
});
