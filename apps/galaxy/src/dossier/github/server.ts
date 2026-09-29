import 'server-only';
import { appCredentials } from '../../signup/github-app';
import { githubReader, type FixReader, type GithubReader } from './reader';

// The one GitHub reader of this server (PRD 426), so its token and its 60-second cache are shared by
// every request. It holds the App's existing GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, set for
// sign-up (PRD 359); without them, there is no reader, and every numbered dossier's stage is unknown.

let reader: (GithubReader & FixReader) | null | undefined;

export function dossierGithub(env: Record<string, string | undefined> = process.env): (GithubReader & FixReader) | null {
  if (reader !== undefined) return reader;
  try {
    reader = githubReader(appCredentials(env));
  } catch (error) {
    console.error(`PRD page: ${error instanceof Error ? error.message : String(error)}`);
    reader = null;
  }
  return reader;
}
