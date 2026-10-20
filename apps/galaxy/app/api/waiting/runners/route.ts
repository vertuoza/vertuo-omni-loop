// GET /api/waiting/runners → {count}: how many of the workspace's runner jobs wait for an answer, the badge
// on Runners in the sidebar, polled every 15 s visible (PRD 2255, src/waiting/waiting.controller.ts). A
// member's session only: a kit or runner token is no session here.
export { getRunners as GET } from '../../../../src/waiting/waiting.controller';
