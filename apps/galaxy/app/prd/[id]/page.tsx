import { dossierRoute, type DossierRouteProps } from '../../../src/dossier/page/DossierRoute';

// /prd/<id>, the page to share (PRD 216): one PRD's dossier (src/dossier/page/DossierRoute.tsx). A fix's
// id is sent to its own route (PRD 627).

export default function DossierRoute(props: DossierRouteProps) {
  return dossierRoute('prd', props);
}
