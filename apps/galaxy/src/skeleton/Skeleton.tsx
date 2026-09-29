import type { CSSProperties, ReactNode } from 'react';
import './skeleton.css';

// The skeletons of the app's pages (PRD 657 s4): what the server sends at once, in a block's place and
// of its size, while the block streams in (./Streamed.tsx), and what each route's loading.tsx draws
// while its page starts. Each is busy for assistive technology and says what is loading, in words a
// screen reader reads; the bones themselves are hidden from it. A skeleton borrows the box of the block
// it stands for, so the page does not shift when the block arrives.

type BoneProps = { className?: string; width?: string };

/** One grey block. */
export function Bone({ className = 'skel-line', width }: BoneProps) {
  const style: CSSProperties | undefined = width ? { width } : undefined;
  return <span className={`skel-bone ${className}`} style={style} aria-hidden="true" />;
}

/** A busy region that names what is loading. */
export function Skeleton({ what, className, children }: { what: string; className?: string; children: ReactNode }) {
  return (
    <div className={['skel', className].filter(Boolean).join(' ')} aria-busy="true">
      <span className="ask-sr">{`Loading ${what}…`}</span>
      {children}
    </div>
  );
}

/** A tile: a label and a figure, in a board tile's box. */
function TileBones() {
  return (
    <>
      <Bone width="60%" />
      <Bone className="skel-figure" />
    </>
  );
}

/** The hero block of /app: the hero, then the name, the fleet and the points. */
export function HeroSkeleton() {
  return (
    <Skeleton what="your hero" className="skel-row">
      <Bone className="skel-hero" />
      <span className="skel">
        <Bone className="skel-title" />
        <Bone width="8em" />
        <Bone width="12em" />
      </span>
    </Skeleton>
  );
}

/** A row of `count` tiles, as Waiting for you and a board's tiles lay them out. */
export function TilesSkeleton({ what, count }: { what: string; count: number }) {
  return (
    <Skeleton what={what}>
      <ul className="skel-tiles">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="skel-box"><TileBones /></li>
        ))}
      </ul>
    </Skeleton>
  );
}

/** A board: the period switch, four tiles, the two charts, then a table of `rows` rows. */
export function BoardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Skeleton what="the board" className="board">
      <Bone width="14em" />
      <ul className="skel-tiles">
        {Array.from({ length: 4 }, (_, i) => <li key={i} className="skel-box"><TileBones /></li>)}
      </ul>
      <div className="skel-charts">
        <Bone className="skel-chart" />
        <Bone className="skel-chart" />
      </div>
      <div className="skel">
        <Bone width="8em" />
        {Array.from({ length: rows }, (_, i) => <Bone key={i} />)}
      </div>
    </Skeleton>
  );
}

/** A page title, as `.dash-name` or `.dossier-title` draws it. */
export function TitleSkeleton() {
  return <Bone className="skel-title" />;
}

/** The PRD list's rows: `rows` boxes of a title line and a facts line. */
export function ListSkeleton({ what = 'the PRDs', rows = 6 }: { what?: string; rows?: number }) {
  return (
    <Skeleton what={what}>
      <ul className="skel-list">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="skel-box">
            <Bone width="70%" />
            <Bone width="40%" />
          </li>
        ))}
      </ul>
    </Skeleton>
  );
}

/** The filters above the PRD list: the Mine / All switch, then the search and its picks. */
export function FiltersSkeleton() {
  return (
    <Skeleton what="the filters">
      <Bone width="8em" />
      <span className="skel-box">
        <Bone width="100%" />
        <Bone width="50%" />
      </span>
    </Skeleton>
  );
}

/** A PRD's page: the header box (title, facts, tabs), then its pane. */
export function DossierSkeleton() {
  return (
    <Skeleton what="the PRD" className="dossier">
      <span className="skel-box">
        <Bone className="skel-title" width="60%" />
        <Bone width="80%" />
        <Bone width="50%" />
      </span>
      <span className="skel">
        <Bone />
        <Bone />
        <Bone width="90%" />
        <Bone width="75%" />
      </span>
    </Skeleton>
  );
}
