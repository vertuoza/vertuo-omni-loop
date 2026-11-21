import { Badge, Button, DefinitionList, EmptyState, Link, Notice, Text } from '@omni/ui';
import { PersonChip } from '../../people/PersonChip';
import { StageHeaderCopy } from './StageHeaderCopy';
import type { CareView } from './view';

// PR care, a section of the Feature tab of /prd/<id> (PRD 790, s4; drawn in Calm 2 by omni-loop-20 s13): the
// feature PR's health, read from GitHub. Three facts — CI (the failed run linked while red), Conflicts,
// Review (the threads counted by verdict) — then one line per thread, asked first: the reviewer's face and
// login, the comment's first line, the verdict with Claude's reason, and a link to it on GitHub. Under
// them, the watcher line, with `/omni:pr-care <n>` to copy while nobody is watching. Read-only. Merged, it
// says there is nothing left to look after; GitHub still being read, or unreadable, it says so.

const COUNT_WORDS = [['open', 'open'], ['fixed', 'fixed'], ['pushed-back', 'pushed back'], ['asked', 'asked']] as const;
const VERDICT_TONE = { open: 'neutral', fixed: 'success', 'pushed-back': 'info', asked: 'danger' } as const;

export function CarePane({ care }: { care: CareView | null }) {
  if (!care) return <EmptyState size="inline" title="This PRD has no feature PR yet." />;
  if (care.state === 'unread') return <Notice tone="danger">{care.words}</Notice>;
  const open = care.prUrl && (
    <div className="care-open">
      <Button href={care.prUrl} external>Open the feature PR</Button>
    </div>
  );
  if (care.state === 'done' || care.state === 'pending') {
    return (
      <>
        {open}
        <EmptyState size="inline" title={care.words ?? ""} />
      </>
    );
  }
  const { ci, conflict, counts, threads, watcher } = care;
  return (
    <>
      {open}
      <DefinitionList
        density="compact"
        facts={[
          { id: 'ci', label: 'CI', value: <Text as="span" tone={ci.state === 'red' ? 'danger' : ci.state === 'green' ? 'success' : 'primary'} strong>{ci.href ? <Link href={ci.href} external>{ci.words}</Link> : ci.words}</Text> },
          { id: 'conflicts', label: 'Conflicts', value: <Text as="span" tone={conflict.state === 'conflict' ? 'danger' : 'primary'} strong={conflict.state === 'conflict'}>{conflict.words}</Text> },
          { id: 'review', label: 'Review', value: COUNT_WORDS.map(([verdict, words]) => `${counts[verdict]} ${words}`).join(' · ') },
        ]}
      />
      {threads.length > 0 && (
        <ul className="care-threads" aria-label="Review threads">
          {threads.map((t) => (
            <li key={t.url} className="care-thread">
              <PersonChip person={t.person} size="inline" />
              <span className="care-first"><Text as="span">{t.firstLine}</Text></span>
              <span className="care-verdict">
                <Badge tone={VERDICT_TONE[t.verdict]}>{t.verdictWords}</Badge>
                {t.reason && <> <Text as="span" size="small" tone="secondary">· {t.reason}</Text></>}
              </span>
              <Link href={t.url} external>on GitHub ↗</Link>
            </li>
          ))}
        </ul>
      )}
      <div className="care-watcher">
        <Text as="span" tone={watcher.watching ? 'primary' : 'secondary'}>{watcher.words}</Text>
        {!watcher.watching && <StageHeaderCopy label="Copy" command={watcher.command} />}
      </div>
    </>
  );
}
