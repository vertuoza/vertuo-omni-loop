import { dossierRoute, type DossierRouteProps } from '../../../src/dossier/page/DossierRoute';

// /bugs/<id> (PRD 627): one bug fix's page, the PRD page's own (src/dossier/page/DossierRoute.tsx). Another
// kind's id is sent to its own route.

export default function BugFixRoute(props: DossierRouteProps) {
  return dossierRoute('bug', props);
}
