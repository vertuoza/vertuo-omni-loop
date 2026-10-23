import { deleteGithubApp, postGithubApp } from '../../../../../src/public-api/keys/api-keys.controller';
import { apiKeysDeps } from '../../../../../src/public-api/keys/api-keys.live';

// POST /api/api-keys/<id>/github-app {appId, privateKey} → 200 {slug}: an owner attaches a GitHub App to a
// key, or replaces the one it holds; the pair is checked with GitHub and the private key sealed, never
// answered. DELETE /api/api-keys/<id>/github-app → 200 {removed}: an owner removes it. Settings › API keys
// (src/public-api/keys/api-keys.controller.ts, PRD 2433 s4).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return postGithubApp(request, (await params).id, apiKeysDeps());
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteGithubApp((await params).id, apiKeysDeps());
}
