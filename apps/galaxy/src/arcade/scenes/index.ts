// The canvas dispatcher: draws the scene the arcade is on with the group that owns it. Each group
// keeps its canvas drawing in `scenes/<group>.ts`, its text layer in `scenes/<group>.tsx` and its
// styles in `scenes/<group>.css`; what two groups share lives in `scenes/common.*`.
import { drawBoot, drawHeroes, drawStory, drawTitle } from './attract.ts';
import { drawFleets } from './fleets.ts';
import { drawAway, drawCoin, drawGate, drawIntro, drawLink, drawReady, drawWelcome } from './join.ts';
import { drawMap } from './map.ts';
import { drawBriefing, drawMenu } from './menu.ts';
import { drawPlanetScene } from './planet.ts';
import { drawBuilder, drawName, drawSelect } from './recruit.ts';
import type { FrameState } from './common.ts';

export { H, W, type FrameState, type JoinFrame, type MapSlot, type SceneName } from './common.ts';
export { layoutMap, neighbour } from './map.ts';

export function drawFrame(ctx: CanvasRenderingContext2D, s: FrameState, titlePhase: 'title' | 'story' | 'hiscore') {
  ctx.imageSmoothingEnabled = false;
  switch (s.scene) {
    case 'boot': return drawBoot(ctx, s);
    case 'title': return titlePhase === 'story' ? drawStory(ctx, s) : titlePhase === 'hiscore' ? drawHeroes(ctx, s) : drawTitle(ctx, s);
    case 'menu': return drawMenu(ctx, s);
    case 'map': return drawMap(ctx, s);
    case 'planet': return drawPlanetScene(ctx, s);
    case 'fleets': return drawFleets(ctx, s);
    case 'heroes': return drawHeroes(ctx, s);
    case 'briefing': return drawBriefing(ctx, s);
    case 'coin': return drawCoin(ctx, s);
    case 'away': return drawAway(ctx, s);
    case 'gate': case 'outsider': return drawGate(ctx, s);
    case 'intro': return drawIntro(ctx, s);
    case 'select': return drawSelect(ctx, s);
    case 'name': return drawName(ctx, s);
    case 'hero': return drawBuilder(ctx, s);
    case 'link': return drawLink(ctx, s);
    case 'ready': return drawReady(ctx, s);
    case 'welcome': return drawWelcome(ctx, s);
  }
}
