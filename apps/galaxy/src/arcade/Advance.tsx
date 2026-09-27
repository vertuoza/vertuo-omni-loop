'use client';
// The Game Boy Advance style body, for a phone held sideways: the same parts as the Game Boy, laid
// out wide. The D-pad with SELECT and START under it on the left wing, A and B with the grille under
// them on the right wing, and the lens with the wide screen between them. No L or R: the game has no
// L or R action, and a button that does nothing would confuse. With an app to leave for, the
// GAME ▮▯ APP switch sits under the grille, on the right wing.
import { AppSwitch, DPad, FaceButton, Grille, Pill, useHoldStill } from './Controls';
import { Wordmark, type BodyProps } from './Handheld';

export function Advance({ season, muted, onAction, onSound, onApp, leaving = false }: BodyProps) {
  useHoldStill();
  return (
    <>
      <div className="gb-wing gb-wing-left" role="group" aria-label="Controller, left">
        <DPad onAction={onAction} />
        <div className="gb-pills">
          <Pill action="select" onAction={onAction} />
          <Pill action="start" onAction={onAction} />
        </div>
      </div>
      <div className="gb-wing gb-wing-right" role="group" aria-label="Controller, right">
        <div className="gb-ab">
          <FaceButton action="b" onAction={onAction} />
          <FaceButton action="a" onAction={onAction} />
        </div>
        <Grille muted={muted} onToggle={onSound} />
        {onApp && <AppSwitch leaving={leaving} onApp={onApp} />}
      </div>
      <Wordmark season={season} />
    </>
  );
}
