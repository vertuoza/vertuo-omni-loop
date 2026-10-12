// The omni-loop App's installation token for Vercel's ignore step (PRD 1646): the App's JWT is signed
// with its key and verifies with the public half, the stdin lines are read strictly, and the token
// comes from the installation GitHub names, against a local stub of GitHub.
import { spawn } from 'node:child_process';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appJwt, installationToken, parseInput } from './vercel-github-token.ts';

const script = join(dirname(fileURLToPath(import.meta.url)), 'vercel-github-token.ts');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

function verifies(jwt: string): boolean {
  const [head, body, signature] = jwt.split('.');
  if (!head || !body || !signature) return false;
  return createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, Buffer.from(signature, 'base64url'));
}

let server: Server;
let api = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const json = (code: number, body: unknown) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    const jwt = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!verifies(jwt)) return json(401, {});
    if (req.url === '/repos/acme/widgets/installation') return json(200, { id: 99 });
    if (req.url === '/app/installations/99/access_tokens' && req.method === 'POST') return json(201, { token: 'ghs_token' });
    return json(404, {});
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  api = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : '';
});

afterAll(() => new Promise<void>((done) => server.close(() => { done(); })));

describe('the App\'s JWT', () => {
  it('is signed with the App\'s key, names the App, and lives under ten minutes', () => {
    const jwt = appJwt('7', PEM, 1_000_000);
    expect(verifies(jwt)).toBe(true);
    const claims: unknown = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString());
    expect(claims).toEqual({ iat: 999_940, exp: 1_000_540, iss: '7' });
  });

  it('takes a key pasted with literal \\n sequences', () => {
    expect(verifies(appJwt('7', PEM.replace(/\n/g, '\\n')))).toBe(true);
  });
});

describe('the stdin lines', () => {
  it('reads the App id, the repository, the API base and the key', () => {
    expect(parseInput(`7\nacme/widgets\nhttps://api.github.com/\n${PEM}`)).toEqual({ appId: '7', repo: 'acme/widgets', api: 'https://api.github.com', privateKey: PEM.trim() });
  });

  it('refuses a missing line or a repository not shaped <owner>/<repo>', () => {
    expect(parseInput('')).toBeNull();
    expect(parseInput(`7\nacme\nhttps://api.github.com\n${PEM}`)).toBeNull();
    expect(parseInput('7\nacme/widgets\nhttps://api.github.com\n')).toBeNull();
  });
});

describe('the installation token', () => {
  it('comes from the installation GitHub names for the repository', async () => {
    expect(await installationToken({ appId: '7', repo: 'acme/widgets', api, privateKey: PEM })).toEqual({ token: 'ghs_token' });
  });

  it('is refused for a key GitHub does not know, or a repository the App is not on', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    expect(await installationToken({ appId: '7', repo: 'acme/widgets', api, privateKey: other })).toHaveProperty('error');
    expect(await installationToken({ appId: '7', repo: 'acme/other', api, privateKey: PEM })).toHaveProperty('error');
  });

  it('prints the token on stdout from the command line, or one reason on stderr and exit 1', async () => {
    const run = (input: string) => new Promise<{ code: number | null; out: string; err: string }>((done) => {
      const child = spawn(process.execPath, [script]);
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
      child.on('close', (code) => { done({ code, out, err }); });
      child.stdin.end(input);
    });
    expect(await run(`7\nacme/widgets\n${api}\n${PEM}`)).toEqual({ code: 0, out: 'ghs_token\n', err: '' });
    const bad = await run('7\n');
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/^vercel-github-token: /);
  });
});
