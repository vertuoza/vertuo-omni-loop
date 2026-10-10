import 'server-only';
import type { Metadata } from 'next';
import { cache } from 'react';
import '../../../../src/product-filter/product-filter.css';
import { BoardPage } from '../../../../src/ideas/Board';
import { boardPath } from '../../../../src/ideas/model';
import { ideasView, type IdeasView } from '../../../../src/ideas/source';
import { readBoard } from '../../../../src/ideas/store';
import { IDEAS } from '../../../../src/ideas/words';
import { supabaseServer } from '../../../../src/data/supabase-server';
import { siteUrl } from '../../../../src/seo/seo';
import { serverEnv } from '../../../../src/env';
import { productBoardScope } from '../../../../src/product-filter/ProductFilter';

// /ideas/<owner>/<repo> (PRD 1246, s1): a repository's ideas board, for anyone. Rendered on the server
// per request with the public key, as whoever reads it (their session, when they have one), so
// ideas_board() decides: a public board for anyone, a private one for its workspace's members only,
// and for anyone else the same "no public board here" page a missing repository gets. The metadata
// carries the board's title, so a shared link has its title and preview. Its words: src/ideas/words.ts.
// PRD 1364 s12: a member of the board's workspace filters it by product, `product=<id>` or `product=none`,
// read from ideas.product_id as them (src/product-filter/); a visitor sees no filter and the whole board.

type Params = { params: Promise<{ owner: string; repo: string }> };
type Props = Params & { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/** One read per request, shared by the metadata and the page. */
const view = cache(async (owner: string, repo: string): Promise<IdeasView> =>
  ideasView(serverEnv(), owner, repo, async (fullName) => readBoard(await supabaseServer(), fullName)));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, repo } = await params;
  const shown = await view(owner, repo);
  if (shown.kind !== 'board') return { title: IDEAS.none.title, robots: { index: false } };
  const url = siteUrl(boardPath(shown.board.repo));
  const title = IDEAS.title(shown.board.repo);
  const description = IDEAS.description(shown.board.repo);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: 'Omni Loop', title, description },
    ...(shown.board.public ? {} : { robots: { index: false } }),
  };
}

export default async function IdeasRoute({ params, searchParams }: Props) {
  const { owner, repo } = await params;
  const shown = await view(owner, repo);
  if (serverEnv().mode !== 'supabase' || shown.kind !== 'board' || !shown.board.member) return <BoardPage view={shown} />;
  const scoped = await productBoardScope(await supabaseServer(), shown, (await searchParams) ?? {}, boardPath(shown.board.repo));
  return <>{scoped.above}<BoardPage view={scoped.view} /></>;
}
