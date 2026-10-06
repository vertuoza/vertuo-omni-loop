import { describe, expect, it } from 'vitest';
import { boundaries } from './outbox.boundary';
import { WaitingDossierRow } from './outbox';

// The dossiers GET /api/waiting/outbox reads, parsed where they come in (PRD 1030).

const row = { id: 'd1', workspace_id: 'w-acme', home_repo: 'acme/widgets', prd: 1, title: 'PRD 1 title' };

describe('a waiting dossier, as the database answers it', () => {
  it('parses the row the read answers, an extra column left out', () => {
    expect(WaitingDossierRow.parse({ ...row, opened_by: 'me', created_at: '2026-09-01T00:01:00Z' })).toEqual(row);
    expect(WaitingDossierRow.parse({ ...row, prd: null })).toEqual({ ...row, prd: null });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(WaitingDossierRow.safeParse({ id: 'd1', workspace_id: 'w-acme', prd: 1, title: 'PRD 1 title' }).success).toBe(false);
    expect(WaitingDossierRow.safeParse({ ...row, prd: '1' }).success).toBe(false);
    expect(WaitingDossierRow.safeParse({ ...row, title: null }).success).toBe(false);
  });

  it('is registered for schemas:verify with the schema the route parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([['outbox-waiting: dossiers', WaitingDossierRow, 'rows']]);
  });
});
