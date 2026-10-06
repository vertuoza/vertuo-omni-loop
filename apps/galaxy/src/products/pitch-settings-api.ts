// A product's Pitch settings read for the kit (PRD 1108 s1), as plain functions of a Request, so they are
// tested with a stubbed Supabase client and each route stays one line:
//
//   GET /api/pitch-settings?repo=<owner/name>   → 200 {settings}   the whole settings, filled
//   GET /api/pitch-look?repo=<owner/name>       → 200 {look}       arcade | keynote (PRD 859's alias)
//
// The kit (`/omni:pitch`) calls them with the terminal's sign-in. The database's
// pitch_settings_for_repo() (supabase/migrations/20261107090000_pitch_settings.sql), run as the caller,
// answers the stored settings of the repository's product, `{}` for a repository with no product; they
// are filled from their look's preset and the defaults by kit/lib/pitch/settings.ts. The alias answers
// the preset the look was filled from, which is what PRD 859's kits read as the look. Refusals follow
// ADR-0029, each `{error}` in plain words: 400 a malformed repository, 401 no valid bearer token, 403 a
// repository outside the caller's workspaces (the database's reason, and the App's install link after
// its install hint), 503 no database here, 500 the database failed or stored settings out of shape.
import type { SupabaseClient } from '@supabase/supabase-js';
import { parsePitchSettings, presetOf, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';

/** A Supabase client acting as one access token: the Auth server's check and the functions. */
export type PitchSettingsClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type PitchSettingsDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => PitchSettingsClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const REPO = /^[\w.-]+\/[\w.-]+$/;

const isRepo = (repo: string) => repo.length <= 200 && REPO.test(repo);

/** What a read is called in its refusals and its log lines. */
type Named = { label: string; noun: string; absent: string };

const SETTINGS: Named = { label: 'pitch-settings', noun: 'The Pitch settings', absent: 'The Pitch settings are not available here' };
const LOOK: Named = { label: 'pitch-look', noun: 'The pitch look', absent: 'The pitch look is not available here' };

const notRead = ({ noun }: Named) => refuse(500, `${noun} could not be read. Try again.`);

/** The database's refusal of a call, as the route answers it. */
function refusalOf(error: { code?: string; message?: string }, named: Named, installLink: string | null | undefined): Response {
  const { code, message } = error;
  if (code === '42501') return refuse(403, withInstallLink(message || 'Not a member of the workspace that owns this repository.', installLink));
  if (code === '22023') return refuse(400, message || '`repo` must be the repository as owner/name.');
  console.error(`${named.label}: ${message || code || 'the database failed'}`);
  return notRead(named);
}

/** The caller's access token and the repository the request names, or the Response that refuses them. */
async function callerAndRepo(request: Request, connect: (token: string) => TokenCheck): Promise<{ token: string; repo: string } | Response> {
  const auth = await authenticate(request.headers.get('authorization'), connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const repo = new URL(request.url).searchParams.get('repo') ?? '';
  return isRepo(repo) ? { token: auth.caller.token, repo } : refuse(400, '`repo` must be the repository as owner/name.');
}

/** The settings of the request's repository's product, filled, or the Response that refuses it. */
async function settingsFor(request: Request, deps: PitchSettingsDeps, named: Named): Promise<PitchSettings | Response> {
  if (!deps.connect) return refuse(503, `${named.absent}: this deployment has no database.`);
  const asked = await callerAndRepo(request, deps.connect);
  if (asked instanceof Response) return asked;
  const { token, repo } = asked;
  const answer = await deps.connect(token).rpc('pitch_settings_for_repo', { p_repo: repo });
  if (answer.error) return refusalOf(answer.error, named, deps.installLink);
  const parsed = parsePitchSettings(answer.data);
  if (!parsed.ok) {
    console.error(`${named.label}: stored settings out of shape for ${repo}: ${parsed.errors.join('; ')}`);
    return notRead(named);
  }
  return parsed.settings;
}

export async function readPitchSettings(request: Request, deps: PitchSettingsDeps): Promise<Response> {
  const settings = await settingsFor(request, deps, SETTINGS);
  return settings instanceof Response ? settings : reply(200, { settings });
}

/** PRD 859's read, kept as an alias: the preset the product's look was filled from. */
export async function readPitchLook(request: Request, deps: PitchSettingsDeps): Promise<Response> {
  const settings = await settingsFor(request, deps, LOOK);
  return settings instanceof Response ? settings : reply(200, { look: presetOf(settings) });
}
