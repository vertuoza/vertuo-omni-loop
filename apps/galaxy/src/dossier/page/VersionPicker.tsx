'use client';
import { Select } from '@omni/ui';
import { useRef } from 'react';
import type { ArtifactKind } from '../store';
import type { VersionEntry } from './view';

// An artifact tab's version picker (PRD 216), drawn in omni-loop-20 s11 as one button: the version shown with
// its date and who sent it, opening the list of versions, newest first, each a link to its own address (the
// tab and segment of the new page, `?tab=specifications&segment=spec&v=2`), so it works before any script
// runs and has no Show button. A fix's page keeps its form to the same page (a visual fix's Variations picks
// a round, PRD 627), and the Proof tab (PRD 798) its form until omni-loop-20 s13 draws it.

type Props = { action: string; tab: ArtifactKind | 'proof'; versions: VersionEntry[]; shown: number; noun?: 'Version' | 'Round' | 'Run'; /** The one-button picker of a PRD's Specifications and User voice; a fix's page and the Proof tab keep their form. */ button?: boolean };

/** The form picker: a GET form to the same page, submitted when a round is picked. */
function FormPicker({ action, tab, versions, shown, noun }: Props & { noun: string }) {
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

export function VersionPicker(props: Props) {
  const { versions, shown, noun = 'Version' } = props;
  if (!props.button) return <FormPicker {...props} noun={noun} />;
  const current = versions.find((v) => v.number === shown) ?? versions[0];
  if (!current) return null;
  return (
    <details className="dossier-version">
      <summary className="dossier-version__button" aria-label={`${noun}: ${current.label}. Show the list of ${noun.toLowerCase()}s`}>
        <span className="dossier-version__noun">{noun}</span>
        <span className="dossier-version__label">{current.label}</span>
      </summary>
      <ul className="dossier-version__list" aria-label={`${noun}s`}>
        {versions.map((v) => (
          <li key={v.number}>
            <a href={v.href} aria-current={v.number === shown ? 'true' : undefined}>{v.label}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
