// The arcade's music, written as text. A song is a few voices of note strings, one token per
// sixteenth: a note (`C5`, `F#4`, `Bb1`) starts, `-` holds it, `.` rests. Drums use `k` (kick),
// `s` (snare), `h` (hat) and `c` (crash). Pure: sound.ts turns the parsed notes into Web Audio.
// All of it is original, written for OMNI LOOP in an SNES style: two pulse leads, a triangle bass,
// noise drums, and a shared echo added by the engine.
import { defined, group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

export type Voice = 'lead' | 'harm' | 'bass' | 'drums';
export interface Song {
  bpm: number;
  loop?: boolean;
  lead?: string[];
  harm?: string[];
  bass?: string[];
  drums?: string[];
  gains?: Partial<Record<Voice, number>>;
}
export interface Note { voice: Voice; token: string; step: number; steps: number }

const NOTE = /^([A-G])([#b]?)(-?\d)$/;
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUMS = new Set(['k', 's', 'h', 'c']);

/** The frequency of a note name (A4 = 440 Hz), or null when the token is not a note. */
export function freqOf(token: string): number | null {
  const m = NOTE.exec(token);
  if (!m) return null;
  const n = defined(SEMITONE[group(m, 1)], 'the note letter') + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((12 * (Number(m[3]) + 1) + n - 69) / 12);
}

/** The notes of a song, each with its start step and length in sixteenths, plus its length. */
export function parseSong(song: Song): { notes: Note[]; steps: number } {
  const notes: Note[] = [];
  let steps = 0;
  for (const voice of ['lead', 'harm', 'bass', 'drums'] as const) {
    const bars = song[voice];
    if (!bars) continue;
    const tokens = bars.join(' ').trim().split(/\s+/);
    steps = Math.max(steps, tokens.length);
    tokens.forEach((token, step) => {
      if (token === '-' || token === '.') return;
      const valid = voice === 'drums' ? DRUMS.has(token) : freqOf(token) !== null;
      if (!valid) throw new Error(`${voice}: "${token}" at step ${step} is not a ${voice === 'drums' ? 'drum' : 'note'}`);
      let n = 1;
      while (tokens[step + n] === '-') n++;
      notes.push({ voice, token, step, steps: n });
    });
  }
  return { notes, steps };
}

/** Seconds per sixteenth at a tempo. */
export const stepSeconds = (bpm: number) => 60 / bpm / 4;

export const SONGS = {
  // First visit: about 20 s (10 bars at 120), a build, the theme twice, a last chord. Scenes are
  // timed to its bars: stripes 0–4 s, OMNI-MAN rises 4–8 s, three lines 8/10/12 s, fleets 14–18 s.
  intro: {
    bpm: 120,
    lead: [
      '. . . . . . . . . . . . . . . .', 'G4 . . . G4 . . . G4 . A4 . B4 . D5 .',
      'C5 - - - G4 - - C5 - E5 - G5 - - - -', 'F5 - E5 - D5 - - - B4 - - - G4 - - -',
      'A4 - - C5 - - E5 - - - A5 - G5 - E5 -', 'F5 - - - E5 - D5 - C5 - - - A4 - - -',
      'C5 - - - G4 - - C5 - E5 - G5 - - C6 -', 'B5 - - - A5 - G5 - D5 - - - G5 - A5 -',
      'A5 - - - G5 - F5 - G5 - - - B5 - D6 -', 'C6 - - - - - - - - - - - . . . .',
    ],
    harm: [
      '. . . . . . . . . . . . . . . .', 'Eb4 - - - - - - - F4 - - - - - - -',
      'E4 - - - - - - - G4 - - - - - - -', 'D4 - - - - - - - B3 - - - - - - -',
      'C4 - - - - - - - E4 - - - - - - -', 'A3 - - - - - - - C4 - - - - - - -',
      'E4 - - - - - - - G4 - - - - - - -', 'D4 - - - - - - - B4 - - - - - - -',
      'C5 - - - - - - - D5 - - - - - - -', 'E5 - - - - - - - - - - - . . . .',
    ],
    bass: [
      'C2 - C3 - C2 - C3 - C2 - C3 - C2 - C3 -', 'Ab1 - Ab2 - Ab1 - Ab2 - Bb1 - Bb2 - Bb1 - Bb2 -',
      'C2 - C3 - C2 - C3 - C2 - C3 - C2 - C3 -', 'G1 - G2 - G1 - G2 - G1 - G2 - G1 - G2 -',
      'A1 - A2 - A1 - A2 - A1 - A2 - A1 - A2 -', 'F1 - F2 - F1 - F2 - F1 - F2 - F1 - F2 -',
      'C2 - C3 - C2 - C3 - C2 - C3 - C2 - C3 -', 'G1 - G2 - G1 - G2 - G1 - G2 - G1 - G2 -',
      'F1 - F2 - F1 - F2 - G1 - G2 - G1 - G2 -', 'C2 - - - - - - - - - - - . . . .',
    ],
    drums: [
      'k . . . k . . . k . . . k . h h', 'k . h . k . h . k . s . s s s s',
      'c . h . s . h . k k h . s . h h', 'k . h . s . h . k k h . s . h h',
      'k . h . s . h . k k h . s . h h', 'k . h . s . h . k k h . s . h h',
      'c . h . s . h . k k h . s . h h', 'k . h . s . h . k k h . s . h h',
      'k . h . s . h . k . s s s s s s', 'c . . . . . . . . . . . . . . .',
    ],
  },
  // Under the fleet select: upbeat arpeggios, low enough for each fleet's motif to cut through.
  select: {
    bpm: 140, loop: true,
    lead: [
      'A4 . C5 . E5 . C5 . A4 . C5 . E5 . A5 .', 'F4 . A4 . C5 . A4 . F4 . A4 . C5 . F5 .',
      'E4 . G4 . C5 . G4 . E4 . G4 . C5 . E5 .', 'D4 . G4 . B4 . G4 . D5 . B4 . G4 . D5 .',
    ],
    bass: [
      'A1 . A2 . A1 . A2 . A1 . A2 . A1 . A2 .', 'F1 . F2 . F1 . F2 . F1 . F2 . F1 . F2 .',
      'C2 . C3 . C2 . C3 . C2 . C3 . C2 . C3 .', 'G1 . G2 . G1 . G2 . G1 . G2 . G1 . G2 .',
    ],
    drums: ['k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k . h . s . h h', 'k . h . s . h . k k h . s s s s'],
    gains: { lead: 0.022 },
  },
  // Under the name entry and the hero builder: calm, so the typing blips read.
  name: {
    bpm: 96, loop: true,
    harm: [
      'E5 - - - - - - - D5 - - - C5 - - -', 'C5 - - - - - - - E5 - - - A4 - - -',
      'A4 - - - C5 - - - F5 - - - E5 - - -', 'D5 - - - - - - - B4 - - - G4 - - -',
    ],
    bass: [
      'C2 - - - - - - - C2 - - - - - - -', 'A1 - - - - - - - A1 - - - - - - -',
      'F1 - - - - - - - F1 - - - - - - -', 'G1 - - - - - - - G1 - - - - - - -',
    ],
    drums: ['h . . . h . . . h . . . h . . .', 'h . . . h . . . h . . . h . . .', 'h . . . h . . . h . . . h . . .', 'h . . . h . . . h . . . h . h .'],
    gains: { harm: 0.03, bass: 0.07, drums: 0.4 },
  },
  // A fleet is locked in.
  fanfare: {
    bpm: 150,
    lead: ['C5 . C5 . C5 . G5 - - - - - E5 . G5 .', 'C6 - - - - - - - - - - - . . . .'],
    harm: ['E4 . E4 . E4 . B4 - - - - - G4 . B4 .', 'E5 - - - - - - - - - - - . . . .'],
    bass: ['C2 . C2 . C2 . G2 - - - - - C2 . G2 .', 'C3 - - - - - - - - - - - . . . .'],
    drums: ['k . k . k . s s s s s s k . s .', 'c . . . . . . . . . . . . . . .'],
  },
  // A returning player.
  welcome: {
    bpm: 160,
    lead: ['G5 . C6 . E6 . G6 - - - - - . . . .'],
    harm: ['E5 . G5 . C6 . E6 - - - - - . . . .'],
    bass: ['C2 . . . G2 . C3 - - - - - . . . .'],
    drums: ['k . . . k . s . c . . . . . . .'],
  },
  // PLAYER 1 READY: the hero launches.
  launch: {
    bpm: 150,
    harm: ['C5 D5 E5 G5 C6 D6 E6 G6 C7 - - - - - - -'],
    bass: ['C2 - - - G2 - - - C3 - - - - - - -'],
    drums: ['s s s s s s s s c . . . . . . .'],
  },
  // LEVEL UP!: a climb up the chord, a turn, and the new level held.
  levelup: {
    bpm: 160,
    lead: ['C5 . E5 . G5 . C6 - - - G5 . C6 . E6 .', 'G6 - - - - - - - F6 - E6 - D6 - E6 -'],
    harm: ['E4 . G4 . C5 . E5 - - - E5 . G5 . C6 .', 'B5 - - - - - - - A5 - G5 - F5 - G5 -'],
    bass: ['C2 . . . G2 . . . C3 - - - G2 . C3 .', 'G2 - - - - - - - G1 - - - G2 - - -'],
    drums: ['k . s . k . s . c . . . s s s s', 'c . . . k . s . k . s . s s s s'],
  },
  // LEVEL UP! and NEW GAME UNLOCKED: the level-up's climb, a march up to the cabinet, and its lights.
  unlock: {
    bpm: 160,
    lead: ['C5 . E5 . G5 . C6 - - - G5 . C6 . E6 .', 'G5 - - - A5 - - - B5 - - - C6 - D6 -', 'E6 . G6 . C7 - - - - - - - . . . .'],
    harm: ['E4 . G4 . C5 . E5 - - - E5 . G5 . C6 .', 'D5 - - - F5 - - - G5 - - - A5 - B5 -', 'C6 . E6 . G6 - - - - - - - . . . .'],
    bass: ['C2 . . . G2 . . . C3 - - - G2 . C3 .', 'F2 - - - F2 - - - G2 - - - G2 - - -', 'C2 . . . C3 - - - - - - - . . . .'],
    drums: ['k . s . k . s . c . . . s s s s', 'k . h . s . h . k . h . s s s s', 'c . . . k . . . c . . . . . . .'],
  },
} satisfies Record<string, Song>;

export type SongName = keyof typeof SONGS;
