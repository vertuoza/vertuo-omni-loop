import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../src/dossier/attestation/attestation.css';
import { attestationScreenOf, LIVE_ATTESTATION } from '../../../../src/dossier/attestation/attestation.controller';
import { AttestationScreenView } from '../../../../src/dossier/attestation/AttestationPage';

// /prd/<id>/attestation?head=<sha> (PRD 1612 s4): the omni/approved check's Details, a ◆ PRD's approval
// in force read against the head the check ran on (src/dossier/attestation/). Rendered per request, as
// the signed-in person, so row-level security decides; not found in the PRD page's own words.

export const metadata: Metadata = { title: 'Attestation · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AttestationRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const screen = await attestationScreenOf(id, query, LIVE_ATTESTATION);
  if (screen.kind === 'not-found') notFound();
  return <AttestationScreenView screen={screen} />;
}
