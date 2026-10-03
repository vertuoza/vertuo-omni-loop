import { describe, expect, it } from 'vitest';
import { boundaries } from './documents.boundary';
import { DocumentRead } from './documents';

// The versions the New documents part reads, parsed where they come in (PRD 1030).

const row = { id: 'v1', kind: 'spec', created_at: '2026-10-03T10:00:00+00:00', dossier: { id: 'd1', prd: 7, title: 'Widgets' } };

describe('a new document, as the database answers it', () => {
  it('parses the row the read answers, its dossier\'s opener left out', () => {
    expect(DocumentRead.parse({ ...row, dossier: { ...row.dossier, opened_by: 'me-1' } })).toEqual(row);
    expect(DocumentRead.parse({ ...row, kind: 'retro', dossier: null })).toEqual({ ...row, kind: 'retro', dossier: null });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    const { created_at: _gone, ...missing } = row;
    expect(DocumentRead.safeParse(missing).success).toBe(false);
    expect(DocumentRead.safeParse({ ...row, dossier: { ...row.dossier, prd: '7' } }).success).toBe(false);
    expect(DocumentRead.safeParse({ ...row, kind: null }).success).toBe(false);
  });

  it('is registered for schemas:verify with the schema the reader parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([['waiting/documents: dossier_versions', DocumentRead, 'rows']]);
  });
});
