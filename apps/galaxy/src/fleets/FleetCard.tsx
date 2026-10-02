import type { ReactNode } from 'react';
import { fleetSprite, spritePixels } from '@omni/design';
import type { FleetRow } from '../arcade/types';
import { cssVars } from '../arcade/css-vars';
import { pixelSvg } from '../design/pixel-svg';
import { NEUTRAL } from './model';

// A fleet's card on /app/settings/fleets (PRD 400 s3): its mascot drawn on the server as a pixel SVG (a fleet
// with none is a hero in its colour, as the arcade draws it: fleetSprite()), its label and its motto,
// edged in its colour. The form's live preview is one of these, drawn from the form.

const HEX = /^#[0-9a-f]{6}$/i;

/** A mascot as a crisp SVG string, `title` its accessible name. */
export function mascotSvg(mascot: string | null, color: string, title: string, scale = 2): string {
  const { sprite, tint } = fleetSprite(mascot, color);
  return pixelSvg(spritePixels(sprite, { tint }), { scale, title });
}

export function FleetCard({ fleet, children }: { fleet: FleetRow; children?: ReactNode }) {
  const color = HEX.test(fleet.color) ? fleet.color.toLowerCase() : NEUTRAL;
  return (
    <article className="fleet-card" style={cssVars({ '--fleet': color })}>
      <span className="fleet-card-mascot" dangerouslySetInnerHTML={{ __html: mascotSvg(fleet.mascot, color, fleet.label) }} />
      <div className="fleet-card-body">
        <h3 className="fleet-card-label">{fleet.label}</h3>
        {fleet.motto && <p className="fleet-card-motto">{fleet.motto}</p>}
      </div>
      {children}
    </article>
  );
}
