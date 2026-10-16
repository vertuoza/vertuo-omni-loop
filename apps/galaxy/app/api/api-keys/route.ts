import { deleteApiKey, postApiKey } from '../../../src/public-api/keys/api-keys.controller';
import { apiKeysDeps } from '../../../src/public-api/keys/api-keys.live';

// POST /api/api-keys {workspace, name, repos} → 201 {secret, key}: an owner makes an API key, its secret
// shown this once. DELETE /api/api-keys {workspace, key} → 200 {key}: an owner revokes one. Settings ›
// API keys (src/public-api/keys/api-keys.controller.ts, PRD 2022 s1).
export const maxDuration = 30;

export function POST(request: Request) {
  return postApiKey(request, apiKeysDeps());
}

export function DELETE(request: Request) {
  return deleteApiKey(request, apiKeysDeps());
}
