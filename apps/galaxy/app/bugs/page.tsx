import type { Metadata } from 'next';
import { fixListRoute } from '../../src/fixes/FixListRoute';

// /bugs (PRD 627): every bug fix of the signed-in person's workspaces (src/fixes/FixListRoute.tsx).

export const metadata: Metadata = { title: 'Bug Fixes · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function BugFixesRoute({ searchParams }: Props) {
  return fixListRoute('bug', searchParams);
}
