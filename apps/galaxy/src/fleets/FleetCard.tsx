import type { ReactNode } from 'react';
import { fleetSprite, spritePixels } from '@omni/design';
import { cssVars } from '../arcade/css-vars';
import { pixelSvg } from '../design/pixel-svg';
import { NEUTRAL, noteTitle, projectOf, type Fleet } from './model';

// A fleet's card on /app/settings/fleets (PRD 400 s3): its mascot drawn on the server as a pixel SVG (a fleet
// with none is a hero in its colour, as the arcade draws it: fleetSprite()), its label and its motto,
// edged in its colour. The form's live preview is one of these, drawn from the form.

const HEX = /^#[0-9a-f]{6}$/i;

/** A mascot as a crisp SVG string, `title` its accessible name. */
export function mascotSvg(mascot: string | null, color: string, title: string, scale = 2): string {
  const { sprite, tint } = fleetSprite(mascot, color);
  return pixelSvg(spritePixels(sprite, { tint }), { scale, title });
}

/** `Board: <org> project <number>`, linked, and the App's last note under it (PRD 2530); a fleet with no
 * board shows neither. The note is muted, in the error colour when it says `Not added:`, its full reason
 * as its title, and carries the day it was written. */
function Board({ board }: { board: NonNullable<Fleet['board']> }) {
  const project = projectOf(board.url);
  const refused = board.note?.startsWith('Not added:') ?? false;
  return (
    <>
      <p className="fleet-card-board">
        Board: {project ? <a href={board.url} rel="noreferrer">{project.org} project {project.number}</a> : board.url}
      </p>
      {board.note && (
        <p className="fleet-card-note" data-refused={refused || undefined} title={noteTitle(board.note)}>
          {board.note}
          {board.notedAt && <> · <time dateTime={board.notedAt}>{board.notedAt.slice(0, 10)}</time></>}
        </p>
      )}
    </>
  );
}

export function FleetCard({ fleet, children }: { fleet: Fleet; children?: ReactNode }) {
  const color = HEX.test(fleet.color) ? fleet.color.toLowerCase() : NEUTRAL;
  return (
    <article className="fleet-card" style={cssVars({ '--fleet': color })}>
      <span className="fleet-card-mascot" dangerouslySetInnerHTML={{ __html: mascotSvg(fleet.mascot, color, fleet.label) }} />
      <div className="fleet-card-body">
        <h3 className="fleet-card-label">{fleet.label}</h3>
        {fleet.motto && <p className="fleet-card-motto">{fleet.motto}</p>}
        {fleet.board && <Board board={fleet.board} />}
      </div>
      {children}
    </article>
  );
}
