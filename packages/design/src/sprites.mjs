// The cast and the icons, laid out as material shapes and finished by the forge (forge.mjs).
// Heroes are 32×32 (OmniMan and his poses 32×48), Entropy 24×24, icons 16×16. Every sprite has two
// frames (`f` is 0 or 1): breathing, tentacles, a coin flip, a flicker, a stride.
// Materials: see RAMPS and FLAT in forge.mjs; 'k' is an inner line.

import { RAMPS } from './forge.mjs';

const SUIT_STRIPES = (d, x, y, w = 7) => {
  d.rect(x, y, w, 1, '1').rect(x + 2, y + 2, w - 1, 1, '2').rect(x, y + 4, w, 1, '3').rect(x + 2, y + 6, w - 2, 1, '4');
};

function heroDraw(girl, cape) {
  return (d, f) => {
    const b = f; // breathing
    if (cape) {
      const w = f ? 0 : 1; // the hem flutters
      d.poly([[7, 17], [25, 17], [28 + w, 44], [22, 45 - w], [16, 44 + w], [10, 45 - w], [4 - w, 44]], 'P');
    }
    if (girl) {
      d.poly([[11, 31], [16, 31], [15.5, 41], [12, 41]], 'W').poly([[11, 31], [12.5, 31], [12.5, 41], [12, 41]], 'N');
      d.poly([[11.5, 39], [15.5, 39], [15.5, 46], [10.5, 46]], 'n');
      d.poly([[7, 18 - b], [25, 18 - b], [21, 31], [11, 31]], 'N');
      d.poly([[11, 18 - b], [21, 18 - b], [19.5, 31], [12.5, 31]], 'W');
      d.poly([[5, 20 - b], [9, 18 - b], [10, 27], [6.5, 28]], 'N');
      d.poly([[6, 22 - b], [8, 21 - b], [8.5, 26], [6.5, 26]], 'W');
      d.ellipse(7.5, 29.5, 2.6, 2.5, 'n');
      d.rect(11, 30, 10, 2, 'n');
    } else {
      d.poly([[10, 31], [16, 31], [15.5, 42], [11, 42]], 'W').poly([[10, 31], [12, 31], [12, 42], [11, 42]], 'N');
      d.poly([[10.5, 41], [15.5, 41], [15.5, 46], [9.5, 46]], 'n');
      d.poly([[5, 18 - b], [27, 18 - b], [22, 32], [10, 32]], 'N');
      d.poly([[10, 18 - b], [22, 18 - b], [20, 32], [12, 32]], 'W');
      d.poly([[3, 20 - b], [8, 18 - b], [9, 28], [5, 29]], 'N');
      d.poly([[4, 22 - b], [6, 21 - b], [7, 27], [5, 27]], 'W');
      d.ellipse(6.5, 30.5, 3.2, 3, 'n');
      d.rect(11, 31, 10, 2, 'n');
    }
    d.mirror();
    SUIT_STRIPES(d, 12, 21 - b, girl ? 6 : 7);
    const buckle = girl ? 31 : 32;
    d.px(15, buckle, 'Y').px(16, buckle, 'Y');
    if (girl) {
      d.ellipse(16, 9, 8.5, 8.5, 'H');
      d.rect(8, 9, 4, 10, 'H').rect(20, 9, 4, 10, 'H');
    }
    d.rect(13, 14, 6, 5, 'S');
    d.ellipse(16, 9, 6.5, 7.5, 'S');
    if (girl) {
      d.ellipse(16, 4.5, 7.5, 4, 'H');
      d.pxs([[10, 8], [10, 9], [21, 8], [21, 9]], 'H');
    } else {
      d.ellipse(16, 4.5, 7, 4, 'H').rect(9, 4, 3, 4, 'H').rect(20, 4, 3, 4, 'H');
      d.pxs([[11, 0], [12, 1], [15, 0], [16, 0], [19, 0], [20, 1]], 'H');
      d.pxs([[9, 9], [9, 10], [22, 9], [22, 10]], 'S', 2);
    }
    d.rect(12, 7, 3, 1, 'H').rect(17, 7, 3, 1, 'H');
    d.px(12, 9, 'Q').px(13, 9, 'E', 2).px(18, 9, 'E', 2).px(19, 9, 'Q');
    if (girl) d.px(11, 8, 'H').px(20, 8, 'H');
    d.px(16, 11, 'S', 2);
    d.rect(14, 13, 4, 1, 'S', 3).px(13, 12, 'S', 3).px(18, 12, 'S', 3);
  };
}

// The commander's neck and head: grey streak, stern brows, the mustache.
function omniHead(d) {
  d.rect(13, 14, 6, 5, 'S');
  d.ellipse(16, 9, 6.5, 7.5, 'S');
  d.ellipse(16, 4.5, 7, 4, 'H').rect(9, 4, 3, 5, 'H').rect(20, 4, 3, 5, 'H');
  d.pxs([[19, 1], [20, 2], [21, 2], [21, 3], [22, 4], [22, 5]], 'G');
  d.pxs([[9, 9], [9, 10], [22, 9], [22, 10]], 'S', 2);
  d.rect(11, 7, 4, 1, 'H').rect(17, 7, 4, 1, 'H');
  d.px(12, 9, 'Q').px(13, 9, 'E', 2).px(18, 9, 'E', 2).px(19, 9, 'Q');
  d.px(16, 10, 'S', 2).px(16, 11, 'S', 2).px(15, 11, 'S', 2);
  d.rect(12, 12, 8, 1, 'H').rect(13, 13, 6, 1, 'H').px(12, 13, 'H').px(19, 13, 'H').px(11, 13, 'H', 3).px(20, 13, 'H', 3);
  d.rect(15, 14, 2, 1, 'S', 2);
}

