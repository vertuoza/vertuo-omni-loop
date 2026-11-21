'use client';
import { useEffect } from 'react';
import { anchorPath } from './view';

// The PRD page's old anchors (omni-loop-20 s7): a link to `/prd/<id>#approve` (the approve screen that sat
// under the head, the attestation's Ask again) reaches the review screen while a decision waits on the
// viewer, else the Approval record; `#approval` and `#attestation` (the omni/approved check's Details) reach
// the Specifications tab's Approval record when the page shown does not hold them. A fragment never reaches
// the server, so the browser reads it here, once, and renders nothing.

type Props = { review: string | null; record: string };

export function SpecificationsTabAnchors({ review, record }: Props) {
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    const to = anchorPath(window.location.hash, { review, record, here, onPage: (id) => document.getElementById(id) !== null });
    if (to !== null) window.location.replace(to);
  }, [review, record]);
  return null;
}
