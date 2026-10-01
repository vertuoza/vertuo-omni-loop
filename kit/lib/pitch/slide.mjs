// A pitch's cards as HTML pages (PRD 859's spec, "The slide"), drawn in the product's look and rendered
// to PNG by a browser:
//
// - `wedge`: the slide: the kicker, the hook, the benefit and one real frame of the walk-through.
// - `close`: the closing card the video ends on: the kicker and the closing line.
// - `backdrop`: the look's background alone, which the square video centres the walk-through on.
//
// Each in two shapes, `wide` (1920×1080) and `square` (1080×1080). Two looks: `arcade` (starfield, Anton
// italic in yellow with a red drop shadow, a pixel kicker, the screen in a hard-edged frame) and
// `keynote` (light background, a heavy sans headline, a plasma tag, a soft floating screen).
//
// No text box overflows: once the fonts load, each box's text shrinks until it fits, then the page marks
// its body `data-fit="done"`, which the renderer waits for.

export const SHAPES = Object.freeze({ wide: { width: 1920, height: 1080 }, square: { width: 1080, height: 1080 } });
export const LOOKS = Object.freeze(['arcade', 'keynote']);
const CARDS = Object.freeze(['wedge', 'close', 'backdrop']);

/** The frame's name in the run folder, as `omni pitch slide` copies it there. */
export const FRAME_FILE = 'frame.png';

/** The card files of a run: each PNG `omni pitch slide` writes, by card and shape. */
export const SLIDE_FILES = Object.freeze([
  { card: 'wedge', shape: 'wide', file: 'slide.png' },
  { card: 'wedge', shape: 'square', file: 'slide-square.png' },
  { card: 'close', shape: 'wide', file: 'close.png' },
  { card: 'close', shape: 'square', file: 'close-square.png' },
  { card: 'backdrop', shape: 'square', file: 'backdrop-square.png' },
]);

const FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;800;900&family=Press+Start+2P&display=block';

const escape = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** A fixed starfield: the same stars on every arcade card, from a small fixed generator. */
function starfield(width, height) {
  let seed = 859;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const stars = [];
  for (let index = 0; index < 140; index += 1) {
    const size = next() < 0.85 ? 2 : 4;
    const shade = next() < 0.8 ? 'rgba(255,255,255,0.7)' : '#ffd23f';
    stars.push(`${Math.round(next() * width)}px ${Math.round(next() * height)}px 0 ${size / 2}px ${shade}`);
  }
  return stars.join(',');
}

const LOOK_CSS = {
  arcade: ({ width, height }) => `
    body { background: radial-gradient(ellipse at 30% 20%, #1b1450 0%, #07071a 60%, #030310 100%); color: #fff; }
    .stars { position: absolute; left: 0; top: 0; width: 1px; height: 1px; box-shadow: ${starfield(width, height)}; }
    .kicker { font-family: 'Press Start 2P', monospace; color: #4ee1ff; letter-spacing: 2px; text-shadow: 3px 3px 0 #e8323c; }
    .hook, .closing { font-family: Anton, Impact, sans-serif; font-style: italic; color: #ffd23f; text-transform: uppercase;
      text-shadow: 6px 6px 0 #e8323c; line-height: 1.02; }
    .benefit { font-family: Inter, Arial, sans-serif; font-weight: 500; color: #e7e7ff; line-height: 1.3; }
    .frame img { border: 6px solid #fff; box-shadow: 14px 14px 0 #e8323c; border-radius: 0; }`,
  keynote: () => `
    body { background: linear-gradient(180deg, #fbfbfd 0%, #eef0f5 100%); color: #111; }
    .stars { display: none; }
    .kicker-box { align-items: flex-start; }
    .kicker { display: inline-block; font-family: Inter, Arial, sans-serif; font-weight: 800; color: #fff; letter-spacing: 1px;
      background: linear-gradient(90deg, #6d28d9, #db2777, #f59e0b); border-radius: 999px; padding: 0.45em 1.1em; }
    .hook, .closing { font-family: Inter, Arial, sans-serif; font-weight: 900; color: #0b0b12; letter-spacing: -0.02em; line-height: 1.04; }
    .benefit { font-family: Inter, Arial, sans-serif; font-weight: 500; color: #4a4a57; line-height: 1.35; }
    .frame img { border-radius: 22px; box-shadow: 0 50px 90px rgba(20, 20, 40, 0.22), 0 8px 20px rgba(20, 20, 40, 0.12);
      transform: translateY(-8px); }`,
};