// OmniMan's poses, on the idle body: `point` (arm out to his left, the ad's spokesperson), `cheer`
// (a fist raised, thumb up) and `run` (two strides). With `cape`, the plasma cape heroes wear, so a
// hero's cape recolours it (heroes.mjs › heroPose). Points and cheers breathe as the idle body does.
function omniPose(pose, cape) {
  return (d, f) => {
    const run = pose === 'run';
    const b = run ? 0 : f;
    if (cape) {
      if (run) d.poly([[8, 17], [21, 17], [15, 29], [5, 37 + f], [2, 33 - f], [4, 24]], 'P'); // streaming behind him
      else { const w = f ? 0 : 1; d.poly([[7, 17], [25, 17], [28 + w, 44], [22, 45 - w], [16, 44 + w], [10, 45 - w], [4 - w, 44]], 'P'); }
    }
    // Standing legs and the torso: symmetric, so the right half copies the left.
    if (!run) {
      d.poly([[10, 31], [16, 31], [15.5, 42], [11, 42]], 'W').poly([[10, 31], [12, 31], [12, 42], [11, 42]], 'N');
      d.poly([[10.5, 41], [15.5, 41], [15.5, 46], [9.5, 46]], 'n');
    }
    d.poly([[5, 18 - b], [27, 18 - b], [22, 32], [10, 32]], 'N');
    d.poly([[10, 18 - b], [22, 18 - b], [20, 32], [12, 32]], 'W');
    if (!run) d.mirror(); // a running cape streams to one side, so it is not mirrored
    if (run) {
      // A stride: one leg thrown back, the other reaching forward; the second frame swaps them.
      const [back, fore] = f ? [[19, 25, 39, 26.5, 42], [13, 10, 42, 9.5, 44.5]] : [[13, 7, 39, 5.5, 42], [19, 22, 42, 22.5, 44.5]];
      for (const [hx, fx, fy, bx, by] of [back, fore]) {
        d.line(hx, 32, fx, fy, 'W', 4).line(hx - 1.5, 32, fx - 1.5, fy, 'N', 1.2);
        d.ellipse(bx, by, 3, 2, 'n');
      }
    }
    d.rect(11, 31, 10, 2, 'n');
    // His right arm (the viewer's left): at his side, or swinging as he runs.
    if (run && f) d.line(7, 20, 10, 27, 'N', 3.2).ellipse(10.5, 28.5, 2.8, 2.6, 'n');
    else if (run) d.line(7, 20, 4, 26, 'N', 3.2).ellipse(4.5, 27.5, 2.6, 2.4, 'n');
    else {
      d.poly([[3, 20 - b], [8, 18 - b], [9, 28], [5, 29]], 'N').poly([[4, 22 - b], [6, 21 - b], [7, 27], [5, 27]], 'W');
      d.ellipse(6.5, 30.5, 3.2, 3, 'n');
    }
    // His left arm (the viewer's right) makes the pose.
    if (pose === 'point') {
      d.poly([[23, 18 - b], [27, 18.5 - b], [27, 23 - b], [23, 23 - b]], 'N').rect(23, 20 - b, 4, 1, 'W');
      d.ellipse(28, 21 - b, 2, 2.2, 'n').rect(29, 20 - b, 2, 1, 'n');
    } else if (pose === 'cheer') {
      d.line(25, 20 - b, 28, 25, 'N', 3.2).line(28, 25, 28, 17, 'N', 3.2);
      d.ellipse(28, 15.5, 2.4, 2.2, 'n').rect(28, 11, 1, 3, 'n');
    } else if (f) d.line(25, 20, 28, 26, 'N', 3.2).ellipse(28.5, 27.5, 2.8, 2.6, 'n');
    else d.line(25, 20, 22, 27, 'N', 3.2).ellipse(21.5, 28.5, 2.8, 2.6, 'n');
    SUIT_STRIPES(d, 12, 21 - b);
    d.px(16, 32, 'Y').px(15, 32, 'Y');
    omniHead(d);
  };
}

