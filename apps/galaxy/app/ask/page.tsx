import { AskRoute, type AskQuery } from '../../src/ask/page/AskRoute';

// /ask: the person's page, the link `omni ask on` prints. Every open ask session they own is a tab,
// one per terminal, and the page opens on the first one (src/ask/page/AskRoute.tsx).

export default async function AskHome({ searchParams }: { searchParams: Promise<AskQuery> }) {
  return <AskRoute id={null} query={await searchParams} />;
}
