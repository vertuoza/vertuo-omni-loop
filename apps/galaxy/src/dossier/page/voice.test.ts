import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readVoice, reworkCommand, voiceView, type VoiceCast } from './voice';

// The User voice tab's reading (PRD 822, s3): a voice.json version as galaxy's own schema reads it, then
// one row per persona and one column per round, each score with its move from the round before, each
// round's objection with how it was settled. The file's shape is the kit's example (kit/lib/voice/).

const EXAMPLE = readFileSync(fileURLToPath(new URL('../../../../../kit/lib/voice/example.json', import.meta.url)), 'utf8');
const AVATAR = { v: 1 as const, skin: 2, hair: 1, hairColor: 1, outfit: 2, accessory: 1 };
const CAST: VoiceCast[] = [{ name: 'Marc', trade: 'plumber', avatar: AVATAR }];

const persona = (name: string, score: number, reaction = `${name} says ${score}.`) => ({
  name, stance: 'neutral', score, reaction, citations: [`persona:${name}`],
});
const round = (stage: string, personas: unknown[], more: Record<string, unknown> = {}) => ({
  stage, date: '2026-09-30', personas, objection: null, fit: null, ...more,
});
const file = (...rounds: unknown[]) => JSON.stringify({ rounds });

describe('reading a voice.json version', () => {
  it('reads the kit\'s example', () => {
    const voice = readVoice(EXAMPLE);
    expect(voice?.rounds.map((r) => r.stage)).toEqual(['design', 'spec', 'rework-1', 'shipped']);
  });

  it('reads nothing from text that is not a voice record', () => {
    expect(readVoice('not json')).toBeNull();
    expect(readVoice('{}')).toBeNull();
    expect(readVoice(file(round('later', [persona('Marc', 3)])))).toBeNull();
    expect(readVoice(file(round('design', [persona('Marc', 6)])))).toBeNull();
  });
});

describe('the User voice tab\'s view', () => {
  it('has one column per round, in the file\'s order, named for a person', () => {
    const view = voiceView(readVoice(EXAMPLE)!, CAST);
    expect(view.rounds.map((r) => r.label)).toEqual(['Design', 'Spec', 'Rework 1', 'Shipped']);
    expect(view.rounds[0]!.date).toBe('30 Sep');
  });

  it('has one row per persona, with the latest stance and reaction, and the portrait when the cast has them', () => {
    const view = voiceView(readVoice(EXAMPLE)!, CAST);
    expect(view.rows.map((r) => r.name)).toEqual(['Marc', 'Sofia']);
    expect(view.rows[0]).toMatchObject({ stance: 'neutral', latest: 'It shipped as promised.', portrait: { trade: 'plumber', avatar: AVATAR } });
    expect(view.rows[1]!.portrait).toBeNull();
    expect(view.rows[1]!.initial).toBe('S');
  });

  it('shows one round\'s scores with no move', () => {
    const view = voiceView(readVoice(file(round('design', [persona('Marc', 3)])))!, []);
    expect(view.rows[0]!.cells).toEqual([expect.objectContaining({ score: '3/5', move: null, from: null, reaction: 'Marc says 3.' })]);
  });

  it('moves each score from the round before: ▲ up, ▼ down, = the same', () => {
    const voice = readVoice(file(
      round('design', [persona('Marc', 3), persona('Sofia', 4), persona('Els', 5)]),
      round('spec', [persona('Marc', 5), persona('Sofia', 3), persona('Els', 5)]),
      round('rework-1', [persona('Marc', 4), persona('Sofia', 3), persona('Els', 5)]),
    ))!;
    const cells = (name: string) => voiceView(voice, []).rows.find((r) => r.name === name)!.cells.map((c) => [c.score, c.move]);
    expect(cells('Marc')).toEqual([['3/5', null], ['5/5', '▲'], ['4/5', '▼']]);
    expect(cells('Sofia')).toEqual([['4/5', null], ['3/5', '▼'], ['3/5', '=']]);
    expect(cells('Els')).toEqual([['5/5', null], ['5/5', '='], ['5/5', '=']]);
    const moved = voiceView(voice, []).rows[0]!.cells[1];
    expect(moved!.from).toBe('3/5');
    expect(moved!.words).toBe('3/5 → 5/5 ▲');
  });

  it('leaves a round a persona sat out empty, and moves from the last score it gave', () => {
    const voice = readVoice(file(
      round('design', [persona('Marc', 3), persona('Sofia', 4)]),
      round('spec', [persona('Sofia', 4)]),
      round('shipped', [persona('Marc', 5), persona('Sofia', 4)]),
    ))!;
    const marc = voiceView(voice, []).rows[0];
    expect(marc!.cells.map((c) => c.score)).toEqual(['3/5', null, '5/5']);
    expect(marc!.cells[2]).toMatchObject({ from: '3/5', move: '▲' });
  });

  it('outlines each round\'s objection with how it was settled, and says so when nobody objected', () => {
    const view = voiceView(readVoice(EXAMPLE)!, CAST);
    expect(view.rounds.map((r) => r.objection?.settled)).toEqual([
      'Accepted: the PRD changed', 'Saved as a claim', 'Overruled for this run', 'Not settled yet',
    ]);
    expect(view.rounds[0]!.objection).toMatchObject({ persona: 'Marc', citations: ['persona:Marc', 'size#2'] });
    expect(view.rounds[0]!.fit).toBe('fits persona:Marc ✗ · persona:Sofia ✓ · size#2 ✗');
    const quiet = voiceView(readVoice(file(round('design', [persona('Marc', 5)])))!, []);
    expect(quiet.rounds[0]!.objection).toBeNull();
    expect(quiet.rounds[0]!.fit).toBeNull();
  });

  it('marks the cell of the persona who objected in that round', () => {
    const view = voiceView(readVoice(EXAMPLE)!, CAST);
    expect(view.rows[0]!.cells.map((c) => c.objected)).toEqual([true, false, true, true]);
    expect(view.rows[1]!.cells.map((c) => c.objected)).toEqual([false, true, false, false]);
  });
});

describe('Rework with this feedback', () => {
  it('copies the brainstorm\'s rework of the PRD', () => {
    expect(reworkCommand(822)).toBe('/omni:brainstorm --rework 822');
  });
});
