// PRD #324, slices s1 and s5: Claude Code's status line JSON, read with every field optional.
import { describe, expect, it } from 'vitest';
import { parseInput } from './input.ts';

const RESETS_AT = Date.parse('2026-09-28T13:30:00Z');

/** A payload shaped as Claude Code sends it to a status line command. */
const FULL = {
  hook_event_name: 'Status',
  session_id: 'abc-123',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: '/work/repo/kit',
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  workspace: { current_dir: '/work/repo/kit', project_dir: '/work/repo' },
  version: '2.3.0',
  context_window: { used_percentage: 58.9, remaining_percentage: 41.1 },
  rate_limits: { five_hour: { used_percentage: 25.4, resets_at: RESETS_AT / 1000 } },
};

const EMPTY = { model: null, contextPercent: null, fiveHour: null, currentDir: null, projectDir: null, sessionId: null };

describe('parseInput', () => {
  it('reads a full payload', () => {
    expect(parseInput(JSON.stringify(FULL))).toEqual({
      model: 'Opus 5.5',
      contextPercent: 58.9,
      fiveHour: { percent: 25.4, resetsAt: RESETS_AT },
      currentDir: '/work/repo/kit',
      projectDir: '/work/repo',
      sessionId: 'abc-123',
    });
  });

  it('reads a payload with every optional field missing', () => {
    expect(parseInput('{}')).toEqual(EMPTY);
    expect(parseInput(JSON.stringify({ model: {}, workspace: {}, context_window: {}, rate_limits: {} }))).toEqual(EMPTY);
  });

  it('reads a null used_percentage as no percentage', () => {
    expect(parseInput(JSON.stringify({ ...FULL, context_window: { used_percentage: null } }))?.contextPercent).toBeNull();
  });

  it('reads a field of the wrong type as missing', () => {
    const odd = {
      model: { display_name: 42 },
      context_window: { used_percentage: '58' },
      rate_limits: { five_hour: { used_percentage: -3, resets_at: RESETS_AT / 1000 } },
      workspace: { current_dir: '', project_dir: ['x'] },
      session_id: 7,
    };
    expect(parseInput(JSON.stringify(odd))).toEqual(EMPTY);
  });

  it('reads the session id as sent, whatever its characters: the record reader decides what is safe', () => {
    expect(parseInput(JSON.stringify({ session_id: '../abc' }))?.sessionId).toBe('../abc');
    expect(parseInput(JSON.stringify({ session_id: '' }))?.sessionId).toBeNull();
  });

  it('falls back to cwd when workspace.current_dir is missing', () => {
    expect(parseInput(JSON.stringify({ cwd: '/work/repo' }))?.currentDir).toBe('/work/repo');
  });

  it('reads resets_at as Unix seconds, or as a date', () => {
    const at = (resets_at: unknown) => parseInput(JSON.stringify({ rate_limits: { five_hour: { used_percentage: 10, resets_at } } }))?.fiveHour;
    expect(at(RESETS_AT / 1000)).toEqual({ percent: 10, resetsAt: RESETS_AT });
    expect(at('2026-09-28T13:30:00Z')).toEqual({ percent: 10, resetsAt: RESETS_AT });
    expect(at('soon')).toBeNull();
    expect(at(null)).toBeNull();
  });

  it('has no five-hour window without its percentage', () => {
    expect(parseInput(JSON.stringify({ rate_limits: { five_hour: { resets_at: RESETS_AT / 1000 } } }))?.fiveHour).toBeNull();
    expect(parseInput(JSON.stringify({ rate_limits: { seven_day: { used_percentage: 5, resets_at: 1 } } }))?.fiveHour).toBeNull();
  });

  it.each(['', 'not json at all', '{"model":', 'null', '42', '"text"', '[]', '[{}]'])('reads %j as unreadable', (text) => {
    expect(parseInput(text)).toBeNull();
  });

  it('reads anything that is not text as unreadable', () => {
    expect(parseInput(undefined)).toBeNull();
    expect(parseInput(null)).toBeNull();
  });
});
