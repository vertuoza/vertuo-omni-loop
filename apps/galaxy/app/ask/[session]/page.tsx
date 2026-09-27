import { AskRoute, type AskQuery } from '../../../src/ask/page/AskRoute';

// /ask/<session>: the person's page with that session's tab selected. The links PRD 71's
// `omni ask on` printed keep working; a closed session opens read-only as the last tab; another
// person's session is not found, exactly like one that never was (src/ask/page/AskRoute.tsx).

type Props = { params: Promise<{ session: string }>; searchParams: Promise<AskQuery> };

export default async function AskSessionPage({ params, searchParams }: Props) {
  const [{ session }, query] = await Promise.all([params, searchParams]);
  return <AskRoute id={session} query={query} />;
}
