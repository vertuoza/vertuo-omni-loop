// GET /api/waiting/questions → {questions}: the waiting list's Questions part, polled by the bell every
// 5 s visible and 15 s hidden (PRD 1318, src/waiting/waiting.controller.ts).
export { getQuestions as GET } from '../../../../src/waiting/waiting.controller';
