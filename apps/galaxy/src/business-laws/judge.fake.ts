// The judge's second reading, faked for tests (bug #2900): a call whose prompt lists the first reading's claims
// is answered by confirming each of them, so a test about the first reading reads its verdict as before. A test
// about the second reading itself (./judge-settles.test.ts) records its replies instead.
import type { AskLaws } from './judge.service';

/** The second reading's reply to `user`, confirming every claim; null when `user` is no second reading. */
function confirmingReply(user: string): unknown {
  if (!user.startsWith('Claims:')) return null;
  const claims = [...user.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
  return { findings: claims.map((n) => ({ n, breaks: true, why: 'The quoted words design what the law forbids.' })) };
}

/** `ask`, with every second reading answered by confirming its claims. */
export function confirming(ask: AskLaws): AskLaws {
  return (request) => {
    const reply = confirmingReply(request.user);
    return reply === null ? ask(request) : Promise.resolve({ ok: true as const, reply });
  };
}
