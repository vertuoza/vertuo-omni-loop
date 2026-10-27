import { DECISIONS_FORM } from 'omni-loop/kit/lib/playbook/forms.ts';

// "Write it for this repository" (PRD 2419 s3): a page that reads a level other than the repository's
// links to GitHub's new-file page on the repository's own path for that page, which proposes the file
// as a pull request. Pure.

const PLAYBOOK = '.omni-loop/knowledge/playbook';
const ADR_README = '.omni-loop/knowledge/adr/README.md';

/** The path the repository's own page `form` has: the decisions page beside the records, the rest in the playbook. */
const ownPagePath = (form: string): string => (form === DECISIONS_FORM ? ADR_README : `${PLAYBOOK}/${form}.md`);

/** The link that opens the edit of page `form` in `repository`, as a pull request. */
export const writeForRepositoryHref = (repository: string, form: string): string =>
  `https://github.com/${repository}/new/HEAD?filename=${encodeURIComponent(ownPagePath(form))}`;
