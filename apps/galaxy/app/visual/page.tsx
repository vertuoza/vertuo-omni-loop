import type { Metadata } from 'next';
import { fixListRoute } from '../../src/fixes/FixListRoute';

// /visual (PRD 627): every visual fix of the signed-in person's workspaces (src/fixes/FixListRoute.tsx).

export const metadata: Metadata = { title: 'Visual Updates · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function VisualFixesRoute({ searchParams }: Props) {
  return fixListRoute('visual', searchParams);
}
