import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { MAX_PAGE_CHARS, PlaybookEditSchema, PlaybookProposedSchema, SettingsPlaybookSchema, type PlaybookEdit } from './omni-settings.contract';
import type { OmniSettingsEditService, OmniSettingsService, Proposal } from './omni-settings.service';

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

// A workspace owner's change to a page (PRD 2417, s7), from Settings → Playbook:
//
//   POST /api/omni-settings/proposal {workspace, form, text}   → 200 {repository, pullRequest}
//
// The page calls it with the signed-in person's own session (their cookie), never a service key, so
// `is_owner()` decides who may; the pull request is opened as the Omni app. Nothing is stored on the
// Omni page (Never 6): the answer is the pull request's number and link, and the text lives only in it.
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 signed out, 403 a
// caller who does not own the workspace (or has no GitHub login for the pull request to name), 409 no
// pull request can open (no settings repository, the App not installed or unable to reach it, the text
// already there), 422 a text the next sync would skip, 502 GitHub refused a step, 503 no database here.

/** The signed-in caller, as the proposal needs them: their GitHub login and the edit service as them. */
type Proposer = { login: string | null; service: Pick<OmniSettingsEditService, 'propose'> };

export type PlaybookProposalDeps = {
  /** The caller's own session; null when nobody is signed in. Null itself: this deployment has no database. */
  session: (() => Promise<Proposer | null>) | null;
  /** The App's install link, put after a refusal's install hint; null or missing: none. */
  installLink?: string | null;
  log: (line: string) => void;
};

const NO_EDIT_DATABASE = 'Changing the playbook is not available here: this deployment has no database.';
/** The most bytes a change's body may hold: a page's most characters, with room for the JSON around it. */
const MAX_BODY_BYTES = MAX_PAGE_CHARS * 4 + 1024;
const BAD_BODY = 'Send {"workspace", "form", "text"}: the workspace, the page\'s form and its whole new text.';
const ONLY_OWNER = 'Only an owner of the workspace can change its playbook.';
const NO_LOGIN = 'Sign in with GitHub to propose a change: the pull request names you.';
const NOT_OPENED = 'GitHub did not open the pull request. Try again in a moment.';

/** The change a POST carries, or null when it is not one. */
async function editOf(request: Request): Promise<PlaybookEdit | null> {
  const text = await request.text().catch(() => '');
  if (text === '' || new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = PlaybookEditSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The refusal of a proposal that opened no pull request. */
function refusalOf(proposal: Exclude<Proposal, { ok: true }>, form: string, installLink: string | null | undefined): Response {
  switch (proposal.kind) {
    case 'not-owner':
      return refuse(403, ONLY_OWNER);
    case 'not-a-page':
      return refuse(422, `This text is not a ${form} page the kit reads: ${proposal.reason}.`);
    case 'no-settings-repository':
      return refuse(409, 'This workspace has no settings repository: name a plan repository for it first.');
    case 'not-installed':
      return refuse(409, withInstallLink(`The Omni app is not installed where ${proposal.repository} lives: install the Omni App`, installLink));
    case 'unreachable':
      return refuse(409, `The Omni app cannot reach ${proposal.repository}.`);
    case 'unchanged':
      return refuse(409, `${proposal.repository} already holds this text: there is nothing to propose.`);
  }
}

export async function proposePlaybookPage(request: Request, deps: PlaybookProposalDeps): Promise<Response> {
  if (!deps.session) return refuse(503, NO_EDIT_DATABASE);
  const caller = await deps.session();
  if (!caller) return refuse(401, 'Sign in first to change the playbook.');
  const edit = await editOf(request);
  if (edit === null) return refuse(400, BAD_BODY);
  if (caller.login === null) return refuse(403, NO_LOGIN);
  let proposal: Proposal;
  try {
    proposal = await caller.service.propose(edit, caller.login);
  } catch (error) {
    deps.log(`omni settings: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(502, NOT_OPENED);
  }
  if (!proposal.ok) return refusalOf(proposal, edit.form, deps.installLink);
  return reply(200, PlaybookProposedSchema.parse({ repository: proposal.repository, pullRequest: proposal.pullRequest }));
}
