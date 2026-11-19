import { Code } from './Code.tsx';
import { CODE_DISPLAYS } from './Code.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** Code inline and as a block. */
export const codeSpecimen: Specimen = (prop, value) => (
  <Code {...(prop === 'display' ? { display: one(CODE_DISPLAYS, value) } : {})}>
    {prop === 'display' && value === 'block' ? 'pnpm install --frozen-lockfile\npnpm test' : 'pnpm test'}
  </Code>
);
