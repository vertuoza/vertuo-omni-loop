// The Product key card's words and rules (PRD 2784 s1), pure. The key starts each of the product's PRD ids
// (mobile-12) and names its MCP address; product_set_key() is the judge, the checks here only help.

export const KEY_TITLE = 'Product key';
export const KEY_ANCHOR = 'product-key';
export const SET_ONCE = 'Set once.';
export const SET_ONCE_NEVER = 'Set once. It never changes.';
export const SHAPE_RULE = 'Lowercase words joined by -, 40 at most.';
export const NO_KEY_YET = 'No key yet.';
export const AN_OWNER_SETS_IT = 'An owner sets it.';
export const NO_KEY = 'No key.';
export const NEVER_CHANGES = 'It never changes.';
const ONLY_AN_OWNER = 'Only an owner sets it.';

const MAX_LENGTH = 40;
const SHAPE = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;

/** The key's shape, as the database's products_key_shape check. */
export const keyShapeOk = (key: string): boolean => key.length <= MAX_LENGTH && SHAPE.test(key);

/** The key suggested from a product's name; empty when nothing is left. */
export function suggestKey(name: string): string {
  const parts = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.replace(/^[0-9]+/, ''))
    .filter((part) => part !== '');
  let key = '';
  for (const part of parts) {
    const next = key === '' ? part : `${key}-${part}`;
    if (next.length > MAX_LENGTH) break;
    key = next;
  }
  return key === '' && parts.length > 0 ? (parts[0] ?? '').slice(0, MAX_LENGTH) : key;
}

/** What the card draws and reads from the product's Settings read. */
export interface ProductKeyData {
  name: string;
  key: string | null;
  owner: boolean;
  archived: boolean;
}

export type KeyState =
  | { kind: 'owner-field' }
  | { kind: 'owner-confirm' }
  | { kind: 'member' }
  | { kind: 'archived' }
  | { kind: 'set'; key: string };

/** Which of the card's five states applies. */
export function keyCardFrom(data: Pick<ProductKeyData, 'key' | 'owner' | 'archived'>, confirming: boolean): KeyState {
  if (data.key !== null) return { kind: 'set', key: data.key };
  if (data.archived) return { kind: 'archived' };
  if (!data.owner) return { kind: 'member' };
  return { kind: confirming ? 'owner-confirm' : 'owner-field' };
}

export const confirmLine = (key: string): string => `Set the key to ${key}?`;
export const prdLine = (key: string): string => `PRDs: ${key}-1, ${key}-2…`;
export const mcpLine = (key: string): string => `MCP: /api/products/${key}/mcp`;
const takenLine = (key: string): string => `Another product has ${key}.`;

export type KeyRefusal = 'taken' | 'shape' | 'refused';

/** The one short line a refusal reads as. */
export const refusalLine = (refusal: KeyRefusal, key: string): string =>
  refusal === 'taken' ? takenLine(key) : refusal === 'shape' ? SHAPE_RULE : ONLY_AN_OWNER;
