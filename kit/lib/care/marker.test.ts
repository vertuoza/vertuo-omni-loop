// PRD 790, slice s1: the hidden marker every PR care reply ends with.
import { describe, expect, it } from 'vitest';
import { CARE_VERDICTS, careMarker, careReplyBody, readCareVerdict } from './marker.ts';

describe('the PR care marker', () => {
  it('knows exactly three verdicts', () => {
    expect(CARE_VERDICTS).toEqual(['fixed', 'pushed-back', 'asked']);
  });

  it.each(CARE_VERDICTS)('writes and reads back %s', (verdict) => {
    const body = careReplyBody('A reason.', verdict);
    expect(body.endsWith(`<!-- omni-care: ${verdict} -->`)).toBe(true);
    expect(body).toBe(`A reason.\n\n${careMarker(verdict)}`);
    expect(readCareVerdict(body)).toBe(verdict);
  });

  it('reads a comment without a marker as unhandled', () => {
    expect(readCareVerdict('Please rename this.')).toBeNull();
    expect(readCareVerdict('')).toBeNull();
    expect(readCareVerdict(undefined)).toBeNull();
  });

  it('reads an unknown verdict as unhandled', () => {
    expect(readCareVerdict('ok\n\n<!-- omni-care: ignored -->')).toBeNull();
  });

  it('reads the last marker when a body quotes an earlier one', () => {
    expect(readCareVerdict('> <!-- omni-care: fixed -->\n\nnow\n\n<!-- omni-care: asked -->')).toBe('asked');
  });

  it('refuses to write an unknown verdict or an empty reply', () => {
    expect(() => careReplyBody('x', 'maybe')).toThrow(/verdict/);
    expect(() => careReplyBody('   ', 'fixed')).toThrow(/empty/);
  });

  it('never writes a second marker when the text already ends with one', () => {
    const body = careReplyBody(`Done.\n\n${careMarker('fixed')}`, 'fixed');
    expect(body.match(/omni-care:/g)).toHaveLength(1);
  });
});
