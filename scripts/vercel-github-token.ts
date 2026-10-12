// A GitHub token for Vercel's ignore step (PRD 1646), minted from the omni-loop GitHub App's
// credentials, which both Vercel projects already hold (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY): no
// token of a person to keep. It signs the App's JWT, finds the App's installation on the repository,
// and prints an installation token (an hour long), which can read the repository's check runs.
//
// It runs in the ignore step, before any install: Node built-ins only. It reads, on stdin, the App id
// on the first line, `<owner>/<repo>` on the second, the API base on the third, and the private key
// on the rest (a key pasted with literal `\n` sequences is accepted). It prints the token and exits 0,
// or prints one `vercel-github-token: <why>` line on stderr and exits 1. Each call is limited to 5 s.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base64url = (text: string | Buffer): string => Buffer.from(text).toString('base64url');

/** The App's JWT: RS256, issued a minute back for clock drift, valid nine minutes. */
export function appJwt(appId: string, privateKey: string, now: number = Math.floor(Date.now() / 1000)): string {
  const head = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey.replace(/\\n/g, '\n'));
  return `${head}.${body}.${base64url(signature)}`;
}

export interface Input {
  appId: string;
  repo: string;
  api: string;
  privateKey: string;
}

/** The stdin lines, or null when one is missing. */
export function parseInput(text: string): Input | null {
  const [appId = '', repo = '', api = '', ...key] = text.split('\n');
  const privateKey = key.join('\n').trim();
  if (!appId.trim() || !/^[^/\s]+\/[^/\s]+$/.test(repo.trim()) || !api.trim() || !privateKey) return null;
  return { appId: appId.trim(), repo: repo.trim(), api: api.trim().replace(/\/$/, ''), privateKey };
}

async function field(response: Response, name: string): Promise<string | null> {
  if (!response.ok) return null;
  const json: unknown = await response.json();
  if (!json || typeof json !== 'object' || !(name in json)) return null;
  const value: unknown = Reflect.get(json, name);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** The installation token, or the reason there is none. */
export async function installationToken(input: Input): Promise<{ token: string } | { error: string }> {
  const headers = { Authorization: `Bearer ${appJwt(input.appId, input.privateKey)}`, Accept: 'application/vnd.github+json' };
  const signal = (): AbortSignal => AbortSignal.timeout(5000);
  try {
    const id = await field(await fetch(`${input.api}/repos/${input.repo}/installation`, { headers, signal: signal() }), 'id');
    if (!id) return { error: `the App is not installed on ${input.repo}, or its key was refused` };
    const token = await field(
      await fetch(`${input.api}/app/installations/${id}/access_tokens`, { method: 'POST', headers, signal: signal() }),
      'token',
    );
    return token ? { token } : { error: `installation ${id} gave no token` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let text = '';
  try {
    text = readFileSync(0, 'utf8');
  } catch {
    text = '';
  }
  const input = parseInput(text);
  if (!input) {
    process.stderr.write('vercel-github-token: needs the App id, <owner>/<repo>, the API base and the private key on stdin\n');
    process.exit(1);
  }
  let result: { token: string } | { error: string };
  try {
    result = await installationToken(input);
  } catch (error) {
    result = { error: error instanceof Error ? error.message : String(error) };
  }
  if ('token' in result) {
    console.log(result.token);
    process.exit(0);
  }
  process.stderr.write(`vercel-github-token: ${result.error}\n`);
  process.exit(1);
}
