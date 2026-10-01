import { describe, expect, it } from 'vitest';
import { DossierRowSchema } from './dossier.ts';

describe('DossierRowSchema', () => {
  it('reads a dossier and its versions, none when the row embeds none', () => {
    const version = { id: 'v1', kind: 'spec', git_blob: null, bytes: 12 };
    expect(DossierRowSchema.parse({ id: 'd1', prd: 7, title: 'Typed', dossier_versions: [version] }).dossier_versions).toEqual([version]);
    expect(DossierRowSchema.parse({ id: 'd1', prd: 7, title: 'Typed' }).dossier_versions).toEqual([]);
  });

  it('refuses a version of an unknown kind, naming its field', () => {
    const parsed = DossierRowSchema.safeParse({ id: 'd1', prd: 7, title: 'T', dossier_versions: [{ id: 'v1', kind: 'deck', git_blob: null, bytes: 1 }] });
    expect(parsed.error?.issues[0]?.path).toEqual(['dossier_versions', 0, 'kind']);
  });

  it('refuses a prd that is not a positive number, naming it', () => {
    expect(DossierRowSchema.safeParse({ id: 'd1', prd: 0, title: 'T' }).error?.issues[0]?.path).toEqual(['prd']);
  });
});
