// Square-wave blips, generated on the fly. Browsers only allow sound after a key or a tap,
// so the context is created lazily on the first action.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

export type Sfx = 'move' | 'select' | 'back' | 'start' | 'tab';

export function play(sfx: Sfx, muted: boolean) {
  if (muted || typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  switch (sfx) {
    case 'move': tone(660, 0, 0.04); break;
    case 'tab': tone(520, 0, 0.03); tone(780, 0.03, 0.03); break;
    case 'select': tone(523, 0, 0.06); tone(784, 0.06, 0.08); break;
    case 'back': tone(392, 0, 0.05); tone(262, 0.05, 0.08); break;
    case 'start': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.1)); tone(1568, 0.3, 0.25, 'triangle', 0.04); break;
  }
}
