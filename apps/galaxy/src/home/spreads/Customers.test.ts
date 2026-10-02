import { readFileSync } from 'node:fs';
import { PERSONA_TRADES, validPersonaAvatar } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { Customers, EXAMPLE_BUSINESS, STANCES } from './Customers';
import { heading, html, text } from './render';

// Built for your customers (PRD 971, s3): the agents build for a team's customers, from the business,
// the products and the personas it writes down once. One invented company fills the chain, labelled
// EXAMPLE, and the last step shows the agents reading it on a run.

const css = readFileSync(new URL('./Customers.css', import.meta.url), 'utf8');
const markup = html(Customers());
const page = text(markup);

/** The chain's steps, by their heading, in the page's order. */
const steps = [...markup.matchAll(/<h3\b[^>]*class="home-customers-step-head"[^>]*>([\s\S]*?)<\/h3>/g)].map(([, h]) => text(h!));

describe('the example business', () => {
  it('is Brick & Bolt, software for renovation firms of 5 to 50 people in Europe, up against the spreadsheet', () => {
    expect(EXAMPLE_BUSINESS.name).toBe('Brick & Bolt');
    expect(EXAMPLE_BUSINESS.business.size).toBe('5 to 50 people');
    expect(EXAMPLE_BUSINESS.business.region).toBe('Europe');
    expect(EXAMPLE_BUSINESS.business.trade).toMatch(/renovation/i);
    expect(EXAMPLE_BUSINESS.business.rivals).toMatch(/spreadsheet/i);
  });

  it('sells one product: a site diary app', () => {
    expect(EXAMPLE_BUSINESS.products).toHaveLength(1);
    expect(EXAMPLE_BUSINESS.products[0]!.name).toMatch(/site diary/i);
  });

  it('has three personas, one per stance: an office manager, a subcontracting plumber and a site foreman', () => {
    expect(EXAMPLE_BUSINESS.personas.map((p) => [p.trade, p.stance])).toEqual([
      ['office', 'EXCITED'],
      ['plumber', 'NEUTRAL'],
      ['foreman', 'SKEPTICAL'],
    ]);
    expect(STANCES).toEqual(['EXCITED', 'NEUTRAL', 'SKEPTICAL']);
  });

  it('draws every persona from a trade and an avatar the portrait library holds', () => {
    const trades = new Set(PERSONA_TRADES.map((t) => t.id));
    for (const p of EXAMPLE_BUSINESS.personas) {
      expect(trades.has(p.trade), p.trade).toBe(true);
      expect(validPersonaAvatar(p.avatar), p.name).toBe(true);
    }
  });

  it('lets the skeptical persona object, and turns the answer into a fact the agents keep', () => {
    const { exchange, personas } = EXAMPLE_BUSINESS;
    expect(personas.find((p) => p.name === exchange.persona)?.stance).toBe('SKEPTICAL');
    expect(exchange.objection).toMatch(/\b(I|my)\b/);
    expect(exchange.answer).toBe('We sell to 5-person crews too.');
    expect(exchange.fact.length).toBeGreaterThan(0);
  });
});

describe('the customers spread', () => {
  it('opens on its own h2', () => {
    expect(heading(markup)).toBe('Built for your customers');
  });

  it('leads with who the agents build for', () => {
    expect(page).toContain("The agents don't build for you. They build for your customers. Tell them who those are once, and every run reads it.");
  });

  it('shows BUSINESS, PRODUCTS and PERSONAS in that order, then the agents reading them on every run', () => {
    expect(steps).toEqual(['BUSINESS', 'PRODUCTS', 'PERSONAS', 'THE AGENTS READ THEM ON EVERY RUN']);
    expect(markup).toMatch(/<ol class="home-customers-chain"/);
  });

  it('is labelled EXAMPLE, and names the invented company', () => {
    expect(markup).toMatch(/class="home-example"[^>]*>EXAMPLE</);
    expect(page).toContain('Brick & Bolt');
  });

  it('fills the business and the product from the example', () => {
    const { business, products } = EXAMPLE_BUSINESS;
    for (const v of [business.size, business.region, business.trade, business.rivals, products[0]!.name, products[0]!.line]) {
      expect(page).toContain(v);
    }
  });

  it('gives each persona a portrait, a name, a trade and a stance', () => {
    const cards = [...markup.matchAll(/<li\b[^>]*class="home-persona"[^>]*>([\s\S]*?)<\/li>/g)].map(([li, inner]) => ({ li: li!, inner: inner! }));
    expect(cards).toHaveLength(3);
    EXAMPLE_BUSINESS.personas.forEach((p, i) => {
      const { li, inner } = cards[i]!;
      expect(li).toContain(`data-stance="${p.stance}"`);
      expect(inner).toMatch(/<svg\b/);
      expect(inner).toContain(`<title>${p.name}, ${p.title}</title>`);
      expect(text(inner)).toContain(p.name);
      expect(text(inner)).toContain(p.title);
      expect(text(inner)).toContain(p.stance);
    });
  });

  it('shows the skeptical persona\'s objection, the answer and the fact the agents keep', () => {
    const { exchange } = EXAMPLE_BUSINESS;
    const at = [exchange.objection, exchange.answer, exchange.fact].map((s) => page.indexOf(s));
    expect(at.every((n) => n >= 0), String(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('names nothing from the business this repository was read from', () => {
    expect(page).not.toMatch(/vertuo/i);
    expect(markup).not.toMatch(/vertuo/i);
  });

  it('draws the chain as one column below 720px', () => {
    const narrow = /@media \(max-width: 719px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(narrow).toMatch(/\.home-customers-chain \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  });
});
