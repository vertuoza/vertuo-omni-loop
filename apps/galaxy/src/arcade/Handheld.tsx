'use client';
// The Game Boy, held upright: the lens with the tall screen in it, the wordmark, and the controls
// under the thumbs (the D-pad, A and B on the diagonal, SELECT and START, the speaker grille). The
// body fills the phone edge to edge; the controls keep their size and the lens takes the height
// that is left (shell.css). The lens and the wordmark are the Advance body's too. With an app to
// leave for, the GAME ▮▯ APP switch sits at the right end of the wordmark row.
import type { ReactNode } from 'react';
import { AppSwitch, DPad, FaceButton, Grille, Pill, useHoldStill } from './Controls';
import type { Action } from './keys';

export interface BodyProps {
  season: string | null;
  muted: boolean;
  onAction: (action: Action) => void;
  onSound: () => void;
  /** Asks to leave for the app (OPEN THE APP?), from the GAME ▮▯ APP switch. None, no switch: the artifact has no app. */
  onApp?: () => void;
  /** OPEN THE APP? is up: the switch's knob shows APP. */
  leaving?: boolean;
}

/**
 * The lens around the screen: a navy bezel with its stripe label, and the power LED, lit while sound
 * is on. On `full` it is bare, and the screen fills the window. The screen stays the lens's last
 * child in every form, so turning the phone keeps it on screen as it is.
 */
export function Lens({ bare, muted, children }: { bare: boolean; muted: boolean; children: ReactNode }) {
  return (
    <div className="gb-lens">
      {!bare && (
        <>
          <p className="gb-stripe" aria-hidden="true">OMNI LOOP · GALAXY COLOR</p>
          <span className={`gb-led${muted ? '' : ' on'}`} role="img" aria-label={muted ? 'Sound off' : 'Sound on'} />
        </>
      )}
      {children}
    </div>
  );
}

export function Wordmark({ season }: { season: string | null }) {
  return (
    <p className="gb-word">
      OMNI LOOP{season && <small>SEASON {season}</small>}
    </p>
  );
}

export function Handheld({ season, muted, onAction, onSound, onApp, leaving = false }: BodyProps) {
  useHoldStill();
  return (
    <>
      <Wordmark season={season} />
      {onApp && <AppSwitch leaving={leaving} onApp={onApp} />}
      <div className="gb-pad" role="group" aria-label="Controller">
        <DPad onAction={onAction} />
        <div className="gb-ab">
          <FaceButton action="b" onAction={onAction} />
          <FaceButton action="a" onAction={onAction} />
        </div>
        <div className="gb-pills">
          <Pill action="select" onAction={onAction} />
          <Pill action="start" onAction={onAction} />
        </div>
        <Grille muted={muted} onToggle={onSound} />
      </div>
    </>
  );
}