export const SPRITE_DEFS = Object.freeze({
  // The commander, as in the key art: navy-and-white suit, the four Vertuoza stripes on the chest,
  // black hair with a grey streak, the mustache, clenched fists.
  omni: {
    w: 32, h: 48,
    draw(d, f) {
      const b = f; // breathing: the chest rises one pixel
      // Legs and boots.
      d.poly([[10, 31], [16, 31], [15.5, 42], [11, 42]], 'W').poly([[10, 31], [12, 31], [12, 42], [11, 42]], 'N');
      d.poly([[10.5, 41], [15.5, 41], [15.5, 46], [9.5, 46]], 'n');
      // Torso, shoulders, arms.
      d.poly([[5, 18 - b], [27, 18 - b], [22, 32], [10, 32]], 'N');
      d.poly([[10, 18 - b], [22, 18 - b], [20, 32], [12, 32]], 'W');
      d.poly([[3, 20 - b], [8, 18 - b], [9, 28], [5, 29]], 'N');
      d.poly([[4, 22 - b], [6, 21 - b], [7, 27], [5, 27]], 'W');
      d.ellipse(6.5, 30.5, 3.2, 3, 'n');
      d.rect(11, 31, 10, 2, 'n');
      d.mirror();
      SUIT_STRIPES(d, 12, 21 - b);
      d.px(16, 32, 'Y').px(15, 32, 'Y');
      omniHead(d);
    },
  },

  // OmniMan's poses (omniPose), bare as the commander wears his suit, or caped as a hero.
  'omni-point': { w: 32, h: 48, draw: omniPose('point', false) },
  'omni-cheer': { w: 32, h: 48, draw: omniPose('cheer', false) },
  'omni-run': { w: 32, h: 48, draw: omniPose('run', false) },
  'omni-point-cape': { w: 32, h: 48, draw: omniPose('point', true) },
  'omni-cheer-cape': { w: 32, h: 48, draw: omniPose('cheer', true) },
  'omni-run-cape': { w: 32, h: 48, draw: omniPose('run', true) },

  // beaver mascot: goggles, buck teeth, a wrench.
  beaver: {
    w: 32, h: 32,
    draw(d, f) {
      d.ellipse(26, 27, 5, 3, 'D'); // tail, behind
      d.pxs([[23, 26], [25, 27], [27, 26], [29, 27], [24, 28], [28, 28]], 'D', 3);
      d.ellipse(7, 5, 3, 3, 'B').ellipse(7, 5, 1.4, 1.4, 'T');
      d.ellipse(16, 23, 8.5, 7 - f * 0.5, 'N').ellipse(16, 23.5, 5.5, 6, 'W');
      d.ellipse(11, 30, 3.5, 1.6, 'B');
      d.ellipse(16, 12, 10, 8.5, 'B');
      d.ellipse(16, 17, 5.5, 3.5, 'T');
      d.ellipse(11, 10, 3.6, 3.2, 'L').ellipse(11, 10, 2.5, 2.2, 'E');
      d.rect(3, 9, 4, 1, 'n');
      d.mirror();
      d.px(12, 10, 'X').px(11, 10, 'X').px(10, 9, 'Q').px(20, 10, 'X').px(21, 10, 'X').px(22, 9, 'Q');
      d.ellipse(16, 15, 2.2, 1.3, 'X').px(15, 14, 'Q');
      d.rect(14, 17, 4, 1, 'k').rect(14, 18, 4, 3, 'Q').rect(16, 18, 1, 3, 'L', 2);
      SUIT_STRIPES(d, 13, 23, 6);
      // Paws and the wrench, held up on the right.
      d.ellipse(7.5, 24, 2.3, 2.3, 'B');
      d.line(26, 22, 27.5, 12 - f, 'L', 2.2);
      d.ellipse(28, 10 - f, 3, 3, 'L').rect(27, 6 - f, 2, 3, null).ellipse(28, 10 - f, 1, 1, 'L', 3);
      d.ellipse(25, 22, 2.3, 2.3, 'B');
    },
  },

  // octopod mascot: a big violet head, pink spots, six curling tentacles, a suit collar.
  octopod: {
    w: 32, h: 32,
    draw(d, f) {
      for (let i = 0; i < 6; i++) {
        const x0 = 7 + i * 3.6, dir = i < 3 ? -1 : 1, ph = f * 1.2 + i;
        const pts = Array.from({ length: 6 }, (_, k) => [x0 + dir * k * 0.9 + Math.sin(ph + k * 0.9) * 1.2, 19 + k * 2]);
        for (let k = 1; k < pts.length; k++) d.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 'V', 3.2 - k * 0.35);
        d.px(pts[3][0] + 0.5, pts[3][1] + 1, 'M', 1).px(pts[4][0] + 0.5, pts[4][1] + 1, 'M', 1);
      }
      d.rect(9, 17, 14, 4, 'N').rect(11, 17, 10, 4, 'W').px(15, 18, 'C').px(16, 18, 'C');
      d.ellipse(16, 10, 11, 9.5 - f * 0.5, 'V');
      d.ellipse(12, 12, 2.6, 3.2, 'Q').ellipse(12.6, 12.8, 1.4, 1.8, 'X').px(12, 11, 'Q');
      d.mirror();
      d.ellipse(10, 5, 1.5, 1.2, 'M', 1).ellipse(21, 4, 1.2, 1, 'M', 1).ellipse(23, 8, 1.3, 1.3, 'M', 1).px(8, 9, 'M', 2);
      d.rect(15, 15, 2, 1, 'k');
    },
  },

  // picsou mascot: a duck in goggles, a dollar on the chest, flipping a gold coin.
  picsou: {
    w: 32, h: 32,
    draw(d, f) {
      d.poly([[3, 22], [8, 19], [8, 27]], 'F');
      d.ellipse(11, 30, 3.8, 1.6, 'O').ellipse(19, 30, 3.8, 1.6, 'O');
      d.ellipse(15, 23, 8, 6.5, 'N').ellipse(15, 23.5, 5, 5.5, 'W');
      d.ellipse(15, 11, 8.5, 8.5, 'F');
      d.poly([[12, 3], [14, 0], [16, 3], [18, 0.5], [18.5, 4]], 'F');
      d.ellipse(24.5, 13, 5.5, 2.6, 'O').ellipse(23.5, 15.5, 4.5, 1.6, 'O', 2).rect(20, 14, 9, 1, 'k');
      d.ellipse(12, 10, 3, 2.6, 'L').ellipse(12, 10, 2, 1.7, 'E').ellipse(19, 10, 3, 2.6, 'L').ellipse(19, 10, 2, 1.7, 'E');
      d.rect(5, 9, 4, 1, 'n').rect(15, 10, 1, 1, 'L');
      d.px(12, 10, 'X').px(19, 10, 'X').px(11, 9, 'Q').px(18, 9, 'Q');
      d.pxs([[15, 21], [14, 22], [15, 23], [16, 24], [15, 25], [15, 20], [15, 26]], 'Y', 1);
      // Arm up, the coin spinning above the hand.
      d.line(20, 22, 25, 18, 'F', 2.4).ellipse(26, 17, 1.8, 1.8, 'F');
      d.ellipse(27, 11 - f, f ? 1.4 : 3.2, 3.4, 'Y');
      if (!f) d.rect(27, 9, 1, 4, 'Y', 2);
    },
  },

  // cia mascot: the agency man. Sunglasses, earpiece, dark suit, red tie.
  cia: {
    w: 32, h: 32,
    draw(d, f) {
      d.rect(11, 26, 4, 4, 'A').rect(10, 29, 5, 2, 'X');
      d.poly([[5, 17], [27, 17], [24, 27], [8, 27]], 'A');
      d.poly([[4, 19], [8, 17], [8, 26], [5, 26]], 'A');
      d.ellipse(6.5, 27.5, 2.2, 2, 'S');
      d.mirror();
      d.poly([[12.5, 16.5], [19.5, 16.5], [16, 23]], 'F');
      d.poly([[15, 18], [17, 18], [17.6, 23], [16, 25], [14.4, 23]], 'R');
      d.line(12, 17, 15, 24, 'k').line(20, 17, 17, 24, 'k');
      d.rect(13, 13, 6, 4, 'S');
      d.ellipse(16, 9, 7, 8, 'S');
      d.pxs([[8, 9], [8, 10], [23, 9], [23, 10]], 'S', 2);
      d.rect(9, 8, 6, 3, 'X').rect(17, 8, 6, 3, 'X').rect(15, 8, 2, 1, 'X');
      d.px(10, 8, 'Q').px(18, 8, 'Q').px(11, 9, 'A', 0).px(19, 9, 'A', 0);
      d.rect(13, 14, 6, 1, 'k').px(16, 12, 'S', 2);
      d.px(7, 11, 'L').line(7, 12, 8, 17, 'L').px(7, 11 + f, 'C');
    },
  },

  // invincible mascot: yellow suit, navy cowl with white lenses, navy gloves and legs.
  invincible: {
    w: 32, h: 32,
    draw(d, f) {
      d.rect(11, 26, 4, 3, 'N').rect(10, 28, 5, 3, 'n');
      d.poly([[5, 17], [27, 17], [23, 27], [9, 27]], 'N');
      d.poly([[9.5, 17], [22.5, 17], [20, 27], [12, 27]], 'Y');
      d.poly([[3, 19], [8, 17], [8, 25], [4, 25]], 'N');
      d.ellipse(5.5, 27, 2.6, 2.4, 'n');
      d.rect(11, 25, 10, 2, 'n');
      d.mirror();
      d.ellipse(16, 2.5 + f * 0.3, 5.5, 2.6, 'H');
      d.ellipse(16, 9, 7, 8, 'N');
      d.ellipse(16, 13.5, 5.5, 4, 'S').rect(13, 16, 6, 1, 'S', 2);
      d.ellipse(12.5, 9, 2.6, 2, 'Q').ellipse(19.5, 9, 2.6, 2, 'Q');
      d.rect(15, 15, 2, 1, 'S', 2);
      d.rect(14, 20, 4, 2, 'N', 1).px(15, 19, 'N', 1).px(16, 19, 'N', 1);
    },
  },

  // pirate mascot: a tricorn with a white skull, an eye patch and a gold tooth, a striped shirt under
  // a sea-teal coat, a peg leg, a raised cutlass, and a parrot on the shoulder flapping its wing.
  pirate: {
    w: 32, h: 32,
    draw(d, f) {
      d.rect(11, 26, 4, 3, 'N').rect(10, 28, 5, 3, 'D');
      d.rect(18, 26, 3, 2, 'N').rect(19, 28, 2, 3, 'B');
      d.poly([[6, 17], [26, 17], [23, 27], [9, 27]], 'K');
      d.poly([[11, 17], [21, 17], [19.5, 27], [12.5, 27]], 'F');
      for (let y = 18; y < 27; y += 2) {
        const i = (y - 17) * 0.15, l = Math.ceil(11 + i), r = Math.floor(21 - i);
        d.rect(l, y, r - l, 1, 'R', 1);
      }
      d.rect(9, 24, 14, 2, 'D').rect(15, 24, 2, 2, 'Y');
      d.poly([[4, 19], [8, 17], [8, 25], [5, 25]], 'K');
      d.ellipse(5.5, 26.5, 2.4, 2.2, 'S');
      d.line(24, 19, 27, 13, 'K', 3);
      d.ellipse(27.5, 12, 2.2, 2.2, 'S');
      d.line(28, 10, 30, 1 + f, 'L', 1.6);
      d.rect(26, 10, 4, 1, 'Y');
      d.ellipse(16, 10, 7, 7, 'S');
      d.ellipse(16, 14.5, 5.5, 2.8, 'H');
      d.rect(14, 13, 4, 1, 'X').px(16, 13, 'Y');
      d.px(19, 10, 'Q').px(20, 10, 'X');
      d.ellipse(12.5, 10, 2.2, 1.9, 'X');
      d.line(9, 8, 11, 9, 'X').line(12, 8, 22, 6, 'X');
      d.poly([[4, 7], [16, 0], [28, 7], [16, 6]], 'H');
      d.ellipse(16, 4, 6.5, 3.5, 'H');
      d.pxs([[15, 2], [16, 2], [17, 2], [16, 3], [15, 4], [17, 4]], 'Q');
      d.ellipse(6, 14.5, 2.4, 3, 'R');
      d.ellipse(6, 11, 2, 2, 'R');
      d.px(3, 11, 'Y').px(4, 11, 'Y').px(4, 12, 'Y').px(5, 10, 'X');
      if (f) d.poly([[7, 13], [11, 9], [9, 15]], 'Y'); else d.ellipse(7.5, 15, 1.5, 2.4, 'Y');
      d.line(6, 17, 7, 19, 'E', 1);
    },
  },

  // atom-eve mascot (PRD 517): Atom Eve, in a pink bodysuit with magenta trim, long red hair and a
  // light pink atom on the chest, one hand raised holding a pink energy ball that flickers, its sparks
  // moving.
  'atom-eve': {
    w: 32, h: 32,
    draw(d, f) {
      d.rect(11, 26, 4, 3, 'M').rect(10, 28, 5, 3, 'M', 3);
      d.poly([[7, 17], [25, 17], [22, 27], [10, 27]], 'M');
      d.poly([[5, 19], [9, 17], [9, 25], [6, 25]], 'M');
      d.ellipse(6.5, 26.5, 2.2, 2, 'M', 3);
      d.rect(11, 25, 10, 2, 'M', 3);
      d.mirror();
      // The raised arm: the mirrored one cleared, then lifted to hold the energy.
      d.rect(22, 19, 6, 10, null).rect(20, 25, 3, 2, 'M', 3);
      d.line(23, 19, 26, 13, 'M', 3);
      d.ellipse(26.5, 11.5, 2.2, 2, 'M', 3);
      d.ellipse(27, 6 - f, f ? 3 : 3.8, f ? 3 : 3.8, 'M', 0);
      d.ellipse(27, 6 - f, f ? 1.8 : 1.4, f ? 1.8 : 1.4, 'Q');
      if (f) d.pxs([[23, 2], [31, 4], [25, 0], [31, 9], [22, 7]], 'y');
      else d.pxs([[24, 1], [31, 1], [22, 5], [31, 8], [29, 11]], 'y');
      // Long red hair, behind the face.
      d.ellipse(15, 9, 8, 8, 'R').rect(7, 9, 4, 11, 'R').rect(19, 9, 4, 10, 'R');
      d.rect(13, 14, 5, 4, 'S');
      d.ellipse(15, 10, 6, 6.5, 'S');
      d.ellipse(15, 4.5, 7, 3.5, 'R').pxs([[9, 7], [10, 8], [20, 7], [21, 8]], 'R');
      d.px(12, 10, 'X').px(18, 10, 'X').px(12, 9, 'Q').px(18, 9, 'Q');
      d.rect(11, 8, 3, 1, 'R', 3).rect(17, 8, 3, 1, 'R', 3);
      d.px(15, 12, 'S', 2).rect(14, 14, 3, 1, 'R', 2);
      // The magenta collar, and the light pink atom on the chest: two orbits round a bright core.
      d.rect(12, 17, 7, 1, 'M', 3);
      d.pxs([[13, 19], [14, 20], [16, 21], [18, 22], [19, 23], [13, 23], [14, 22], [18, 20], [19, 19]], 'M', 0);
      d.px(16, 21, 'y').px(15, 21, 'M', 0).px(17, 21, 'M', 0);
    },
  },

  // shark mascot (PRD 517): an upright blue-grey shark with a white belly, a dorsal fin, fins for arms
  // and a toothy grin, the four Vertuoza stripes on a collar with a navy tie. The tail swishes, and the
  // jaw opens wider.
  shark: {
    w: 32, h: 32,
    draw(d, f) {
      d.poly(f ? [[22, 24], [31, 18], [28, 25], [31, 31], [22, 28]] : [[22, 24], [30, 21], [27, 26], [30, 30], [22, 28]], 'J');
      d.ellipse(16, 18, 10, 12.5, 'J');
      d.poly([[13, 7], [18, 0], [20, 8]], 'J');
      d.ellipse(15, 23, 6.5, 7.5, 'W');
      d.poly([[6, 18], [1, 25], [8, 23]], 'J');
      d.poly([[25, 18], [30, 13], [26, 22]], 'J');
      d.ellipse(12, 30, 3, 1.6, 'J', 2).ellipse(19, 30, 3, 1.6, 'J', 2);
      d.ellipse(11, 10, 2, 2.2, 'Q').px(11, 10, 'X').px(12, 10, 'X').px(11, 11, 'X').px(12, 11, 'X');
      d.ellipse(20, 10, 2, 2.2, 'Q').px(20, 10, 'X').px(21, 10, 'X').px(20, 11, 'X').px(21, 11, 'X');
      d.rect(9, 7, 4, 1, 'k').rect(19, 7, 4, 1, 'k');
      d.pxs([[7, 12], [7, 14], [8, 13], [24, 12], [24, 14], [23, 13]], 'J', 3);
      // The grin: a dark mouth lined with teeth, the jaw dropping a pixel as it opens.
      d.rect(9, 13, 14, 2 + f, 'X');
      for (let x = 9; x < 23; x += 2) d.px(x, 13, 'Q').px(x + 1, 14 + f, 'Q');
      // The collar in the four stripes, knotted with a navy tie.
      d.rect(9, 18, 3, 1, '1').rect(12, 18, 3, 1, '2').rect(17, 18, 3, 1, '3').rect(20, 18, 3, 1, '4');
      d.rect(15, 18, 2, 1, 'N');
      d.poly([[15, 19], [17, 19], [17.5, 25], [16, 26.5], [14.5, 25]], 'N');
    },
  },

  // turtle mascot (PRD 517): a green turtle with an olive hex-patterned shell, its head out front in
  // a bandana of the Vertuoza stripes. The head bobs up and the eye blinks.
  turtle: {
    w: 32, h: 32,
    draw(d, f) {
      const b = -f; // the head bobs up
      d.ellipse(8, 28, 3, 2.5, 'g').ellipse(22, 28, 3, 2.5, 'g');
      d.ellipse(28, 25, 2.2, 1.6, 'g');
      d.ellipse(16, 21, 12, 8.5, 'o');
      d.rect(4, 26, 24, 2, 'T', 1).rect(4, 27, 24, 1, 'T', 2);
      // The hex pattern: a lit hexagon in the middle, its seams running out to the rim.
      d.poly([[13, 16], [19, 16], [21, 20], [19, 24], [13, 24], [11, 20]], 'o', 0);
      d.line(13, 16, 11, 20, 'k').line(11, 20, 13, 24, 'k').line(19, 16, 21, 20, 'k').line(21, 20, 19, 24, 'k');
      d.line(13, 16, 19, 16, 'k').line(13, 24, 19, 24, 'k');
      d.line(11, 20, 5, 19, 'k').line(21, 20, 27, 19, 'k').line(16, 16, 16, 13, 'k').line(13, 24, 11, 26, 'k').line(19, 24, 21, 26, 'k');
      d.line(7, 22, 5, 17 + b, 'g', 4);
      d.ellipse(5.5, 12.5 + b, 5, 4.5, 'g');
      d.rect(1, 9 + b, 10, 1, '1').rect(1, 10 + b, 10, 1, '2');
      d.px(11, 10 + b, '3').px(12, 11 + b, '4').px(12, 9 + b, '3').px(13, 10 + b, '4');
      if (f) d.rect(2, 12 + b, 4, 1, 'X');
      else d.ellipse(4, 13, 1.6, 1.6, 'Q').px(3, 12, 'X').px(3, 13, 'X');
      d.line(1, 15 + b, 5, 16 + b, 'k');
    },
  },

  // allen mascot (PRD 517): Allen the Alien, a wide round pale-blue head with one big green-irised
  // eye, a green suit with white chest bands. He blinks and hovers a pixel higher, a shadow below.
  allen: {
    w: 32, h: 32,
    draw(d, f) {
      const u = f; // the hover
      d.rect(11, 26 - u, 4, 1, 'g').rect(10, 27 - u, 5, 2, 'n');
      d.poly([[6, 17 - u], [26, 17 - u], [22, 27 - u], [10, 27 - u]], 'g');
      d.poly([[11, 17 - u], [21, 17 - u], [19, 25 - u], [13, 25 - u]], 'X');
      d.poly([[4, 19 - u], [8, 17 - u], [8, 25 - u], [5, 25 - u]], 'g');
      d.ellipse(5.5, 26.5 - u, 2.4, 2.2, 'U');
      d.rect(11, 25 - u, 10, 2, 'n');
      d.mirror();
      d.rect(12, 19 - u, 8, 1, 'Q').rect(13, 21 - u, 6, 1, 'Q').rect(14, 23 - u, 4, 1, 'Q');
      d.rect(13, 14 - u, 6, 4, 'U');
      d.ellipse(16, 8 - u, 10, 8, 'U');
      if (f) d.rect(10, 8 - u, 12, 1, 'X').rect(11, 7 - u, 10, 1, 'U', 3);
      else {
        d.ellipse(16, 7.5 - u, 5.5, 4.5, 'Q');
        d.ellipse(16, 8 - u, 2.6, 2.8, 'g', 2).ellipse(16, 8 - u, 1.2, 1.4, 'X').px(15, 7 - u, 'Q');
      }
      d.line(12, 13 - u, 16, 14 - u, 'k').line(16, 14 - u, 20, 13 - u, 'k');
      if (f) d.ellipse(16, 31, 6, 0.8, 'n', 3);
    },
  },

  // robot mascot (PRD 517): a boxy retro steel robot, an antenna with a red light, cyan eyes behind a
  // dark visor, a mouth grille, the four stripes on a chest panel, rivets. The antenna light blinks
  // and the eyes brighten.
  robot: {
    w: 32, h: 32,
    draw(d, f) {
      d.rect(10, 25, 4, 4, 'A').rect(9, 28, 6, 3, 'n');
      d.rect(6, 15, 20, 11, 'L');
      d.rect(2, 16, 4, 8, 'A').rect(1, 23, 5, 3, 'n');
      d.mirror();
      d.rect(9, 4, 14, 10, 'L');
      d.rect(14, 13, 4, 2, 'A');
      d.rect(7, 7, 2, 4, 'A').rect(23, 7, 2, 4, 'A');
      d.rect(11, 6, 10, 4, 'X');
      d.rect(12, 7, 3, 2, 'C', f ? 0 : 1).rect(17, 7, 3, 2, 'C', f ? 0 : 1);
      d.rect(12, 11, 8, 2, 'A').pxs([[13, 11], [15, 11], [17, 11], [19, 11], [13, 12], [15, 12], [17, 12], [19, 12]], 'X');
      d.line(16, 4, 16, 2, 'A');
      d.ellipse(16.5, 1.5, 1.6, 1.4, f ? 'e' : 'R');
      if (f) d.pxs([[13, 0], [20, 0], [13, 2], [20, 2]], 'y');
      // The chest panel, in the stripes every suit wears.
      d.rect(10, 16, 12, 9, 'A');
      SUIT_STRIPES(d, 12, 17, 7);
      d.pxs([[7, 16], [24, 16], [7, 24], [24, 24], [10, 5], [21, 5], [10, 12], [21, 12]], 'k');
    },
  },

  // The player's hero (heroes.mjs recolours it): the OMNI-MAN body in two builds, a girl and a boy,
  // with or without a cape. The cape is the plasma material, recoloured per preset; the suit is W
  // (main) and N (trim); the belt buckle Y takes the fleet colour.
  'hero-girl': { w: 32, h: 48, draw: heroDraw(true, true) },
  'hero-boy': { w: 32, h: 48, draw: heroDraw(false, true) },
  'hero-girl-nc': { w: 32, h: 48, draw: heroDraw(true, false) },
  'hero-boy-nc': { w: 32, h: 48, draw: heroDraw(false, false) },

  // Entropy: the enemy. A spiked blob with glowing eyes and teeth, recoloured per wound kind.
  entropy: {
    w: 24, h: 24,
    draw(d, f) {
      d.poly([[5, 8], [6, 1 + f], [9, 6]], 'Z').poly([[10, 5], [12, 0 + f], [14, 5]], 'Z').poly([[15, 6], [18, 1 + f], [19, 8]], 'Z');
      d.ellipse(12, 13, 10, 8 - f * 0.6, 'Z');
      d.ellipse(6, 20.5, 2, 2.5 + f, 'Z').ellipse(12, 21, 2, 2 + (1 - f), 'Z').ellipse(18, 20.5, 2, 2.5 + f, 'Z');
      d.ellipse(8, 11, 2.2, 2, 'X').ellipse(16, 11, 2.2, 2, 'X');
      d.px(8, 11, 'e').px(7, 11, 'e').px(16, 11, 'e').px(15, 11, 'e');
      d.rect(7, 15, 10, 3, 'X').pxs([[8, 15], [10, 15], [12, 15], [14, 15], [16, 15], [9, 17], [11, 17], [13, 17], [15, 17]], 'Q');
    },
  },

  // Icons, 16×16.
  flag: { w: 16, h: 16, draw(d, f) { d.rect(3, 1, 2, 14, 'L').poly([[5, 2], [14, 3 + f], [13, 6], [14, 9 - f], [5, 9]], 'g').px(4, 1, 'Y').px(3, 1, 'Y'); } },
  hammer: { w: 16, h: 16, draw(d) { d.line(4, 13, 10, 5, 'D', 2.2).poly([[7, 2], [13, 3], [14, 7], [11, 8], [9, 5], [6, 5]], 'L'); } },
  fire: {
    w: 16, h: 16,
    draw(d, f) {
      d.poly([[8, 1 + f], [13, 8], [12, 14], [4, 14], [3, 8], [5, 5], [6, 8]], 'R');
      d.poly([[8, 5 + f], [11, 10], [10, 14], [6, 14], [5, 10]], 'O');
      d.ellipse(8, 12, 2, 2.2, 'Y', 0);
    },
  },
  lock: { w: 16, h: 16, draw(d) { d.ellipse(8, 6, 4.5, 5, 'L').ellipse(8, 6.5, 2.4, 3.4, null).rect(2, 7, 12, 8, 'Y').rect(7, 9, 2, 4, 'X'); } },
  skull: {
    w: 16, h: 16,
    draw(d) { d.ellipse(8, 7, 6.5, 6, 'F').rect(5, 11, 6, 4, 'F').ellipse(5.5, 7.5, 1.8, 2, 'X').ellipse(10.5, 7.5, 1.8, 2, 'X').px(8, 10, 'X').rect(6, 13, 1, 2, 'k').rect(9, 13, 1, 2, 'k'); },
  },
  beacon: {
    w: 16, h: 16,
    draw(d, f) {
      d.rect(7, 4, 2, 6, 'L').poly([[4, 15], [12, 15], [10, 9], [6, 9]], 'R');
      d.ellipse(8, 3, 2, 2, f ? 'e' : 'R');
      if (f) d.pxs([[3, 1], [2, 3], [3, 5], [12, 1], [13, 3], [12, 5]], 'e');
    },
  },
  coin: { w: 16, h: 16, draw(d, f) { d.ellipse(8, 8, f ? 3 : 6.5, 6.5, 'Y'); if (!f) d.rect(7, 4, 2, 8, 'Y', 2); } },
  check: { w: 16, h: 16, draw(d) { d.line(2, 8, 6, 12, 'g', 2.6).line(6, 12, 14, 3, 'g', 2.6); } },
  open: {
    w: 16, h: 16,
    draw(d, f) {
      const o = f;
      for (const [x, y, dx, dy] of [[1, 1, 1, 1], [14, 1, -1, 1], [1, 14, 1, -1], [14, 14, -1, -1]]) {
        d.rect(Math.min(x, x + dx * (3 - o)), y + (dy < 0 ? -0 : 0), 4 - o, 1, 'Y', 1);
        d.rect(x, Math.min(y, y + dy * (3 - o)), 1, 4 - o, 'Y', 1);
      }
      d.rect(7, 7, 2, 2, 'Y', 0);
    },
  },
  star: { w: 16, h: 16, draw(d, f) { const r = f ? 5 : 7; d.rect(7, 8 - r, 2, r * 2, 'C', 1).rect(8 - r, 7, r * 2, 2, 'C', 1).rect(7, 7, 2, 2, 'Q'); } },
  ship: {
    w: 16, h: 16,
    draw(d, f) {
      d.poly([[8, 1], [12, 9], [11, 13], [5, 13], [4, 9]], 'W').poly([[4, 9], [1, 13], [5, 12]], 'N').poly([[12, 9], [15, 13], [11, 12]], 'N');
      d.ellipse(8, 7, 1.6, 2, 'E').rect(6, 13, 4, 1 + f, 'C', 1).px(7, 15, 'P').px(8, 15, 'P');
    },
  },
  cursor: { w: 8, h: 8, draw(d) { d.rect(0, 0, 4, 1, 'Y', 1).rect(0, 0, 1, 4, 'Y', 1); }, outline: false },

  // The app sidebar's sections (issue 653), 16×16, drawn before each Dashboard and Work item's name.
  'menu-home': { w: 16, h: 16, draw(d, f) { // a domed habitat on a steel deck, a beacon on its mast
    d.ellipse(8, 12, 6, 7, 'E').rect(1, 12, 14, 3, 'L');
    d.rect(7, 13, 2, 2, 'X').rect(3, 8, 2, 2, 'Y').rect(11, 8, 2, 2, 'Y');
    d.rect(8, 1, 1, 4, 'L').px(8, 0 + f, f ? 'e' : 'R');
  } },
  'menu-fleet': { w: 16, h: 16, draw(d, f) { // a starship from above: a wide saucer, two long warp nacelles
    d.rect(1, 6, 2, 10, 'L').rect(13, 6, 2, 10, 'L').line(3, 12, 6, 11, 'L').line(12, 12, 9, 11, 'L');
    d.ellipse(8, 4, 6.5, 3.6, 'L').rect(7, 7, 2, 4, 'L').ellipse(8, 12, 2, 2.6, 'L');
    d.ellipse(8, 3.5, 1.5, 1.2, 'E').rect(1, 6, 2, 1, 'R', 1).rect(13, 6, 2, 1, 'R', 1);
    d.rect(1, 8, 1, 7, 'C', f ? 0 : 1).rect(14, 8, 1, 7, 'C', f ? 0 : 1);
  } },
  'menu-workspace': { w: 16, h: 16, draw(d, f) { // a ringed home world with a moon
    d.ellipse(8, 8, 5, 5, 'P').line(1, 11, 15, 5, 'Y').ellipse(8, 8, 5, 5, 'P');
    d.line(1, 11, 3, 10, 'Y').line(13, 6, 15, 5, 'Y').line(5, 11, 11, 8.5, 'Y');
    d.ellipse(14 - f, 2, 1.2, 1.2, 'L');
  } },
  'menu-engineering': { w: 16, h: 16, draw(d, f) { // a gear with a glowing core
    d.ellipse(8, 8, 5, 5, 'L');
    for (const [x, y] of [[7, 1], [7, 13], [1, 7], [13, 7]]) d.rect(x, y, 2, 2, 'L');
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) d.rect(x, y, 2, 2, 'L');
    d.ellipse(8, 8, 2.2, 2.2, f ? 'C' : 'O');
  } },
  'menu-prds': { w: 16, h: 16, draw(d, f) { // a rocket, flame flickering
    d.poly([[8, 0], [11, 4], [11, 11], [5, 11], [5, 4]], 'W').poly([[8, 0], [11, 4], [5, 4]], 'R');
    d.poly([[5, 8], [2, 12], [5, 11]], 'R').poly([[11, 8], [14, 12], [11, 11]], 'R');
    d.ellipse(8, 6.5, 1.4, 1.4, 'E').rect(6, 11, 4, 1, 'L');
    d.poly([[6, 12], [10, 12], [8, 15 + f]], 'O').rect(7, 12, 2, 1 + f, 'Y', 0);
  } },
  'menu-bugs': { w: 16, h: 16, draw(d, f) { // an alien bug: Entropy's cousin, six legs and feelers
    d.line(5, 3, 3, 0 + f, 'Z').line(10, 3, 12, 0 + f, 'Z');
    for (const y of [7, 10, 13]) { d.line(3, y, 1, y - 1 + f, 'Z').line(12, y, 14, y - 1 + f, 'Z'); }
    d.ellipse(8, 5, 3.5, 2.8, 'Z').ellipse(8, 11, 4.5, 4.5, 'Z');
    d.px(6, 5, 'e').px(9, 5, 'e').line(8, 8, 8, 15, 'k');
  } },
  'menu-visual': { w: 16, h: 16, draw(d, f) { // a hero's brush, dripping the four stripes
    d.line(13, 1, 8, 7, 'P', 2.2).rect(6, 7, 3, 3, 'L').poly([[6, 9], [9, 10], [5, 14], [2, 14], [3, 12]], 'Y');
    d.px(2, 14, '1').px(3, 14, '2').px(4, 14, '3').px(5, 13, '4');
    d.px(1, 15 - f, '1').px(4, 15, '3');
  } },
  'menu-questions': { w: 16, h: 16, draw(d, f) { // the ? block, its question mark casting a shadow
    const mark = [[6, 4], [7, 3], [8, 3], [9, 3], [10, 4], [10, 5], [9, 6], [8, 7], [8, 8], [8, 10], [7, 4], [7, 8], [7, 11]];
    d.rect(1, 1, 14, 14, 'Y').pxs([[2, 2], [13, 2], [2, 13], [13, 13]], 'D');
    d.pxs(mark.map(([x, y]) => [x + 1, y + 1]), 'X').pxs(mark, 'Q');
    if (f) d.rect(1, 1, 14, 1, 'Y', 0);
  } },
  'menu-knowledge': { w: 16, h: 16, draw(d, f) { // a tome of the loop's lore, a star on its cover
    d.rect(3, 1, 11, 14, 'N').rect(3, 1, 2, 14, 'n').rect(13, 2, 1, 12, 'F');
    d.pxs([[5, 1], [12, 1], [5, 14], [12, 14]], 'Y', 1);
    d.rect(8, 4, 1, 7, 'Y').rect(5, 7, 7, 1, 'Y').rect(7, 6, 3, 3, 'Y').px(8, 7, f ? 'y' : 'Q');
  } },
  // The foot's Settings entry (PRD 733): a gold cog, its hub a dark hole, a spark turning on its rim.
  'menu-settings': { w: 16, h: 16, draw(d, f) {
    d.ellipse(8, 8, 5, 5, 'Y');
    for (const [x, y] of [[7, 1], [7, 13], [1, 7], [13, 7]]) d.rect(x, y, 2, 2, 'Y');
    for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) d.rect(x, y, 2, 2, 'Y');
    d.ellipse(8, 8, 1.8, 1.8, 'X');
    d.px(f ? 11 : 5, f ? 6 : 5, 'y');
  } },
  // Super Omni World's tiles (PRD 817): 16×16 squares with no hole and no outline, so a row of
  // them tiles without a seam. Each is drawn in the grass palette, the first stage's; the other
  // stages recolour their materials (STAGE_PALETTES).
  'tile-ground': { w: 16, h: 16, outline: false, draw(d) { // grass over soil
    soil(d);
    d.rect(0, 0, 16, 1, 'g', 0).rect(0, 1, 16, 2, 'g', 1).rect(0, 3, 16, 1, 'g', 2);
    d.pxs([[1, 4], [2, 4], [6, 4], [10, 4], [11, 4], [14, 4]], 'g', 2).pxs([[3, 1], [8, 2], [13, 1]], 'g', 0);
  } },
  'tile-soil': { w: 16, h: 16, outline: false, draw(d) { soil(d); } },
  'tile-brick': { w: 16, h: 16, outline: false, draw(d) { // four courses, the joints staggered
    d.rect(0, 0, 16, 16, 'O', 2);
    for (let c = 0; c < 4; c++) {
      const y = c * 4;
      d.rect(0, y, 16, 1, 'O', 1).rect(0, y + 3, 16, 1, 'D', 3);
      for (const x of c % 2 ? [3, 11] : [7, 15]) d.rect(x, y, 1, 3, 'D', 3);
    }
  } },
  'tile-block': { w: 16, h: 16, outline: false, draw(d, f) { // the ? block, its mark catching the light
    const mark = [[6, 4], [7, 3], [8, 3], [9, 3], [10, 4], [10, 5], [9, 6], [8, 7], [8, 8], [8, 10], [7, 4], [7, 8], [7, 11]];
    blockFrame(d, 'Y');
    d.pxs(mark.map(([x, y]) => [x + 1, y + 1]), 'X').pxs(mark, 'Q');
    if (f) d.rect(2, 1, 12, 1, 'Y', 0);
  } },
  'tile-block-empty': { w: 16, h: 16, outline: false, draw(d) { blockFrame(d, 'D'); } },
  'tile-pipe-top-l': { w: 16, h: 16, outline: false, draw(d) { pipe(d, 'l', true); } },
  'tile-pipe-top-r': { w: 16, h: 16, outline: false, draw(d) { pipe(d, 'r', true); } },
  'tile-pipe-l': { w: 16, h: 16, outline: false, draw(d) { pipe(d, 'l', false); } },
  'tile-pipe-r': { w: 16, h: 16, outline: false, draw(d) { pipe(d, 'r', false); } },
  'tile-stone': { w: 16, h: 16, outline: false, draw(d) { // castle stone: two dressed blocks, lit edges
    d.rect(0, 0, 16, 16, 'A', 1);
    for (const y of [0, 8]) {
      const x = y ? 0 : 8;
      d.rect(0, y, 16, 1, 'A', 0).rect(0, y + 7, 16, 1, 'A', 3);
      d.rect(x, y, 1, 7, 'A', 0).rect((x + 15) % 16, y, 1, 7, 'A', 3);
      d.pxs([[3, y + 3], [11, y + 4], [6, y + 5]], 'A', 2);
    }
  } },
});

