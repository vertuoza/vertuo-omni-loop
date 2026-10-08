'use client';
import { useState, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../../supabase/database.types.ts';
import { clientEnv } from '../../env.client';
import { LANES, type Idea, type Lane } from '../model';
import { IDEAS } from '../words';
import { archiveIdea, brainstormLine, submitIdea, type IdeaForm, type MembersPort } from './members';
import { membersPort } from './store';
import { MEMBERS } from './words';
import './members.css';

// A member's controls on an ideas board (PRD 1246, s4): Add an idea above the lanes, and on each card
// Edit (its title, pitch, lane and PRD number) and Archive. The board renders them only for a member
// of its workspace (ideas_board()'s `member`); the database refuses anyone else's write anyway. Each
// form is a <details> that opens in place, so the server draws it whole and the page reads the same
// with no script. A save reloads the board, which reads its order again; a refusal stays on the form
// in plain words. Every card, a member's or not, also shows its "Brainstorm this" line to copy.

/** The browser's writes as the signed-in member; null for the demo, which has no database. */
function browserPort(): MembersPort | null {
  const supabase = clientEnv().supabase;
  return supabase ? membersPort(createBrowserClient<Database>(supabase.url, supabase.key)) : null;
}

const formOf = (form: HTMLFormElement): IdeaForm => {
  const data = new FormData(form);
  const field = (name: string) => String(data.get(name) ?? '');
  return { title: field('title'), pitch: field('pitch'), lane: field('lane'), prdField: field('prd') };
};

type Write = { busy: boolean; problem: string | null; run(write: (port: MembersPort | null) => Promise<string | null>): Promise<void> };

/** Runs one write; reloads the board once it is saved, else hands back the refusal. */
function useWrite(): Write {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return {
    busy,
    problem,
    async run(write) {
      setBusy(true);
      setProblem(null);
      const refused = await write(browserPort());
      if (refused === null) { window.location.reload(); return; }
      setProblem(refused);
      setBusy(false);
    },
  };
}

/** A form's submit: the idea it holds, sent as a new one, or as the named idea's new fields. */
const sendForm = (write: Write, repo: string, ideaId?: string) => (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const form = formOf(event.currentTarget);
  void write.run((port) => submitIdea(port, repo, form, ideaId));
};

function Problem({ problem }: { problem: string | null }) {
  return problem ? <p className="idea-member-problem" role="alert">{problem}</p> : null;
}

/** The fields of an idea, filled from it when it is edited. Only an edit sets the PRD number. */
function Fields({ idea, lane }: { idea?: Idea; lane: Lane }) {
  return (
    <>
      <label className="idea-field">
        <span>{MEMBERS.title}</span>
        <input name="title" required maxLength={120} defaultValue={idea?.title} />
      </label>
      <label className="idea-field">
        <span>{MEMBERS.pitch}</span>
        <textarea name="pitch" required maxLength={600} rows={3} defaultValue={idea?.pitch} />
      </label>
      <label className="idea-field">
        <span>{MEMBERS.lane}</span>
        <select name="lane" defaultValue={lane}>
          {LANES.map((l) => <option key={l} value={l}>{IDEAS.lanes[l]}</option>)}
        </select>
      </label>
      {idea ? (
        <label className="idea-field">
          <span>{MEMBERS.prd}</span>
          <input name="prd" inputMode="numeric" defaultValue={idea.prd ?? ''} />
        </label>
      ) : null}
    </>
  );
}

/** Add an idea, above the lanes: it goes in the lane chosen, Later unless the member picks another. */
export function AddIdea({ repo }: { repo: string }) {
  const write = useWrite();
  const onSubmit = sendForm(write, repo);
  return (
    <details className="idea-add">
      <summary className="ask-button quiet">{MEMBERS.addHeading}</summary>
      <form className="idea-form" onSubmit={onSubmit}>
        <Fields lane="later" />
        <Problem problem={write.problem} />
        <button type="submit" className="ask-button" disabled={write.busy}>{MEMBERS.add}</button>
      </form>
    </details>
  );
}

/** A card's Edit and Archive, for a member. */
export function IdeaControls({ repo, idea }: { repo: string; idea: Idea }) {
  const write = useWrite();
  const onSubmit = sendForm(write, repo, idea.id);
  return (
    <div className="idea-member">
      <details className="idea-edit">
        <summary className="idea-member-button" aria-label={MEMBERS.editFor(idea.title)}>{MEMBERS.edit}</summary>
        <form className="idea-form" onSubmit={onSubmit}>
          <Fields idea={idea} lane={idea.lane} />
          <button type="submit" className="ask-button" disabled={write.busy}>{MEMBERS.save}</button>
        </form>
      </details>
      <button
        type="button"
        className="idea-member-button"
        aria-label={MEMBERS.archiveFor(idea.title)}
        disabled={write.busy}
        onClick={() => void write.run((port) => archiveIdea(port, idea.id))}
      >
        {MEMBERS.archive}
      </button>
      <Problem problem={write.problem} />
    </div>
  );
}

/** Every card's "Brainstorm this" line, with a button that copies it. */
export function BrainstormLine({ idea }: { idea: Pick<Idea, 'title' | 'pitch'> }) {
  const line = brainstormLine(idea);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(line);
    setCopied(true);
  };
  return (
    <p className="idea-brainstorm">
      <span className="idea-brainstorm-label">{MEMBERS.brainstorm}</span>
      <code className="idea-brainstorm-line">{line}</code>
      <button type="button" className="idea-member-button" aria-label={MEMBERS.copyFor(idea.title)} onClick={() => void copy()}>
        {copied ? MEMBERS.copied : MEMBERS.copy}
      </button>
    </p>
  );
}
