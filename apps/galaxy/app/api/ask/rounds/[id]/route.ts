// GET /api/ask/rounds/:id → a round, its session, its earlier rounds and its shares, polled by
// /ask/q/<round> every 2 s (PRD 1318, src/ask/ask.controller.ts).
export { getRound as GET } from '../../../../../src/ask/ask.controller';
