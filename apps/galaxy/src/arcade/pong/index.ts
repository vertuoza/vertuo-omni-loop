// The one way into OMNI PONG (PRD 2101): the arcade imports this file with a dynamic `import()` when
// the cabinet opens, never before, so a page that never opens the game never downloads anything under
// arcade/pong/. Nothing outside this folder imports it at run time (guard.test.ts).
export { createPong } from './art';
export { browserMic } from './mic';
