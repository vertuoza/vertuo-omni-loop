'use client';
import type { ArtifactKind } from '../store';
import type { VersionEntry } from './view';

// An artifact tab's version picker (PRD 216): its versions newest first, each named by its number, day
// and source. A GET form to the same page, keeping the tab — every tab, since the default one depends on
// whether a question was asked (PRD 384) — so it works before any script runs (the Show button); once
// the page runs, picking a version shows it at once. A visual fix's Variations picks a round (PRD 627).

type Props = { action: string; tab: ArtifactKind; versions: VersionEntry[]; shown: number; noun?: 'Version' | 'Round' };

export function VersionPicker({ action, tab, versions, shown, noun = 'Version' }: Props) {
  return (
    <form className="dossier-picker" method="get" action={action}>
      <input type="hidden" name="tab" value={tab} />
      <label className="dossier-picker-field">
        <span className="ask-hint">{noun}</span>
        <select className="ask-share-pick" name="v" defaultValue={String(shown)} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          {versions.map((v) => <option key={v.number} value={String(v.number)}>{v.label}</option>)}
        </select>
      </label>
      <button type="submit" className="ask-button quiet">Show</button>
    </form>
  );
}
