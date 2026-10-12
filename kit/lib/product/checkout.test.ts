// The product a checkout remembers (PRD 1548, s11): `.omni-loop/local/product.json`, written by
// `omni product use <key>` and read by `omni product which`, a key refused by the same rule a product
// PRD id keys by, and the phase-0 line `/omni:mega-brainstorm --product` refuses a target with.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductKey, phase0Line, PRODUCT_FILE, rememberedProduct, rememberProduct } from './checkout.ts';

const NOW = new Date('2026-10-11T09:30:12Z');
const root = () => mkdtempSync(join(tmpdir(), 'product-checkout-'));

describe('isProductKey', () => {
  it('takes a lowercase kebab-case key of at most 40 characters, each part starting with a letter', () => {
    for (const key of ['mobile', 'vertuo-mobile', 'a1-b2', 'a'.repeat(40)]) expect(isProductKey(key), key).toBe(true);
  });

  it('refuses anything a product PRD id could not start with', () => {
    for (const key of ['', 'Mobile', 'mobile-12', '12', 'mobile-', '-mobile', 'mo bile', 'mobile_app', 'a'.repeat(41), 'mobile--app']) {
      expect(isProductKey(key), key).toBe(false);
    }
  });
});

describe('rememberProduct and rememberedProduct', () => {
  it('reads null before anything is remembered', () => {
    expect(rememberedProduct(root())).toBeNull();
  });

  it('keeps the key and when, under the local folder with its .gitignore, and reads it back', () => {
    const dir = root();
    rememberProduct(dir, 'mobile', NOW);
    expect(PRODUCT_FILE).toBe(join('.omni-loop', 'local', 'product.json'));
    expect(JSON.parse(readFileSync(join(dir, PRODUCT_FILE), 'utf8'))).toEqual({ key: 'mobile', usedAt: '2026-10-11T09:30:12.000Z' });
    expect(readFileSync(join(dir, '.omni-loop', 'local', '.gitignore'), 'utf8')).toBe('*\n');
    expect(rememberedProduct(dir)).toEqual({ key: 'mobile', usedAt: '2026-10-11T09:30:12.000Z' });
  });

  it('replaces the product a second use names', () => {
    const dir = root();
    rememberProduct(dir, 'mobile', NOW);
    rememberProduct(dir, 'estimates', new Date('2026-10-12T00:00:00Z'));
    expect(rememberedProduct(dir)).toEqual({ key: 'estimates', usedAt: '2026-10-12T00:00:00.000Z' });
  });

  it('refuses to remember a key that is not one', () => {
    const dir = root();
    expect(() => rememberProduct(dir, 'Mobile', NOW)).toThrow('not a product key: Mobile (lowercase kebab-case, as mobile)');
    expect(rememberedProduct(dir)).toBeNull();
  });

  it('reads a file that is half-written, of another shape or holding no key as nothing remembered', () => {
    for (const body of ['{', '[]', '{"key":"Mobile","usedAt":"2026-10-11T09:30:12.000Z"}', '{"key":"mobile"}', '{"usedAt":"2026-10-11T09:30:12.000Z"}']) {
      const dir = root();
      mkdirSync(join(dir, '.omni-loop', 'local'), { recursive: true });
      writeFileSync(join(dir, PRODUCT_FILE), body);
      expect(rememberedProduct(dir), body).toBeNull();
    }
  });
});

describe('phase0Line', () => {
  it('passes a target on server', () => {
    expect(phase0Line('acme/api', { flag: 'server', why: null })).toEqual({ ok: true, line: 'acme/api is phase0: server' });
  });

  it("refuses a target on pr with acceptance 10's line", () => {
    expect(phase0Line('acme/app', { flag: 'pr', why: null })).toEqual({
      ok: false,
      line: 'acme/app is phase0: pr · switch it to server on its Omni page, or leave it out',
    });
  });

  it('holds a target whose flag could not be read, saying why, never calling it pr', () => {
    expect(phase0Line('acme/app', { flag: 'pr', why: 'unreachable' })).toEqual({
      ok: false,
      line: 'acme/app: its phase0 could not be read: unreachable',
    });
  });
});
