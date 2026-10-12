// Where the waiting list's Questions part was read before PRD 1318 (s4): it is now read by
// src/waiting/waiting.service.ts, on the server only. The name stays here for the areas that still
// import it from this path.
export { readWaitingQuestions } from './waiting.service';
