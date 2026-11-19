import { Prose } from './Prose.tsx';
import { PROSE_MEASURES } from './Prose.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** Prose at each measure: a heading, a paragraph with a link, a list and a quote. */
export const proseSpecimen: Specimen = (prop, value) => (
  <Prose {...(prop === 'measure' ? { measure: one(PROSE_MEASURES, value) } : {})}>
    <h2>What changes</h2>
    <p>
      The spec says what a person sees when the page loads, and <a href="#prose">why it matters</a>.
    </p>
    <ul>
      <li>The list is read in order.</li>
      <li>Each item stays on its own line.</li>
    </ul>
    <blockquote>One short quote, set off from the text.</blockquote>
  </Prose>
);
