// A refused call's own words: the `error` its route answered, else `fallback`. Shared by the buttons that post
// to the approval routes (./ApproveButton.tsx, ./RequestTechApproval.tsx).

export async function refusalOf(answer: Response, fallback: string): Promise<string> {
  const body: unknown = await answer.json().catch(() => null);
  return typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : fallback;
}
