// The Concepts list's fixtures (PRD 1272, s2): concept #1269 as /omni:think-big recorded it, its
// sections cut short, its six areas kept, and the rows dossier_list() returns for a concept and for the
// other kinds.
import type { IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ConceptRow } from './list';

/** Concept #1269's concept.md, its sections shortened: six areas, none with a PRD yet. */
export const CONCEPT_1269 = `---
concept: 1269
title: Products replace plan repositories, with phase 0 approved on the server
kind: platform
scale: vast
---

## The brief

One product holds its repositories, and phase 0 is approved on the server.

## The vision

A product page holds everything.

## Why this one

It removes the plan repository.

## Killed and why

Keeping plan repositories.

## Fuel

The loop today.

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| server-approval | Phase 0 approved on the server | Approval pins the hashes. | |
| approval-handshake | The handshake | omni wait approval. | |
| product-home | Products hold everything | Products own their repositories. | |
| product-gate | One gate, no plan PR | One omni/approved check. | |
| product-records | Roadmaps, bugs and knowledge move in | The plan repository is archived. | |
| constellation-tab | How the product is looking | The read-only map tab. | |
`;

/** A concept's row of dossier_list(), recorded at `at`, its latest concept.md version `record`. */
export function conceptRow(id: string, issue: IssueNumber, at: string, record: string | null = `v-${id}`): ConceptRow {
  return {
    id, workspace_id: 'w-1', kind: 'concept', prd: issue, title: issue === 1269 ? 'Products replace plan repositories, with phase 0 approved on the server' : `Concept ${issue}`,
    created_at: at, latest: record === null ? {} : { 'concept-record': { id: record } },
  };
}

/** A row of another kind, as dossier_list() returns it. */
export function listed(id: string, kind: 'prd' | 'bug' | 'visual') {
  return {
    id, workspace_id: 'w-1', home_repo: 'acme/widgets', prd: 7, kind, title: `A ${kind}`, opened_by: null, created_at: '2026-10-01T09:00:00Z',
    numbered_at: '2026-10-01T09:00:00Z', repos: ['acme/widgets'], latest: {}, asked: 0, answered: 0, last_activity: '2026-10-01T09:00:00Z',
  };
}
