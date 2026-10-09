import { describe, expect, it } from 'vitest';
import { scanText } from './guard.ts';

const SECRET = ['s3cr', 'etvalue', '99'].join('');

describe('scanText', () => {
  it.each([
    [`password = "${SECRET}"`, 'password, token or key'],
    [`"apiKey": "${SECRET}"`, 'password, token or key'],
    [`TOKEN: ${SECRET}`, 'password, token or key'],
    [`https://user:${SECRET}@host.example/x`, 'url with a password'],
    [`eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(10)}`, 'JSON web token'],
  ])('flags %#', (line, kind) => {
    expect(scanText('f.ts', line)).toEqual([{ file: 'f.ts', line: 1, kind }]);
  });

  it.each([
    'const password = process.env.QA_PASSWORD;',
    'password = "<your password>"',
    "await page.fill('#password', value);",
    'the token is kept in the saved session',
    'password: ${QA_PASSWORD}',
  ])('lets %s through', (line) => {
    expect(scanText('f.ts', line)).toEqual([]);
  });

  it('numbers lines from 1 and never carries the value', () => {
    const found = scanText('f.ts', `ok\npassword = "${SECRET}"`);
    expect(found).toEqual([{ file: 'f.ts', line: 2, kind: 'password, token or key' }]);
    expect(JSON.stringify(found)).not.toContain(SECRET);
  });
});
