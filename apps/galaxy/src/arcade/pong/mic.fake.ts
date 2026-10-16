// A stand-in for the microphone, for tests: it answers what it is told, hears the pitch it is given,
// and counts its asks and its stops.
import type { MicOpened, PitchSource } from './mic';

export interface FakeMic extends PitchSource {
  /** What the next ask answers. */
  answer: MicOpened;
  /** The pitch it hears while on. */
  heard: number | null;
  readonly on: boolean;
  readonly asked: number;
  readonly stops: number;
  /** The track ends by itself. */
  end(): void;
}

export function fakeMic(answer: MicOpened = 'on'): FakeMic {
  let on = false, asked = 0, stops = 0;
  let ended = () => {};
  const mic: FakeMic = {
    answer,
    heard: null,
    get on() { return on; },
    get asked() { return asked; },
    get stops() { return stops; },
    open() {
      asked++;
      const given = mic.answer;
      return Promise.resolve().then(() => { on = given === 'on'; return given; });
    },
    pitch: () => (on ? mic.heard : null),
    stop() { stops++; on = false; },
    onEnded(listener) { ended = listener; },
    end() { on = false; ended(); },
  };
  return mic;
}

/** Lets every ask still waiting answer, and what follows from it run. */
export const settle = async (): Promise<void> => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
