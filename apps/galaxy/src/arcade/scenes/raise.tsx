'use client';
// NO FLEETS YET — RAISE YOUR OWN! (PRD 400): what a fleet screen shows when the workspace has no
// fleets, an invitation rather than a dead end. Every mascot marches across it; the workspace's owner
// reads where fleets are set up, and a member whom to ask.
import { MASCOTS } from '../fleets';
import { Sprite } from '../Sprite';
import './common.css';
import './raise.css';

/** Where the workspace's owner sets up its fleets. */
export const FLEETS_PAGE = '/app/settings/fleets';

export function RaiseOverlay({ owner }: { owner: boolean }) {
  return (
    <div className="j-center raise">
      <p className="j-h raise-h">NO FLEETS YET — RAISE YOUR OWN!</p>
      <div className="raise-parade" aria-hidden="true">
        {MASCOTS.map((m) => <Sprite key={m} name={m} scale={1} animate />)}
      </div>
      {owner
        ? <p className="j-txt">SET THEM UP AT <a href={FLEETS_PAGE}>{FLEETS_PAGE}</a></p>
        : <p className="j-txt">ASK YOUR OWNER</p>}
      <p className="j-txt j-dim">Until then, every hero flies solo.</p>
    </div>
  );
}
