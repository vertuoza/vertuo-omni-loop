import { Skeleton } from './Skeleton.tsx';
import { SKELETON_SHAPES } from './Skeleton.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Skeleton in each shape (the shot stills its shimmer). */
export const skeletonSpecimen: Specimen = (_prop, value) => (
  <Skeleton shape={one(SKELETON_SHAPES, value)} label="Loading the plan" lines={3} />
);
