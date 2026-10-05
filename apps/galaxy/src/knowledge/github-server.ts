import 'server-only';
import { serverEnv, type GithubAppEnv } from '../env';
import { appCredentials } from '../signup/github-app';
import { knowledgeReader, type KnowledgeReader } from './github';

// The one knowledge reader of this server, so its tokens and caches are shared by every request. It
// holds the App's GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, set for sign-up (PRD 359); without them
// there is no reader, and the knowledge map offers only the checkout it is deployed from.

let reader: KnowledgeReader | null | undefined;

export function knowledgeGithub(app: GithubAppEnv | null = serverEnv().githubApp): KnowledgeReader | null {
  if (reader !== undefined) return reader;
  try {
    reader = knowledgeReader(appCredentials(app));
  } catch (error) {
    console.error(`knowledge map: only this deployment's repository is offered — ${error instanceof Error ? error.message : String(error)}`);
    reader = null;
  }
  return reader;
}