// The tiles' shared parts: the soil under the grass, a block's riveted frame, a pipe's half.
function soil(d) {
  d.rect(0, 0, 16, 16, 'B', 1);
  d.pxs([[3, 7], [12, 6], [7, 11], [1, 13], [13, 14]], 'B', 2).pxs([[4, 7], [8, 11], [14, 14]], 'B', 3).pxs([[11, 9], [5, 14]], 'B', 0);
}

function blockFrame(d, m) {
  d.rect(0, 0, 16, 16, 'D', 3).rect(1, 1, 14, 14, m, 1);
  d.rect(1, 1, 14, 1, m, 0).rect(1, 1, 1, 14, m, 0).rect(1, 14, 14, 1, m, 2).rect(14, 1, 1, 14, m, 2);
  d.pxs([[2, 2], [13, 2], [2, 13], [13, 13]], 'D', 3);
}

function pipe(d, side, top) {
  const left = side === 'l';
  d.rect(0, 0, 16, 16, 'g', 1);
  if (left) d.rect(0, 0, 1, 16, 'g', 3).rect(1, 0, 3, 16, 'g', 0);
  else d.rect(10, 0, 4, 16, 'g', 2).rect(14, 0, 2, 16, 'g', 3);
  if (top) d.rect(0, 0, 16, 1, 'g', 3).rect(0, 6, 16, 2, 'g', 3).rect(left ? 1 : 0, 1, left ? 15 : 14, 1, 'g', 0);
}

