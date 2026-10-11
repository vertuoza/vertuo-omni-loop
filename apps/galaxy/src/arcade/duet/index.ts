// The one way into OMNI DUET (PRD 1633): the arcade imports this file with a dynamic `import()` when
// the cabinet opens, never before, so a page that never opens the game never downloads anything under
// arcade/duet/. Nothing outside this folder imports it at run time (guard.test.ts).
export { createDuet, type DuetOptions } from './art';
