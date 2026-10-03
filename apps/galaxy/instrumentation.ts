import { nextRuntime, serverEnv } from './src/env';

// Next calls register() once when a server instance starts, before it answers a request (PRD 1059).
// It parses the server's environment there, so a half-set group or a malformed value stops the
// deployment's startup with one error naming every variable concerned, never a value, rather than
// failing deep in a request an hour later. The arcade runs nothing on the edge; were it to, the edge
// would read only what it is handed, so the parse is the Node.js server's.
export function register(): void {
  if (nextRuntime() === 'edge') return;
  serverEnv();
}
