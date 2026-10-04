import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// The secret box (PRD 812, decision 7): a workspace's TypeSafe API key, sealed by Galaxy's server
// before it is stored (public.workspace_secrets) and opened only to call Jev. AES-256-GCM under the
// deployment's master key, SECRETS_MASTER_KEY (32 bytes, base64), with a fresh 12-byte iv per seal;
// the ciphertext carries its 16-byte tag at its end. Only the key's last four characters are kept in
// the clear, for the page. Without a master key (or with one that is not 32 bytes) nothing is sealed
// and the page says Jev is not available on this deployment. Losing the master key makes every stored
// key unreadable: each call then fails, and today's path decides (decision 6).

export const MASTER_KEY_VAR = 'SECRETS_MASTER_KEY';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** A sealed secret as stored: base64 ciphertext (tag last) and iv, and the last four in the clear. */
export interface Sealed {
  ciphertext: string;
  iv: string;
  lastFour: string;
}

/** A secret that could not be sealed or opened: a wrong master key, a changed ciphertext or iv. */
export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

/** The master key from the environment (`SECRETS_MASTER_KEY`, ../env.ts), or null when it is unset or not 32 bytes of base64. */
export function masterKey(raw: string | null): Buffer | null {
  if (!raw) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

/** The last four characters of a secret, all a person is ever shown of it again. */
export const lastFour = (secret: string): string => secret.trim().slice(-4);

function checked(master: Buffer): Buffer {
  if (master.length !== KEY_BYTES) throw new SecretBoxError(`${MASTER_KEY_VAR} must be ${KEY_BYTES} bytes.`);
  return master;
}

export function sealSecret(secret: string, master: Buffer): Sealed {
  const plain = secret.trim();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, checked(master), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: body.toString('base64'), iv: iv.toString('base64'), lastFour: lastFour(plain) };
}

export function openSecret(sealed: Pick<Sealed, 'ciphertext' | 'iv'>, master: Buffer): string {
  const body = Buffer.from(sealed.ciphertext, 'base64');
  const iv = Buffer.from(sealed.iv, 'base64');
  if (body.length <= TAG_BYTES || iv.length !== IV_BYTES) throw new SecretBoxError('The stored secret is malformed.');
  try {
    const decipher = createDecipheriv(ALGORITHM, checked(master), iv);
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString('utf8');
  } catch (err) {
    if (err instanceof SecretBoxError) throw err;
    throw new SecretBoxError('The stored secret could not be opened with this master key.');
  }
}
