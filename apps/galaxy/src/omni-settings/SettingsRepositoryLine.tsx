'use client';
import { useState, type SubmitEvent } from 'react';
import { chooseRepository, demoChoice, type Chosen, type PlaybookEditing } from './omni-settings.client';
import type { RepositoryChoice } from './omni-settings.contract';

// The Settings repository line of Settings → Playbook (PRD 2543, s3), in the head card under its sentence:
// which repository the playbook is read from, in one of three states. Chosen: the owner's choice, with
// Change for the owner. Plan repository by default (none chosen, a plan repository named): a badge, and for
// the owner Keep it as the settings repository (offered only when the plan repository is listed) and
// Choose another. None: the owner's picker, in the card the view draws; a member has no control at all.
// The picker lists the repositories the workspace lists, and offers Clear the choice only when one is
// chosen. Saving posts to the settings-repository route as the signed-in person, then the page reads
// again; in the demo the choice is kept in the page. A refusal is said in the line, in the route's words.

export type SettingsRepositoryLineProps = {
  choice: RepositoryChoice;
  /** How an owner chooses; null for a member who is not an owner, who sees no control. */
  editing: PlaybookEditing | null;
  /** Whether the picker starts open (an owner who pressed Change or Choose another); closed by default. */
  picker?: boolean;
};

/** Saving a choice: the route as the signed-in person, or the demo's stand-in; `done` gets the stored name. */
function useSaving(editing: PlaybookEditing | null, done: (repository: string | null) => void) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save(repository: string | null) {
    if (editing === null) return;
    setBusy(true);
    setProblem(null);
    const answer: Chosen = editing.kind === 'demo' ? demoChoice(repository) : await chooseRepository({ workspace: editing.workspace, repository });
    setBusy(false);
    if (!answer.ok) {
      setProblem(answer.message);
      return;
    }
    done(answer.repository);
    // The pages below come from the repository just chosen: the page reads again.
    if (editing.kind === 'database') window.location.reload();
  }

  return { busy, problem, clear: () => { setProblem(null); }, save: (repository: string | null) => { void save(repository); } };
}
type Saving = ReturnType<typeof useSaving>;

const Refusal = ({ problem }: { problem: string | null }) => (problem === null ? null : <p className="ask-problem" role="alert">{problem}</p>);

export function SettingsRepositoryLine({ choice, editing, picker = false }: SettingsRepositoryLineProps) {
  const [chosen, setChosen] = useState(choice.chosen);
  const [picking, setPicking] = useState(picker);
  const saving = useSaving(editing, (repository) => { setChosen(repository); setPicking(false); });
  const { plan, listed } = choice;
  const owner = editing !== null;

  if (owner && (picking || (chosen === null && plan === null))) {
    const cancel = chosen !== null || plan !== null ? () => { setPicking(false); saving.clear(); } : null;
    return <Picker chosen={chosen} listed={listed} saving={saving} onCancel={cancel} />;
  }
  if (chosen !== null) {
    return (
      <div className="omni-settings-line">
        <p className="omni-settings-chosen">Settings repository: <strong>{chosen}</strong></p>
        {owner && <Actions><button type="button" className="ask-button quiet" onClick={() => { setPicking(true); }}>Change</button></Actions>}
        <Refusal problem={saving.problem} />
      </div>
    );
  }
  if (plan === null) return null;
  const keepable = owner && listed.includes(plan);
  return (
    <div className="omni-settings-line">
      <p className="omni-settings-badge">Using the plan repository <strong>{plan}</strong> by default</p>
      {owner && (
        <Actions>
          {keepable && (
            <button type="button" className="ask-button" data-primary disabled={saving.busy} onClick={() => { saving.save(plan); }}>
              Keep it as the settings repository
            </button>
          )}
          <button type="button" className="ask-button quiet" disabled={saving.busy} onClick={() => { setPicking(true); }}>Choose another</button>
        </Actions>
      )}
      <Refusal problem={saving.problem} />
    </div>
  );
}

const Actions = ({ children }: { children: React.ReactNode }) => <div className="omni-settings-actions">{children}</div>;

/** The picker: the workspace's listed repositories, Save, Cancel (when there is a line to go back to) and
 * Clear the choice (when one is chosen). */
function Picker({ chosen, listed, saving, onCancel }: { chosen: string | null; listed: string[]; saving: Saving; onCancel: (() => void) | null }) {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('repository');
    if (typeof value === 'string' && value !== '') saving.save(value);
  };
  return (
    <form className="omni-settings-line omni-settings-picker" onSubmit={submit}>
      <label htmlFor="omni-settings-repository">Settings repository</label>
      <select
        id="omni-settings-repository" name="repository" className="omni-settings-select" required disabled={saving.busy}
        defaultValue={chosen !== null && listed.includes(chosen) ? chosen : ''}
      >
        <option value="" disabled>Choose a repository</option>
        {listed.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      <Actions>
        <button type="submit" className="ask-button" data-primary disabled={saving.busy}>Save</button>
        {onCancel !== null && <button type="button" className="ask-button quiet" disabled={saving.busy} onClick={onCancel}>Cancel</button>}
        {chosen !== null && <button type="button" className="ask-button quiet" disabled={saving.busy} onClick={() => { saving.save(null); }}>Clear the choice</button>}
      </Actions>
      <Refusal problem={saving.problem} />
    </form>
  );
}
