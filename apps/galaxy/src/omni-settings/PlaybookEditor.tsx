'use client';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { demoProposal, proposePage, type PlaybookEditing, type Proposed } from './omni-settings.client';
import type { PlaybookProposed } from './omni-settings.contract';

// A page's edit on Settings → Playbook (PRD 2417, s7), shown to a workspace owner only: the page's
// whole text, front matter included, in one field that takes the place of the text while it is
// edited; sending it opens a pull request in the settings
// repository, which a person merges. Nothing is saved here: the page keeps showing the text the
// settings repository holds, and once the pull request is open it links it. A refusal shows the
// route's own words in one line, and the text stays in the field to try again.

type Stage = { kind: 'closed' } | { kind: 'editing'; sending: boolean; problem: string | null } | { kind: 'opened'; proposed: PlaybookProposed };

export type PlaybookEditorProps = {
  form: string;
  /** The page's name as the card shows it, so each page's button says which page it changes. */
  title: string;
  text: string;
  repository: string;
  editing: PlaybookEditing;
  /** The page's text as it reads, shown except while it is edited, when the field holds it. */
  children: ReactNode;
};

/** What the editor says before anything is sent. */
const EDIT_NOTE = 'Sending opens a pull request. Nothing changes until a person merges it.';

/** What the editor says once the pull request is open. */
const OPENED_NOTE = 'Once a person merges it, every repository reads the new text on its next sync.';

export function PlaybookEditor({ form, title, text, repository, editing, children }: PlaybookEditorProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'closed' });

  async function send(value: string) {
    setStage({ kind: 'editing', sending: true, problem: null });
    const answer: Proposed = editing.kind === 'demo' ? demoProposal(repository) : await proposePage({ workspace: editing.workspace, form, text: value });
    setStage(answer.ok ? { kind: 'opened', proposed: answer.proposed } : { kind: 'editing', sending: false, problem: answer.message });
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('text');
    if (typeof value === 'string' && value.trim() !== '') void send(value);
  };

  if (stage.kind === 'closed') {
    return (
      <>
        {children}
        <div className="omni-settings-edit">
          <button
            type="button" className="ask-button quiet" aria-label={`Propose a change to ${title}`}
            onClick={() => { setStage({ kind: 'editing', sending: false, problem: null }); }}
          >
            Propose a change
          </button>
        </div>
      </>
    );
  }

  if (stage.kind === 'opened') {
    const { pullRequest } = stage.proposed;
    return (
      <>
        {children}
        <div className="omni-settings-edit omni-settings-opened" role="status">
          <p>
            <a href={pullRequest.url}>Pull request #{pullRequest.number}</a> is open in {stage.proposed.repository}.
          </p>
          <p className="ask-muted">{OPENED_NOTE}</p>
        </div>
      </>
    );
  }

  const field = `omni-settings-text-${form}`;
  return (
    <form className="omni-settings-edit omni-settings-edit-form" onSubmit={submit}>
      <label htmlFor={field}>Text of the page</label>
      {/* The owner asked to edit this page: the field takes the focus, in the place of the text it replaces. */}
      <textarea id={field} name="text" className="omni-settings-field" defaultValue={text} rows={18} spellCheck={false} required disabled={stage.sending} autoFocus />
      <p className="ask-muted">{EDIT_NOTE}</p>
      <div className="omni-settings-actions">
        <button type="submit" className="ask-button" data-primary disabled={stage.sending}>
          {stage.sending ? 'Opening…' : 'Open pull request'}
        </button>
        <button type="button" className="ask-button quiet" disabled={stage.sending} onClick={() => { setStage({ kind: 'closed' }); }}>
          Cancel
        </button>
      </div>
      {stage.problem !== null && <p className="ask-problem" role="alert">{stage.problem}</p>}
    </form>
  );
}
