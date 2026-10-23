import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { SettingsPlaybookSchema } from './omni-settings.contract';
import type { OmniSettingsService } from './omni-settings.service';

// The Omni settings HTTP edge for the kit (PRD 2417, s3; ADR-0095), as a plain function of a Request,
// so it is tested with a fake GitHub behind the real service and the route stays one line:
//
//   GET /api/omni-settings/playbook?repo=<owner/name>   → 200 SettingsPlaybook
//
// `omni sync` calls it with the terminal's sign-in (a bearer token). The sign-in is checked first:
// signed out, 401, and nothing is read. The reads then run as the caller's access token, never a
// service key, and GitHub is read as the Omni app. The reply is checked against the kit's own schema
// before it leaves. Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed query,
// 401 no valid bearer token, 403 a repository outside the caller's workspaces, 503 no database here or
// the sign-in service down, 500 anything failed. A workspace with no settings repository, or one with
// no files, is a 200 with an empty list and its reason.

type CallerClient = TokenCheck & { service: OmniSettingsService };

export type OmniSettingsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  /** The App's install link, put after a refusal's install hint; null or missing: none. */
  installLink?: string | null;
  log: (line: string) => void;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;
const NO_DATABASE = 'The settings playbook is not available here: this deployment has no database.';
const BAD_QUERY = 'Name the repository as `repo=owner/name`.';
const NOT_READ = 'The settings playbook could not be read. Try again.';

/** The `?repo=` of a request when it is an owner/name, else null. */
function repoOf(request: Request): string | null {
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  return repo.length <= 200 && REPO.test(repo) ? repo : null;
}

export async function readSettingsPlaybook(request: Request, deps: OmniSettingsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = repoOf(request);
  if (repo === null) return refuse(400, BAD_QUERY);
  try {
    const read = await deps.connect(auth.caller.token).service.playbook(repo);
    if (!read.ok) return refuse(403, withInstallLink(`No workspace of yours lists ${repo}: install the Omni App`, deps.installLink));
    return reply(200, SettingsPlaybookSchema.parse(read.playbook));
  } catch (error) {
    deps.log(`omni settings: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, NOT_READ);
  }
}