/** Super Omni World's tiles, in the order its tileset lays them out (PRD 817). */
export const TILES = Object.freeze([
  'tile-ground', 'tile-soil', 'tile-brick', 'tile-block', 'tile-block-empty',
  'tile-pipe-top-l', 'tile-pipe-top-r', 'tile-pipe-l', 'tile-pipe-r', 'tile-stone',
]);

/**
 * Each stage's palette, as a tint over the tiles' materials: grass is the tiles as drawn, the first
 * stage's; a later stage's palette recolours the grass and the pipes (`g`), the soil (`B`), the
 * bricks (`O`, and `D`, their joints and the blocks' frames) and castle stone (`A`), from the forge's
 * own ramps. The ? block's gold (`Y`) is never recoloured: it reads the same in every stage.
 */
export const STAGE_PALETTES = Object.freeze({
  grass: Object.freeze({}),
  // 1-2: cave moss and teal pipes over blue-grey rock, bricks in cold slate.
  underground: Object.freeze({ g: RAMPS.K, B: RAMPS.n, O: RAMPS.J, D: RAMPS.H, A: RAMPS.J }),
  // 1-3: steel-grey battlements over dark stone, bricks in castle red, stone in the castle's grey.
  castle: Object.freeze({ g: RAMPS.L, B: RAMPS.H, O: RAMPS.R, D: RAMPS.H }),
});

