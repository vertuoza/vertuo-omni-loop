// GET /api/ask/tabs → {tabs}: the person's open terminals, polled by /ask every 2 s (PRD 1318,
// src/ask/ask.controller.ts).
export { getTabs as GET } from '../../../../src/ask/ask.controller';
