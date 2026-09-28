import type { CSSProperties } from 'react';
import { heroLook, spritePixels } from '@omni/design';
import { pixelSvg } from '../design/pixel-svg';
import { ARCADE, CouldNotLoad, LinkGithub } from './Notes';
import { UNREADABLE, type Read } from './part';
import type { Season } from './season';
import { SOLO, type Score, type YouValue } from './you';

// The hero block (PRD 328): your hero, drawn on the server as a pixel SVG in your fleet's colour (as
// /design draws its sprites: no script, no canvas), then your name, the page's one heading, your
// fleet (SOLO for a player with none, PRD 400), your season's points and your two places. A member
// with no player row gets, in its place, the card that sends them to the arcade to play; a figure
// that cannot be read or counted says why, and nothing else of the block goes with it.

const COUNT = new Intl.NumberFormat('en-US');

/** A fleet's colour, only when it is one: it goes into a style attribute. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function Figures({ score, season }: { score: Score | 'unreadable' | 'no-github'; season: Season }) {
  if (score === UNREADABLE) return <CouldNotLoad />;
  if (score === 'no-github') return <LinkGithub />;
  const you = score.you ? `You #${score.you.rank} of ${score.you.of}` : 'No points yet this season';
  const fleet = score.fleet ? ` · ${score.fleet.label} #${score.fleet.rank} of ${score.fleet.of}` : '';
  return (
    <>
      <p className="dash-points"><b>{COUNT.format(score.points)}</b> pts · {season.name} season</p>
      <p className="dash-places">{you}{fleet}</p>
    </>
  );
}

export function You({ name, you, season }: { name: string; you: Read<YouValue>; season: Season }) {
  const heading = <h1 id="dash-name" className="dash-name">{name}</h1>;
  if (you === UNREADABLE || you.kind === 'no-player') {
    return (
      <section className="dash-you" aria-labelledby="dash-name">
        <div className="dash-who">
          {heading}
          {you === UNREADABLE
            ? <CouldNotLoad />
            : <p className="dash-join"><a href={ARCADE}>Play in the arcade to get your hero and your score</a></p>}
        </div>
      </section>
    );
  }
  const fleet = you.fleet === SOLO ? null : you.fleet;
  const colour = fleet && HEX.test(fleet.color) ? fleet.color : undefined;
  const look = heroLook(you.hero, colour);
  const svg = pixelSvg(spritePixels(look.sprite, { tint: look.tint }), { scale: 2, title: `${name}’s hero` });
  return (
    <section className="dash-you" aria-labelledby="dash-name">
      <span className="dash-hero" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="dash-who">
        {heading}
        {fleet && (
          <p className="dash-fleet" style={colour ? ({ '--dash-fleet': colour } as CSSProperties) : undefined}>
            <span className="dash-fleet-pip" aria-hidden="true" />
            <span><span className="dash-fleet-name">{fleet.label}</span> fleet</span>
          </p>
        )}
        {you.fleet === SOLO && <p className="dash-fleet"><span className="dash-fleet-name">SOLO</span></p>}
        <Figures score={you.score} season={season} />
      </div>
    </section>
  );
}
