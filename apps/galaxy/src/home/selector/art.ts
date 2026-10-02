// The two pedestals' pictures on SELECT YOUR APP (PRD 932): @omni/design's `code-mark` for the Omni
// app, sober and still, and its `arcade-cabinet` for the Arcade, both frames, which the overlay
// alternates while motion is allowed. Each is an SVG string, crisp at a whole-number scale.
import { spritePixels } from '@omni/design';
import { pixelSvg } from '../../design/pixel-svg';

/** The Omni app's sprite: a two-tone `</>`, cyan on slate, no face and no animation. */
const CODE_MARK = 'code-mark' as const;
/** The Arcade's sprite: a cabinet with its marquee, screen, joystick and buttons. */
const CABINET = 'arcade-cabinet' as const;

/** The scale each is drawn at, so the two stand about the same height on their pedestals. */
const SCALE = { [CODE_MARK]: 6, [CABINET]: 7 } as const;

/** The `</>`, frame 0 only: the serious one never moves. */
export function codeMarkSvg(): string {
  return pixelSvg(spritePixels(CODE_MARK, { frame: 0 }), { scale: SCALE[CODE_MARK], title: 'The Omni app: a pixel </> mark' });
}

/** The cabinet's two frames, its screen and buttons lit in turn. */
export function cabinetSvgs(): readonly string[] {
  return [0, 1].map((frame) =>
    pixelSvg(spritePixels(CABINET, { frame }), { scale: SCALE[CABINET], title: 'The Arcade: a pixel arcade cabinet' }));
}
