import 'server-only';
import type { Metadata } from 'next';
import { cache } from 'react';
import { BoardPage } from '../../../../src/ideas/Board';
import { boardPath } from '../../../../src/ideas/model';
import { ideasView, type IdeasView } from '../../../../src/ideas/source';
import { readBoard } from '../../../../src/ideas/store';
import { IDEAS } from '../../../../src/ideas/words';
import { supabaseServer } from '../../../../src/data/supabase-server';
import { siteUrl } from '../../../../src/seo/seo';
import { serverEnv } from '../../../../src/env';

// /ideas/<owner>/<repo> (PRD 1246, s1): a repository's ideas board, for anyone. Rendered on the server
// per request with the public key, as whoever reads it (their session, when they have one), so
// ideas_board() decides: a public board for anyone, a private one for its workspace's members only,
// and for anyone else the same "no public board here" page a missing repository gets. The metadata
// carries the board's title, so a shared link has its title and preview. Its words: src/ideas/words.ts.

type Params = { params: Promise<{ owner: string; repo: string }> };

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

export default async function IdeasRoute({ params }: Params) {
  const { owner, repo } = await params;
  return <BoardPage view={await view(owner, repo)} />;
}
