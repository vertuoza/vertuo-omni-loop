// The one way into OMNI KART (PRD 1359): the arcade imports this file with a dynamic `import()` when
// the cabinet opens, never before, so a page that never opens the game never downloads anything under
// arcade/kart/. Nothing outside this folder imports it at run time (guard.test.ts).
export { createKart, type KartOptions } from './art';
