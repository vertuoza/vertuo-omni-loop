// GET /api/waiting/supervisor → {seat, high}: whether the workspace has a Supervisor seat, which shows the menu's
// Supervisor row, and its open high findings, the row's red badge, polled every 15 s visible (omni-loop-34 s8,
// src/waiting/waiting.controller.ts). A member's session only: a kit or runner token is no session here.
export { getSupervisor as GET } from '../../../../src/waiting/waiting.controller';
