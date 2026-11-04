// A push starts the business laws' judging without slowing its answer (PRD 2632 s4): once the push route has
// answered a dossier (200 with its id), `later` (Next's after()) runs `judge` on it after the response is sent.
// A refusal, or an answer without an id, judges nothing. The answer itself is handed back untouched.

/** The dossier a push answered, or null when it was refused or names none. */
async function pushedId(answer: Response): Promise<string | null> {
  if (answer.status !== 200) return null;
  try {
    const body: unknown = await answer.clone().json();
    const id = typeof body === 'object' && body !== null && 'id' in body ? body.id : null;
    return typeof id === 'string' && id !== '' ? id : null;
  } catch {
    return null;
  }
}

/** `answer`, with `judge` of the dossier it pushed handed to `later`. */
export async function judgingAfter(answer: Response, later: (task: () => Promise<void>) => void, judge: (dossier: string) => Promise<void>): Promise<Response> {
  const id = await pushedId(answer);
  if (id !== null) later(() => judge(id));
  return answer;
}
