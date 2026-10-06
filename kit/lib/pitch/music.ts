// Silence as a WAV file, for the `none` music provider (PRD 1108): a pitch without music encodes like any
// other. PRD 859's procedural music, which this file made, is gone (PRD 1108 s6): a pitch's music is a
// track its provider picks.

const WAV = Object.freeze({ rate: 44100, channels: 2 });

/** The 44-byte header of a 16-bit PCM WAV holding `frames` frames. */
function wavHeader(frames: number): Buffer {
  const { rate, channels } = WAV;
  const data = frames * channels * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data, 40);
  return header;
}

/** `seconds` of silence as a WAV file's bytes: 44.1 kHz, 16-bit stereo. */
export function silenceWav(seconds: number): Buffer {
  if (!(seconds > 0)) throw new RangeError(`silence needs a length above 0 s, not ${String(seconds)}`);
  const frames = Math.round(seconds * WAV.rate);
  return Buffer.concat([wavHeader(frames), Buffer.alloc(frames * WAV.channels * 2)]);
}
