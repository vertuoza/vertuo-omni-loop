import { RepoRef } from './RepoRef.tsx';
import { REPO_REF_VARIANTS } from './RepoRef.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A RepoRef in each variant. */
export const repoRefSpecimen: Specimen = (_prop, value) => <RepoRef owner="vertuoza" name="vertuo-omni-loop" variant={one(REPO_REF_VARIANTS, value)} />;
