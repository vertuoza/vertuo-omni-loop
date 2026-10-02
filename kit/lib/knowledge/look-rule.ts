/**
 * **The look rule** (PRD #487, point 6): what keeps the knowledge base about what the product does,
 * never how it looks. Held once here and quoted word for word by the harvest's classifier prompt
 * (`classify.mjs`) and the retro's judge prompt, so both draw the same line.
 */
export const LOOK_RULE =
  'An entry states what the product does and guarantees, never how it looks: no colour, size, layout, position, count of visual elements, font, or exact label or copy. A candidate that is only about the look stays local. A candidate that mixes both is written as the behaviour alone.';
