// The kit's release number (PRD #347): patch numbers only, from `v0.0.1`. The next version is the
// highest `v0.0.<n>` tag plus one; a tag of any other shape (`v1.2`, `release-3`, `v0.1.0`) is
// ignored, so no major or minor bump is ever computed. Pure: the tags come in as strings.

const RELEASE_TAG = /^v0\.0\.(0|[1-9]\d*)$/;
const RELEASE_SUBJECT = /^chore\(release\): v\d+\.\d+\.\d+$/;

/**
 * The version the next release takes, without its `v`.
 * `tags` is every tag of the repository, one per entry.
 */
export function nextVersion(tags: readonly string[]): string {
  let highest = 0;
  for (const tag of tags) {
    const match = RELEASE_TAG.exec(tag.trim());
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `0.0.${highest + 1}`;
}

/** Whether a commit subject is the one a release commits: `chore(release): v0.0.N`. */
export function isReleaseSubject(subject: unknown): boolean {
  return RELEASE_SUBJECT.test(String(subject).trim());
}
