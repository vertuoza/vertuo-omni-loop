'use client';
import { Select } from '@omni/ui';
import { useRef } from 'react';
import type { ArtifactKind } from '../store';
import type { VersionEntry } from './view';

// An artifact tab's version picker (PRD 216): its versions newest first, each named by its number, day
// and source. A GET form to the same page, keeping the tab — every tab, since the default one depends on
// whether a question was asked (PRD 384) — so it works before any script runs (the Show button); once
// the page runs, picking a version shows it at once. A visual fix's Variations picks a round (PRD 627),
// and the Proof tab a run (PRD 798).

type Props = { action: string; tab: ArtifactKind | 'proof'; versions: VersionEntry[]; shown: number; noun?: 'Version' | 'Round' | 'Run' };

export function VersionPicker({ action, tab, versions, shown, noun = 'Version' }: Props) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} className="dossier-picker" method="get" action={action}>
      <input type="hidden" name="tab" value={tab} />
      <div className="dossier-picker-field">
        <span className="ask-hint">{noun}</span>
        <Select
          size="sm"
          label={noun}
          name="v"
          defaultValue={String(shown)}
          options={versions.map((v) => ({ value: String(v.number), label: v.label }))}
          onValueChange={() => { setTimeout(() => { form.current?.requestSubmit(); }, 0); }}
        />
      </div>
      <button type="submit" className="ask-button quiet">Show</button>
    </form>
  );
}
