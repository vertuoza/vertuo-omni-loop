// The whole video as a pure function of its frame (PRD 1108 s4): the ground, every scene on screen at
// that frame (two in an overlap, crossfading), and the logo, on a 1920×1080 stage.
import type { ReactNode } from 'react';
import { EngineProvider, SceneSequence } from './core.tsx';
import type { Engine } from './core.tsx';
import { SceneView } from './scenes.tsx';
import { Background, Logo } from './stage.tsx';

export function Video({ engine, frame }: { engine: Engine; frame: number }): ReactNode {
  const { timeline, palette, fonts } = engine;
  return (
    <EngineProvider engine={engine} frame={frame}>
      <div style={{ position: 'relative', width: timeline.width, height: timeline.height, overflow: 'hidden', fontFamily: fonts.text.stack, color: palette.ink }}>
        <Background />
        {timeline.scenes.map((scene) => (
          <SceneSequence key={scene.index} scene={scene}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <SceneView scene={scene.scene} />
            </div>
          </SceneSequence>
        ))}
        <Logo />
      </div>
    </EngineProvider>
  );
}
