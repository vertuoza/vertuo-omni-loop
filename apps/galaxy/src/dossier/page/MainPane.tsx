import { Badge, Card, Code, EmptyState, Link, Notice, SectionHeading, Text } from '@omni/ui';
import type { MainWatchView } from '../../main-watch/status';
import { FindingDecision } from '../../rewind/FindingDecision';
import { proposesRule } from '../../rewind/rewind.approval';
import { CHECK_LABELS, ORIGIN_LABELS, type FindingState, type FindingView } from '../../rewind/rewind.contract';

const STATE_WORDS: Readonly<Record<FindingState, string>> = { proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' };
const isCheck = (value: string): value is keyof typeof CHECK_LABELS => value in CHECK_LABELS;
const isOrigin = (value: string): value is keyof typeof ORIGIN_LABELS => value in ORIGIN_LABELS;

// After merge, a section of the Feature tab of /prd/<id> (PRD 2410, s3; drawn in Calm 2 by omni-loop-20
// s13): what the Omni App saw on main after the PRD merged. On top, the status in words; then each break
// with its kind, its link and, for a CI red, what the parent commit was; then what the rewind found, which
// is nothing until it runs: it says so, with the line to run it from a terminal. Read-only. Every text is
// escaped; a link opens on GitHub.

const STATUS_TONE = { broke: 'danger', clean: 'success', unchecked: 'warning', watching: 'info' } as const satisfies Record<MainWatchView['state'], 'danger' | 'success' | 'warning' | 'info'>;

export function MainPane({ main, findings = [] }: { main: MainWatchView | null; findings?: readonly FindingView[] }) {
  if (!main) return <EmptyState size="inline" title="The Omni App watches main for seven days once the PRD merges." />;
  return (
    <>
      <Notice tone={STATUS_TONE[main.state]} title={main.words}>{main.detail}</Notice>
      {main.unread.length > 0 && (
        <ul className="main-unread" aria-label="Signals that could not be read">
          {main.unread.map((signal) => <li key={signal}><Text size="small" tone="secondary">Could not read: {signal}</Text></li>)}
        </ul>
      )}
      {main.breaks.length === 0 ? (
        <Text size="small" tone="secondary">Nothing broke main so far.</Text>
      ) : (
        <ol className="main-breaks" aria-label="What broke main">
          {main.breaks.map((b, at) => (
            <li key={at} className="main-break">
              <p className="main-break-head">
                <Badge tone="danger">{b.label}</Badge>
                <Link href={b.url} external>{b.title}</Link>
              </p>
              <Text size="small" tone="secondary">
                {b.at}{b.lane && <> · {b.lane}</>}{b.parent && <> · {b.parent}</>}
              </Text>
            </li>
          ))}
        </ol>
      )}
      {main.state === 'broke' && (
        <section className="main-rewind" aria-label="The rewind">
          <SectionHeading level="3">The rewind</SectionHeading>
          {findings.length === 0 ? (
            <EmptyState size="inline" title="No rewind yet.">
              Run <Code>/omni:rewind {main.prd}</Code> from a terminal.
            </EmptyState>
          ) : (
            <ol className="main-findings" aria-label="What the rewind found">
              {findings.map((f) => <Finding key={f.id} finding={f} primary={f.id === findings.find((one) => one.state === 'proposed')?.id} />)}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

/** A finding's state in words: Proposed, or who decided it and on which day, with a rejection's reason (PRD 2410, s7). */
function stateLine(f: FindingView): string {
  const by = f.decidedBy ? ` by @${f.decidedBy}` : '';
  const on = f.decidedAt ? ` · ${f.decidedAt.slice(0, 10)}` : '';
  const why = f.state === 'rejected' && f.reason ? `: ${f.reason}` : '';
  return `${STATE_WORDS[f.state]}${by}${on}${why}`;
}

/** What became of an approved finding (PRD 2498, s2): the pull request that proposes the rule, the rule that
 * already says it, or the question asked; a finding Approve sent to `/omni:rewind-apply` that is still waiting
 * says the rule is being proposed, and a glossary or Legal one, filed as a proposal, says nothing (s3). */
function OutcomeLine({ finding: f }: { finding: FindingView }) {
  const outcome = f.outcome;
  if (outcome === null) return proposesRule(f) ? <Text size="small" tone="secondary">Proposing the rule…</Text> : null;
  if (outcome.kind === 'proposed') {
    return (
      <Text>
        {outcome.url?.startsWith('https://') ? <Link href={outcome.url} external>Rule proposed in PR #{outcome.pr}</Link> : <>Rule proposed in PR #{outcome.pr}</>}
      </Text>
    );
  }
  if (outcome.kind === 'already') return <Text>Already said by <Code>{outcome.rule}</Code></Text>;
  return <Text>{outcome.question}</Text>;
}

/** One finding of the rewind: its check, where the break started, what happened, the links it stands on and its
 * fix (PRD 2410, s5); a proposed one carries Approve and Reject for the member reading it (s7). */
function Finding({ finding: f, primary }: { finding: FindingView; primary: boolean }) {
  const check = isCheck(f.check) ? CHECK_LABELS[f.check] : f.check;
  const origin = isOrigin(f.origin) ? ORIGIN_LABELS[f.origin] : f.origin;
  return (
    <li className={`main-finding main-finding-${f.state}`}>
      <Card>
        <div className="main-finding-body">
          <p className="main-finding-head">
            <Badge tone="danger">{check}</Badge>
            <Text as="span" size="small" tone="secondary">Started in: {origin}</Text>
            <Text as="span" size="small" tone="secondary">{stateLine(f)}</Text>
          </p>
          <Text>{f.happened}</Text>
          <ul className="main-finding-evidence" aria-label="Evidence">
            {f.evidence.filter((link) => link.startsWith('https://')).map((link) => (
              <li key={link}><Link href={link} external>{link}</Link></li>
            ))}
          </ul>
          <Text><Text as="span" strong>Fix:</Text> {f.fix}</Text>
          {f.state === 'approved' && <OutcomeLine finding={f} />}
          {f.state === 'proposed' && <FindingDecision finding={f.id} primary={primary} />}
        </div>
      </Card>
    </li>
  );
}
