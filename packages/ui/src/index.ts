// Every part registers itself: src/generated/parts.ts exports each one present, written by
// `pnpm --filter @omni/ui parts` (build/parts.ts). The catalogue's list is `@omni/ui/catalogue`.
export * from './generated/parts.ts';
export type { ComponentMeta, ContrastPair, Part, Specimen } from './meta.ts';
