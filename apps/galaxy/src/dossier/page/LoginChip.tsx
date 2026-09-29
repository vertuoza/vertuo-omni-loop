import type { Face } from '../../people/face';
import { PersonChip } from '../../people/PersonChip';

// A GitHub login as the Outbox tab names it (PRD 652): `@login`, with its face before it when the page
// knows one, so the reply's author and the sender read at a glance. With none, `@login` as before.

export function LoginChip({ login, face }: { login: string; face: Face | null | undefined }) {
  return face ? <PersonChip person={{ name: `@${login}`, face }} size="inline" /> : <>@{login}</>;
}
