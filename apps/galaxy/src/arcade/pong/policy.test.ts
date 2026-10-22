import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PULSAR VOLLEY asks for the microphone on /play (PRD 2101): a `Permissions-Policy` header that leaves the
// microphone out would turn every ask into MIC BLOCKED IN THE BROWSER. Neither of the two places the
// app's headers are set sends one that blocks it.

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Whether a header's text blocks the microphone: `microphone=()`, `microphone=(none)` or the old `microphone 'none'`. */
const blocksMic = (text: string): boolean => /microphone\s*=\s*\(\s*(?:none\s*)?\)|microphone\s+'none'/i.test(text);

describe('the microphone policy of /play', () => {
  it.each(['../../../next.config.ts', '../../../vercel.json'])('%s sends no Permissions-Policy that blocks the microphone', (path) => {
    const text = read(path);
    expect(blocksMic(text)).toBe(false);
    if (/permissions-policy/i.test(text)) expect(text).toMatch(/microphone\s*=\s*\(\s*self/i);
  });

  it('tells a policy that blocks the microphone from one that does not', () => {
    expect(blocksMic('Permissions-Policy: camera=(), microphone=()')).toBe(true);
    expect(blocksMic("Feature-Policy: microphone 'none'")).toBe(true);
    expect(blocksMic('Permissions-Policy: microphone=(self)')).toBe(false);
  });
});
