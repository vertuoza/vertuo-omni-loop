import { BoardSkeleton, DossierSkeleton, FiltersSkeleton, HeadCardSkeleton, HeroSkeleton, ListSkeleton, SectionCardSkeleton, TilesSkeleton, TitleSkeleton } from './Skeleton';

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

/** A list page (/app/inbox, /app/products…): its heading, then its rows. */
export function ListLoading({ what }: { what: string }) {
  return (
    <div className="dash">
      <TitleSkeleton />
      <ListSkeleton what={what} rows={4} />
    </div>
  );
}

/** Business: the head card (the sentence), the claims, then Connect an agent and the agents' questions. */
export function BusinessLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton lines={2} />
      <ListSkeleton what="the claims" rows={4} />
      <SectionCardSkeleton what="your agent links" />
      <ListSkeleton what="the agents’ questions" rows={2} />
    </div>
  );
}

/** Fleets: the head card with its button, then the active fleets. */
export function FleetsLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton />
      <ListSkeleton what="the fleets" rows={3} />
    </div>
  );
}

/** API keys: the head card, then the keys. */
export function ApiKeysLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton />
      <ListSkeleton what="the API keys" rows={2} />
    </div>
  );
}

/** Playbook: the head card (the settings repository), then one card per page. */
export function PlaybookLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton lines={2} />
      <SectionCardSkeleton what="the playbook pages" lines={3} />
      <SectionCardSkeleton what="the playbook pages" lines={3} />
    </div>
  );
}

/** Repositories: the head card, then the repositories. */
export function RepositoriesLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton />
      <ListSkeleton what="the repositories" rows={3} />
    </div>
  );
}

/** Jev: the head card, the key card, then the decisions. */
export function JevLoading() {
  return (
    <div className="dash">
      <HeadCardSkeleton />
      <SectionCardSkeleton what="the Jev key" lines={2} />
      <SectionCardSkeleton what="the Jev decisions" lines={4} />
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
