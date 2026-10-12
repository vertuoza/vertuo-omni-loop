import { redirect } from 'next/navigation';

// /prd/<id>/attestation (PRD 1612 s4, folded into PRD 1548): no page of its own any more. omni/approved's
// Details opens the PRD page itself: a ◆ PRD's approval in force at `#approval` (the seal card,
// src/dossier/page/DossierPage.tsx), a product PRD's attestation at `#attestation`
// (src/dossier/page/Attestation.tsx). A link a check posted before, always a ◆ PRD's, still lands on its
// approval; the `?head=` it carried is dropped, since the check's own summary says which head it read.

type Props = { params: Promise<{ id: string }> };

export default async function AttestationRoute({ params }: Props): Promise<never> {
  const { id } = await params;
  redirect(`/prd/${encodeURIComponent(id)}#approval`);
}
