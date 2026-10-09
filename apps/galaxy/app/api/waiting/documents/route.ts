// GET /api/waiting/documents → {documents}: the waiting list's New documents part, polled by the bell
// every 10 s visible (PRD 1318, src/waiting/waiting.controller.ts).
export { getDocuments as GET } from '../../../../src/waiting/waiting.controller';
