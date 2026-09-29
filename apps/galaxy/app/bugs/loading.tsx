import { FixListLoading } from '../../src/fixes/FixListRoute';

// /bugs's skeleton, while the page starts (PRD 691 s3), as /prd's (PRD 657 s4): inside the layout's
// frame, sent at once, the list's heading, filters and rows drawn with src/skeleton/.

export default function Loading() {
  return <FixListLoading kind="bug" />;
}
