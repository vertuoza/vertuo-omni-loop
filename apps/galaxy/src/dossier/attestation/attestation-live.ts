import 'server-only';
import { serverEnv } from '../../env';
import { appCredentials } from '../../signup/github-app';
import { githubStore } from '../github/server';
import { attestationGithub, type AttestationGithub } from './attestation-github';
import { attestationRepository, type AttestationDb } from './attestation.repository';
import type { AttestationPorts } from './attestation.service';

// The Attestation page's real reads (PRD 1612 s4): the record on the member's own client, and GitHub as
// the omni-loop App (GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY), one reader per server so its tokens are
// kept, its calls spending the installation's budget through the shared client and its store. Without
// the App, there is no reader: each pinned file reads `?`, held.

let reader: AttestationGithub | null | undefined;

function liveGithub(): AttestationGithub | null {
  if (reader !== undefined) return reader;
  try {
    reader = attestationGithub({ creds: appCredentials(serverEnv().githubApp), store: githubStore() });
  } catch (error) {
    console.error(`Attestation: ${error instanceof Error ? error.message : String(error)}`);
    reader = null;
  }
  return reader;
}

/** The page's reads, as the member whose client `db` is. */
export function livePorts(db: AttestationDb): AttestationPorts {
  return { facts: (id) => attestationRepository(db).facts(id), github: liveGithub() };
}
