import './RepoRef.css';
import { Link } from './Link.tsx';
import type { REPO_REF_VARIANTS } from './RepoRef.meta.ts';

export type RepoRefProps = {
  owner: string;
  name: string;
  /** Where it opens; GitHub's page of the repository when omitted. */
  href?: string;
  variant?: (typeof REPO_REF_VARIANTS)[number];
};

/** A repository named in text: "owner/name" as one link, to GitHub unless told otherwise. */
export function RepoRef({ owner, name, href, variant = 'default' }: RepoRefProps) {
  return (
    <span className="omni-repo-ref">
      {href === undefined
        ? <Link href={`https://github.com/${owner}/${name}`} variant={variant} external>{`${owner}/${name}`}</Link>
        : <Link href={href} variant={variant}>{`${owner}/${name}`}</Link>}
    </span>
  );
}
