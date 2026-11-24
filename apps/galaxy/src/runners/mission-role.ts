import type { MissionJobRole } from './runners.contract';

/** A TypeScript copy of `public.mission_job_role` (PRD 3233): the part a mission's job plays, from its key. A test holds it equal to the migration. */
export function missionJobRole(key: string): MissionJobRole {
  const step = key.replace(/:resume:([1-9]|10)$/, '');
  if (/:review:[12]$/.test(step)) return 'reviewer';
  if (/:qa:[12]$/.test(step)) return 'qa';
  if (/:approve:[0-9]+$/.test(step)) return 'architect';
  if (/:pm:[0-9]+$/.test(step)) return 'pm';
  if (/:run:[0-9]+$/.test(step) || /:fix:1$/.test(step) || /:qa-fix:1:[1-5]$/.test(step)) return 'engineer';
  return 'supervisor';
}
