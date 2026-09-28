import { whereQuestionsGo } from '../../../../src/ask/api';
import { askDeps } from '../../../../src/ask/api-live';
import { tokenDeps } from '../../../../src/ask/cli-code-live';

// GET /api/ask/workspace?repo=owner/name → {workspace, reason}: where the caller's questions for that
// repository land (src/ask/api.ts), looked up as the terminal sign-in looks it up (repo_workspace()
// through the service role, src/ask/cli-code-live.ts), since no signed-in role may call it.
export const maxDuration = 60;

export function GET(request: Request) {
  return whereQuestionsGo(request, { ...askDeps(), place: tokenDeps().place });
}
