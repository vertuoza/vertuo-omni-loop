// Flipping a trading card (PRD 261): a card is a button carrying `data-flip`, and a click on it (a
// tap, Enter and Space all make one) turns it over through `aria-pressed`, which home.css draws.
// Controls, HOME's one client component, calls this on every click.

/** Marks a trading card: a click on it flips it. */
export const FLIP_ATTR = 'data-flip';

type Flippable = { getAttribute(k: string): string | null; setAttribute(k: string, v: string): void };

/** Flips the card the click landed on or inside; false when it landed on no card. */
export function flipCard(target: { closest(selector: string): Flippable | null } | null): boolean {
  const card = target?.closest(`[${FLIP_ATTR}]`);
  if (!card) return false;
  card.setAttribute('aria-pressed', card.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  return true;
}
