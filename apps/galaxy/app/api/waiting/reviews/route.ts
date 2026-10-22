// GET /api/waiting/reviews → {items}: the open review, merge and law waits whose turn names the signed-in
// member by GitHub login, the bell's Reviews group and the Waiting entry's badge, polled every 15 s visible
// (PRD 2377 s5, src/waiting/waiting.controller.ts). A member's session only: a kit or runner token is no
// session here.
export { getReviews as GET } from '../../../../src/waiting/waiting.controller';
