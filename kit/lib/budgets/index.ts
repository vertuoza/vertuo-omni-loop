// Budgets on what a repository's agents read (PRD 1679): the context measure and its ceilings file.
export { formShowText, measureContextBudget } from './measure.ts';
export type { Measure } from './measure.ts';
export { readCeilings, setCeilings, writeCeilings } from './ceilings.ts';
