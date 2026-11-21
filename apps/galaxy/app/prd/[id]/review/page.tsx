import { reviewRoute, type ReviewRouteProps } from '../../../../src/dossier/review/ReviewRoute';

// /prd/<id>/review, the review screen (PRD omni-loop-20 s5): the one signed decision that waits on the viewer
// (src/dossier/review/ReviewRoute.tsx), then back to /prd/<id>.

export default function ReviewRoute(props: ReviewRouteProps) {
  return reviewRoute(props);
}
