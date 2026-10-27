import { describe, expect, it } from 'vitest';
import { writeForRepositoryHref } from './write-for-repository';

// "Write it for this repository" (PRD 2419 s3): the link that opens a page's edit in the repository as
// a pull request, GitHub's new-file page on the repository's own path for that page.

describe('writeForRepositoryHref', () => {
  it('opens the repository’s own playbook file for a page', () => {
    expect(writeForRepositoryHref('widgets/api', 'ci')).toBe(
      'https://github.com/widgets/api/new/HEAD?filename=.omni-loop%2Fknowledge%2Fplaybook%2Fci.md',
    );
  });

  it('opens the decisions page beside the records, not in the playbook folder', () => {
    expect(writeForRepositoryHref('widgets/api', 'decisions')).toBe(
      'https://github.com/widgets/api/new/HEAD?filename=.omni-loop%2Fknowledge%2Fadr%2FREADME.md',
    );
  });
});