// The mascot library: every fleet mascot drawn above, the keys an owner may pick for a fleet, in the
// order the picker shows them. A fleet stores its pick in public.teams › mascot, and the database
// accepts the keys public.fleet_mascots() returns: mascots.test.mjs fails when the newest migration
// defining it lists other keys, or another order. A fleet with none is drawn as a hero in its colour
// (heroes.mjs › fleetSprite).
export const MASCOTS = Object.freeze([
  'beaver', 'octopod', 'picsou', 'cia', 'pirate', 'invincible',
  'atom-eve', 'shark', 'turtle', 'allen', 'robot', // PRD 517
]);

// Entropy recoloured per wound kind (spec §5.3): the shape is the enemy, the colour says which one.
// `ramp` replaces the Entropy material; `p` is the bright tone for map specks and labels.
export const WOUND_TINT = Object.freeze({
  transmission: { p: '#6ff0ff', ramp: ['#c8fbff', '#3fb8d8', '#1f6f98', '#0e3a5c'] },
  'unconfirmed-ground': { p: '#ffb347', ramp: ['#ffe0a8', '#f08a2a', '#b0540e', '#5e2a06'] },
  beacon: { p: '#ff3b5c', ramp: ['#ffb0bc', '#e8284c', '#a0122e', '#5a0818'] },
  'fault-line': { p: '#ffd84a', ramp: ['#fff2a0', '#e0b420', '#9a7408', '#4e3a04'] },
  'under-fire': { p: '#ff9b30', ramp: ['#ffd0a0', '#ff7a1a', '#c2410c', '#6a1e04'] },
  aftershock: { p: '#ff3b5c', ramp: ['#e080a0', '#9a1440', '#5e0a28', '#300414'] },
});

export const woundTint = (kind) => ({ Z: WOUND_TINT[kind].ramp });
