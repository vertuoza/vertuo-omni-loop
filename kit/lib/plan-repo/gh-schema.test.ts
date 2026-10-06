// The gh answers a plan repository's readers check (PRD 725, s10): each schema takes a GitHub-shaped
// answer, extra fields and all, and refuses one missing what the readers use, naming the field.
import { describe, expect, it } from 'vitest';
import { firstIssue, GhCompareSchema, GhContentEntrySchema, GhRepositorySchema } from './gh-schema.ts';

const refusal = (result: { success: boolean; error?: unknown }) => firstIssue(result.error as never);

describe('the gh answer schemas', () => {
  it('read a repository by its default branch, letting every other field through', () => {
    expect(GhRepositorySchema.parse({ default_branch: 'main', private: true })).toEqual({ default_branch: 'main', private: true });
    expect(refusal(GhRepositorySchema.safeParse({ name: 'widgets' }))).toMatch(/^default_branch: /);
  });

  it('read a contents listing entry by its type, name and path', () => {
    const entry = { type: 'file', name: 'testing.md', path: 'docs/testing.md', sha: 'abc' };
    expect(GhContentEntrySchema.array().parse([entry])).toEqual([entry]);
    expect(refusal(GhContentEntrySchema.array().safeParse([{ type: 'file', name: 'testing.md' }]))).toMatch(/^0\.path: /);
  });

  it('read a compare by how far ahead it is and the files it changed', () => {
    const compare = { ahead_by: 2, files: [{ filename: 'b.md', previous_filename: 'a.md' }], status: 'ahead' };
    expect(GhCompareSchema.parse(compare)).toEqual(compare);
    expect(GhCompareSchema.parse({})).toEqual({});
    expect(refusal(GhCompareSchema.safeParse({ ahead_by: 1, files: [{ status: 'modified' }] }))).toMatch(/^files\.0\.filename: /);
  });
});
