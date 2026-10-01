import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { countSentences, parseVoice, VOICE_FILE } from './voice.ts';

/** The example voice.json every reader of the shape tests against (the PRD 822 plan's shared ground). */
/** A voice.json fixture, read and edited loosely. */
type Fixture = any;

const EXAMPLE_VOICE: Fixture = JSON.parse(readFileSync(new URL('./example.json', import.meta.url), 'utf8'));

const clone = (value: unknown): Fixture => JSON.parse(JSON.stringify(value));
const text = (value: unknown) => JSON.stringify(value, null, 2);

/** The example, changed by `edit`, as the text of a voice.json. */
function edited(edit: (voice: Fixture) => void) {
  const voice = clone(EXAMPLE_VOICE);
  edit(voice);
  return text(voice);
}

describe('parseVoice', () => {
  it('names its file voice.json', () => {
    expect(VOICE_FILE).toBe('voice.json');
  });

  it('accepts a valid file, every stage and every settlement', () => {
    const parsed = parseVoice(text(EXAMPLE_VOICE));
    expect(parsed).toEqual({ ok: true, voice: EXAMPLE_VOICE, errors: [] });
    expect(EXAMPLE_VOICE.rounds.map((r: Fixture) => r.stage)).toEqual(['design', 'spec', 'rework-1', 'shipped']);
  });

  it('accepts a round without an objection and without a fit line', () => {
    const parsed = parseVoice(edited((v) => { v.rounds[1].objection = null; v.rounds[1].fit = null; }));
    expect(parsed.ok).toBe(true);
  });

  it('refuses text that is not JSON, or not an object with rounds', () => {
    expect(parseVoice('{ nope').errors).toEqual(['not valid JSON.']);
    expect(parseVoice('[]').errors).toEqual(['must be an object with a `rounds` list.']);
    expect(parseVoice('{"rounds": []}').errors).toEqual(['`rounds` holds no round.']);
    expect(parseVoice('{"rounds": [], "extra": 1}').errors).toContain('`extra` is not a field of voice.json.');
  });

  it('refuses a score out of range, naming the round and the field', () => {
    const high = parseVoice(edited((v) => { v.rounds[0].personas[1].score = 6; }));
    expect(high.ok).toBe(false);
    expect(high.errors).toEqual(['round design: personas[1].score must be a whole number from 1 to 5.']);
    expect(parseVoice(edited((v) => { v.rounds[0].personas[0].score = 0; })).ok).toBe(false);
    expect(parseVoice(edited((v) => { v.rounds[0].personas[0].score = 2.5; })).ok).toBe(false);
  });

  it('refuses a round without personas', () => {
    const parsed = parseVoice(edited((v) => { v.rounds[1].personas = []; }));
    expect(parsed.errors).toEqual(['round spec: personas must list at least one persona.']);
  });

  it('refuses an unknown stage, and a stage twice', () => {
    expect(parseVoice(edited((v) => { v.rounds[0].stage = 'review'; })).errors).toEqual([
      'round 1: stage "review" is not one of design, spec, rework-<k>, shipped.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[2].stage = 'rework-0'; })).ok).toBe(false);
    expect(parseVoice(edited((v) => { v.rounds[1].stage = 'design'; })).errors).toEqual(['round design: the stage comes twice.']);
  });

  it('refuses a reaction over two sentences', () => {
    const parsed = parseVoice(edited((v) => { v.rounds[0].personas[0].reaction = 'One. Two! Three?'; }));
    expect(parsed.errors).toEqual(['round design: personas[0].reaction holds 3 sentences; two at most.']);
  });

  it('refuses a reaction without a citation, and a citation that is no persona or claim id', () => {
    expect(parseVoice(edited((v) => { v.rounds[0].personas[0].citations = []; })).errors).toEqual([
      'round design: personas[0].citations must cite at least one persona:<name> or claim id.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[0].personas[0].citations = ['Marc']; })).errors).toEqual([
      'round design: personas[0].citations[0] "Marc" is neither persona:<name> nor a claim id like size#2.',
    ]);
  });

  it('refuses a bad stance, date, objection and settlement', () => {
    expect(parseVoice(edited((v) => { v.rounds[0].personas[0].stance = 'angry'; })).errors).toEqual([
      'round design: personas[0].stance must be one of excited, neutral, skeptical.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[0].date = '30/09/2026'; })).errors).toEqual([
      'round design: date must be YYYY-MM-DD.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[0].objection.settled = 'ignored'; })).errors).toEqual([
      'round design: objection.settled must be one of accepted, saved-as-claim, just-this-run, none.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[0].objection.citations = []; })).errors).toEqual([
      'round design: objection.citations must cite at least one persona:<name> or claim id.',
    ]);
    expect(parseVoice(edited((v) => { v.rounds[0].objection.text = 'A. B. C.'; })).ok).toBe(false);
    expect(parseVoice(edited((v) => { v.rounds[0].objection.persona = 'Zoe'; })).errors).toEqual([
      'round design: objection.persona "Zoe" is not one of the round\'s personas.',
    ]);
  });
});

describe('countSentences', () => {
  it('counts sentences by their ending, not by abbreviations inside numbers', () => {
    expect(countSentences('One sentence.')).toBe(1);
    expect(countSentences('One. Two!')).toBe(2);
    expect(countSentences('No ending at all')).toBe(1);
    expect(countSentences('Scores 3.5 of 5. Then more.')).toBe(2);
    expect(countSentences('Really?! Yes.')).toBe(2);
  });
});
