import { readRepositorySkills } from '../../../../src/repositories/skills-api';
import { skillsDeps } from '../../../../src/repositories/skills-live';

// GET /api/repositories/skills?repo=<owner/name> → 200 {skills, branch, error}: a repository's own skills
// on its default branch, read live, each allowed on a runner or not, for Settings → Repositories
// (src/repositories/skills-api.ts, PRD 2313).
export const maxDuration = 60;

export function GET(request: Request) {
  return readRepositorySkills(request, skillsDeps());
}
