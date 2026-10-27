import Link from 'next/link';
import { repositoriesTabHref } from '../../product-repositories/repositories-tab.contract';
import { Section } from '../KnowledgeLists';
import { dayOf } from '../knowledge-sections';
import { writeForRepositoryHref } from './write-for-repository';
import {
  LEDE, LEVEL_LABELS, NO_REPOSITORY, noPackLine, ownersLine, shortSha,
  type RepositoriesData, type RepositoryKnowledge, type ShownPage, type ShownRecord,
} from './repositories-section';

// The Repositories section of the Knowledge home, drawn (PRD 2419 s1): one card per repository of the
// product, its playbook pages then its decision records, each with its level, the repository and file it
// is read from, and its owner; a repository with no knowledge pack says so, with how one is made. Drawn
// from repositories-section.ts's model; RepositoriesSection.tsx reads it as the signed-in person.

export const NO_RECORD = 'No decision record yet.';

/** Where a page or record is read from: the repository its level is, then the file; a dash for the kit default. */
function ReadFrom({ from, file }: { from: string | null; file: string | null }) {
  if (from === null || file === null) return <td>—</td>;
  return <td>{from} <code className="kn-file">{file}</code></td>;
}

const LevelMark = ({ level }: { level: ShownPage['level'] }) => <span className="kn-level" data-level={level}>{LEVEL_LABELS[level]}</span>;

function PageRow({ page, repository }: { page: ShownPage; repository: string }) {
  return (
    <tr data-page={page.form}>
      <td><code>{page.form}</code>{page.title === null ? null : <> <span className="ask-muted">{page.title}</span></>}</td>
      <td><LevelMark level={page.level} /></td>
      <ReadFrom from={page.from} file={page.file} />
      <td>{ownersLine(page.owners)}</td>
      <td>
        {page.level === 'repo' ? '—' : (
          <a className="kn-write" href={writeForRepositoryHref(repository, page.form)} target="_blank" rel="noreferrer">Write it for this repository</a>
        )}
      </td>
    </tr>
  );
}

function RecordRow({ record }: { record: ShownRecord }) {
  return (
    <tr data-record={record.number}>
      <td><code>{record.number}</code></td>
      <td>{record.title ?? '—'}</td>
      <td><LevelMark level={record.level} /></td>
      <td>{record.from}</td>
      <td>{ownersLine(record.owners)}</td>
    </tr>
  );
}

function Head({ columns }: { columns: readonly string[] }) {
  return <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>;
}

function Pack({ knowledge }: { knowledge: Extract<RepositoryKnowledge, { pack: object }> }) {
  const { pack, pages, records, problems } = knowledge;
  return (
    <>
      <p className="ask-muted">Read from its knowledge pack at <code>{shortSha(pack.sha)}</code>, committed {dayOf(pack.committedAt)}.</p>
      <h4>Playbook</h4>
      <div className="kn-scroll">
        <table className="kn-table">
          <Head columns={['Page', 'Level', 'Read from', 'Owner', 'Write']} />
          <tbody>{pages.map((page) => <PageRow key={page.form} page={page} repository={knowledge.repository} />)}</tbody>
        </table>
      </div>
      <h4>Decision records</h4>
      {records.length === 0 ? <p className="ask-muted">{NO_RECORD}</p> : (
        <div className="kn-scroll">
          <table className="kn-table">
            <Head columns={['Record', 'Title', 'Level', 'Read from', 'Owner']} />
            <tbody>{records.map((record) => <RecordRow key={`${record.level}-${record.file}`} record={record} />)}</tbody>
          </table>
        </div>
      )}
      {problems.length === 0 ? null : (
        <details className="kn-problems">
          <summary>{`Skipped ${String(problems.length)} ${problems.length === 1 ? 'file' : 'files'}`}</summary>
          <ul>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </details>
      )}
    </>
  );
}

function RepositoryCard({ knowledge, index }: { knowledge: RepositoryKnowledge; index: number }) {
  const id = `repository-${String(index)}`;
  return (
    <section className="kn-repo" aria-labelledby={id} data-repository={knowledge.repository}>
      <h3 id={id}>{knowledge.repository}</h3>
      {knowledge.pack === null ? <p className="ask-muted">{noPackLine(knowledge.repository)}</p> : <Pack knowledge={knowledge} />}
    </section>
  );
}

export function RepositoriesView({ data }: { data: RepositoriesData }) {
  return (
    <Section id="repositories-title" title="Repositories" lede={LEDE}>
      {data.repositories.length === 0
        ? <p className="ask-muted">{NO_REPOSITORY} <Link href={repositoriesTabHref(data.product)}>Add one in Repositories &amp; approvers →</Link></p>
        : data.repositories.map((knowledge, index) => <RepositoryCard key={knowledge.repository} knowledge={knowledge} index={index} />)}
    </Section>
  );
}
