import { dossierRoute, type DossierRouteProps } from '../../../src/dossier/page/DossierRoute';

// /visual/<id> (PRD 627): one visual fix's page, the PRD page's own (src/dossier/page/DossierRoute.tsx). Another
// kind's id is sent to its own route.

export default function VisualFixRoute(props: DossierRouteProps) {
  return dossierRoute('visual', props);
}
