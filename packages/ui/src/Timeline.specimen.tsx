import { Timeline } from './Timeline.tsx';
import { TIMELINE_DENSITIES, TIMELINE_STATES } from './Timeline.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Timeline at each density; for `state`, every step in that state. */
export const timelineSpecimen: Specimen = (prop, value) => {
  const state = prop === 'state' ? one(TIMELINE_STATES, value) : undefined;
  const step = (id: string, title: string, time: string, own: 'done' | 'current' | 'pending') => ({
    id,
    title,
    time,
    detail: 'The spec is approved.',
    state: state ?? own,
  });
  return (
    <Timeline
      items={[step('spec', 'Spec approved', 'Nov 16', 'done'), step('plan', 'Plan written', 'Nov 17', 'current'), step('build', 'Built', 'Nov 18', 'pending')]}
      {...(prop === 'density' ? { density: one(TIMELINE_DENSITIES, value) } : {})}
    />
  );
};