/** Where each box sits, per card and shape, and the size its text starts at before it shrinks to fit. */
const LAYOUT = {
  'wedge/wide': `
    .card { display: grid; grid-template-columns: 760px 1fr; gap: 64px; padding: 96px 96px 96px 112px; align-items: center; }
    .words { display: flex; flex-direction: column; gap: 36px; height: 888px; justify-content: center; }
    .kicker-box { height: 72px; } .kicker { font-size: 26px; }
    .hook-box { height: 430px; } .hook { font-size: 108px; }
    .benefit-box { height: 230px; } .benefit { font-size: 40px; }
    .frame { height: 888px; display: flex; align-items: center; justify-content: center; }
    .frame img { max-width: 100%; max-height: 760px; }`,
  'wedge/square': `
    .card { display: flex; flex-direction: column; gap: 28px; padding: 72px; }
    .words { display: flex; flex-direction: column; gap: 22px; }
    .kicker-box { height: 56px; } .kicker { font-size: 22px; }
    .hook-box { height: 230px; } .hook { font-size: 84px; }
    .benefit-box { height: 110px; } .benefit { font-size: 32px; }
    .frame { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
    .frame img { max-width: 100%; max-height: 100%; }`,
  'close/wide': `
    .card { display: flex; flex-direction: column; gap: 48px; padding: 160px; justify-content: center; align-items: center; text-align: center; }
    .kicker-box { height: 72px; width: 1600px; align-items: center; } .kicker { font-size: 28px; }
    .closing-box { height: 420px; width: 1600px; } .closing { font-size: 104px; }`,
  'close/square': `
    .card { display: flex; flex-direction: column; gap: 40px; padding: 96px; justify-content: center; align-items: center; text-align: center; }
    .kicker-box { height: 64px; width: 888px; align-items: center; } .kicker { font-size: 24px; }
    .closing-box { height: 520px; width: 888px; } .closing { font-size: 92px; }`,
  'backdrop/wide': '',
  'backdrop/square': '',
};

/** Shrinks each box's text until it fits its box, then marks the page done. */
const FIT_SCRIPT = `
(async () => {
  try { await document.fonts.ready; } catch {}
  for (const box of document.querySelectorAll('[data-box]')) {
    const text = box.firstElementChild;
    let size = parseFloat(getComputedStyle(text).fontSize);
    const fits = () => text.scrollWidth <= box.clientWidth && text.offsetHeight <= box.clientHeight;
    while (!fits() && size > 8) { size -= 2; text.style.fontSize = size + 'px'; }
  }
  const image = document.querySelector('.frame img');
  if (image && !image.complete) await new Promise((done) => { image.onload = done; image.onerror = done; });
  document.body.dataset.fit = 'done';
})();`;

const box = (name, text) => `<div class="${name}-box" data-box><div class="${name}">${escape(text)}</div></div>`;

function body(card, shape, words) {
  if (card === 'backdrop') return '';
  const kicker = box('kicker', words.kicker);
  if (card === 'close') return `<main class="card">${kicker}${box('closing', words.closing)}</main>`;
  const text = `<section class="words">${kicker}${box('hook', words.hook)}${box('benefit', words.benefit)}</section>`;
  return `<main class="card">${text}<div class="frame"><img src="${FRAME_FILE}" alt=""></div></main>`;
}

/**
 * One card of a pitch as an HTML page, for a browser to render at its shape's size. The frame is read
 * from `frame.png` beside the page.
 * @param {{ look: 'arcade' | 'keynote', card: 'wedge' | 'close' | 'backdrop', shape: 'wide' | 'square',
 *   words: { kicker: string, hook: string, benefit: string, closing: string } }} input
 */
export function slideHtml({ look, card, shape, words }) {
  if (!LOOKS.includes(look)) throw new RangeError(`a look is arcade or keynote, not ${String(look)}`);
  if (!CARDS.includes(card)) throw new RangeError(`a card is wedge, close or backdrop, not ${String(card)}`);
  const size = SHAPES[shape];
  if (!size) throw new RangeError(`a shape is wide or square, not ${String(shape)}`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${size.width}px; height: ${size.height}px; overflow: hidden; }
  body { position: relative; }
  .card { position: relative; width: ${size.width}px; height: ${size.height}px; }
  [data-box] { overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
  ${LOOK_CSS[look](size)}
  ${LAYOUT[`${card}/${shape}`]}
</style></head>
<body><div class="stars"></div>${body(card, shape, words)}
<script>${FIT_SCRIPT}</script></body></html>
`;
}
