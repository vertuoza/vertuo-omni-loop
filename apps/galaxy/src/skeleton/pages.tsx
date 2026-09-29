import { BoardSkeleton, DossierSkeleton, FiltersSkeleton, HeroSkeleton, ListSkeleton, TilesSkeleton, TitleSkeleton } from './Skeleton';

// What each route under /app and /prd draws while its page starts (PRD 657 s4), through its
// loading.tsx: inside the layout's frame (the sidebar and the top bar, sent at once), the page's
// skeleton, in the page's own column, so nothing moves when the page arrives.

/** /app: the hero, Waiting for you, then the board. */
export function HomeLoading() {
  return (
    <div className="dash">
      <HeroSkeleton />
      <TilesSkeleton what="Waiting for you" count={1} />
      <BoardSkeleton />
    </div>
  );
}

/** A board page (/app/workspace, /app/fleet, /app/engineering…): its heading, then the board. */
export function BoardLoading() {
  return (
    <div className="dash">
      <TitleSkeleton />
      <BoardSkeleton />
    </div>
  );
}

/** A settings list (/app/settings/…): its heading, then its rows. */
export function ListLoading({ what }: { what: string }) {
  return (
    <div className="dash">
      <TitleSkeleton />
      <ListSkeleton what={what} rows={4} />
    </div>
  );
}

/** /prd: its heading, drawn as the page draws it, then the filters and the rows. */
export function PrdListLoading() {
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">PRDs</h1>
      <FiltersSkeleton />
      <ListSkeleton />
    </div>
  );
}

/** /prd/<id>: the header box, then the pane. */
export function DossierLoading() {
  return <DossierSkeleton />;
}
