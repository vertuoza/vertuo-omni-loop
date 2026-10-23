import type { PlaybookEditing } from './omni-settings.client';
import type { PlaybookPage, PlaybookPagesView } from './omni-settings.contract';
import { PlaybookEditor } from './PlaybookEditor';

// Settings → Playbook drawn (PRD 2417, s6): the tech playbook of the workspace's settings repository,
// page by page. One card per page: its name, whose it is (the settings repository's own file, or the
// kit's first default) and its text. A workspace with no settings repository, or one the Omni app
// cannot read, says so with the one thing to do. Drawn on the server; only the edit needs the browser.
// A workspace owner gets each page's edit (s7, ./PlaybookEditor.tsx), which proposes a change as a pull
// request in the settings repository; every other member reads the pages only, with no edit control.

export const SOURCE_LABEL: Record<PlaybookPage['source'], string> = {
  settings: 'In your settings repository',
  kit: 'The kit’s first default',
};

/** What a workspace with no settings repository does about it. */
export const NO_SETTINGS_REPOSITORY = 'Name a plan repository for this workspace: its plain files hold the playbook every repository reads.';

/** A form id as a page name: `definition-of-done` reads "Definition of done". */
export function pageTitle(form: string): string {
  const words = form.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/** A page's text without its front matter, which is bookkeeping for the kit and not for the reader. */
export function pageBody(text: string): string {
  return text.replace(FRONT_MATTER, '').trim();
}

export function PlaybookView({ view, editing = null }: {
  view: Pick<PlaybookPagesView, 'repository' | 'commit' | 'reason' | 'pages'>;
  /** How an owner proposes a change; null for a member who is not an owner, who sees no edit control. */
  editing?: PlaybookEditing | null;
}) {
  const noRepository = view.repository === null;
  return (
    <div className="ask-col omni-settings">
      <section className="ask-card omni-settings-head">
        <h1>Playbook</h1>
        <p className="ask-muted">
          How AI agents work in every repository of this workspace: the pages a repository does not write itself read the ones below.
        </p>
        {view.repository !== null && view.commit !== null && (
          <p className="ask-muted omni-settings-source">
            Read from <a href={`https://github.com/${view.repository}`}>{view.repository}</a> at <code>{view.commit.slice(0, 7)}</code>
          </p>
        )}
      </section>
      {noRepository && (
        <section className="ask-card omni-settings-empty" role="status">
          <h2>No settings repository yet</h2>
          <p className="ask-muted">{NO_SETTINGS_REPOSITORY}</p>
        </section>
      )}
      {!noRepository && view.reason !== null && (
        <section className="ask-card omni-settings-empty" role="status">
          <p className="ask-muted">{view.reason}</p>
        </section>
      )}
      {view.pages.length > 0 && (
        <ul className="omni-settings-pages" aria-label="Playbook pages">
          {view.pages.map((page) => (
            <li key={page.form} className="ask-card omni-settings-page" data-form={page.form} data-source={page.source}>
              <div className="omni-settings-page-head">
                <h2>{pageTitle(page.form)}</h2>
                <span className={`omni-settings-source-tag omni-settings-source-${page.source}`}>{SOURCE_LABEL[page.source]}</span>
              </div>
              {editing !== null && view.repository !== null ? (
                <PlaybookEditor form={page.form} title={pageTitle(page.form)} text={page.text} repository={view.repository} editing={editing}>
                  <pre className="omni-settings-text">{pageBody(page.text)}</pre>
                </PlaybookEditor>
              ) : (
                <pre className="omni-settings-text">{pageBody(page.text)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
