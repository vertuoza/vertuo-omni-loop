// The canvas dispatcher: draws the scene the arcade is on with the group that owns it, on the grid
// the frame names (`FrameState.grid`: the wide one, or the tall one for a scene its group lists as
// tall). Each group keeps its canvas drawing in `scenes/<group>.ts`, with its list of tall scenes and
// its page counts, its text layer in `scenes/<group>.tsx` and its styles in `scenes/<group>.css`;
// what two groups share lives in `scenes/common.*`.
import { drawBoot, drawHeroes, drawStory, drawTitle } from './attract.ts';
import { drawChart, drawSystem } from './chart.ts';
import { drawFleets } from './fleets.ts';
import { drawGames, drawPlatformer } from './games.ts';
import { drawInvaders } from './invaders.ts';
import { drawLevelUp } from './levelup.ts';
import { drawAway, drawCoin, drawGate, drawIntro, drawReady, drawWelcome } from './join.ts';
import { drawMap } from './map.ts';
import { drawBriefing, drawMenu } from './menu.ts';
import { drawPlanetScene } from './planet.ts';
import { drawBuilder, drawName, drawSelect } from './recruit.ts';
import type { FrameState } from './common.ts';

export {
  H, TALL, W, WIDE, type ChartFrame, type FrameState, type Grid, type GridName, type JoinFrame, type MapSlot, type PageCount, type Pages,
  type SceneName,
} from './common.ts';
export { layoutMap, neighbour } from './map.ts';
export {
  chartKey, chartStep, layoutChart, layoutSystem, orbitStep, sunAt, worldAt, type ChartLayout, type ChartSource, type SystemLayout,
} from './chart-layout.ts';

export function drawFrame(ctx: CanvasRenderingContext2D, s: FrameState, titlePhase: 'title' | 'story' | 'hiscore') {
  ctx.imageSmoothingEnabled = false;
  switch (s.scene) {
    case 'boot': { drawBoot(ctx, s); return; }
    case 'title': {
      if (titlePhase === 'story') drawStory(ctx, s);
      else if (titlePhase === 'hiscore') drawHeroes(ctx, s);
      else drawTitle(ctx, s);
      return;
    }
    case 'menu': { drawMenu(ctx, s); return; }
    case 'map': { drawMap(ctx, s); return; }
    case 'planet': { drawPlanetScene(ctx, s); return; }
    case 'fleets': { drawFleets(ctx, s); return; }
    case 'heroes': { drawHeroes(ctx, s); return; }
    case 'briefing': { drawBriefing(ctx, s); return; }
    case 'coin': { drawCoin(ctx, s); return; }
    case 'away': { drawAway(ctx, s); return; }
    case 'gate': case 'outsider': { drawGate(ctx, s); return; }
    case 'intro': { drawIntro(ctx, s); return; }
    case 'select': { drawSelect(ctx, s); return; }
    case 'name': { drawName(ctx, s); return; }
    case 'hero': { drawBuilder(ctx, s); return; }
    case 'ready': { drawReady(ctx, s); return; }
    case 'welcome': { drawWelcome(ctx, s); return; }
    case 'chart': { drawChart(ctx, s); return; }
    case 'system': { drawSystem(ctx, s); return; }
    case 'games': { drawGames(ctx, s); return; }
    case 'invaders': { drawInvaders(ctx, s); return; }
    case 'platformer': { drawPlatformer(ctx, s); return; }
    case 'levelup': { drawLevelUp(ctx, s); return; }
  }
}
