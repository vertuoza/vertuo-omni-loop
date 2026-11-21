import { Badge, Code, DefinitionList, EmptyState, Link, Notice, Text } from '@omni/ui';
import type { ProofView } from './proof';
import { VersionPicker } from './VersionPicker';

// Proof, a section of the Feature tab of /prd/<id> (PRD 798, s4; drawn in Calm 2 by omni-loop-20 s13): what
// /omni:prove recorded against the ready feature PR's preview. The run picker (the version picker, one
// entry per run), then the run's facts — the commit, the URL it was recorded on, when, and the ✓/✗/—
// counts — then one row per criterion: its mark and text, its note, a player for its clip, and its script
// behind a "Script" fold. Read-only; every text is escaped.

const VERDICT_WORDS = { pass: 'pass', fail: 'fail', unfilmable: 'not filmable' } as const;
const VERDICT_TONE = { pass: 'success', fail: 'danger', unfilmable: 'neutral' } as const;

export function ProofPane({ proof, action }: { proof: ProofView | null; action: string }) {
  if (!proof) return <EmptyState size="inline" title="No proof was recorded for this PRD." />;
  const { counts } = proof;
  return (
    <>
      <VersionPicker action={action} tab="proof" versions={proof.versions} shown={proof.number} noun="Run" button />
      <DefinitionList
        facts={[
          { id: 'commit', label: 'Commit', value: <Code>{proof.commit}</Code> },
          { id: 'url', label: 'Recorded on', value: <Link href={proof.url} external>{proof.url}</Link> },
          { id: 'when', label: 'When', value: proof.at },
          {
            id: 'verdicts',
            label: 'Verdicts',
            value: (
              <span className="proof-counts">
                <Badge tone="success" title="pass">✓ {counts.pass}</Badge>
                <Badge tone="danger" title="fail">✗ {counts.fail}</Badge>
                <Badge title="not filmable">— {counts.unfilmable}</Badge>
              </span>
            ),
          },
        ]}
      />
      <ol className="proof-rows">
        {proof.criteria.map((c, i) => (
          <li key={i} className={`proof-item proof-${c.verdict}`}>
            <p className="proof-criterion">
              <Badge tone={VERDICT_TONE[c.verdict]} title={VERDICT_WORDS[c.verdict]}><span aria-label={VERDICT_WORDS[c.verdict]}>{c.mark}</span></Badge>
              <Text as="span" strong>{c.text}</Text>
            </p>
            {c.note && <Text size="small" tone="secondary">{c.note}</Text>}
            {c.video && (
              <video className="proof-video" src={c.video} controls preload="metadata" playsInline aria-label={`Clip: ${c.text}`} />
            )}
            {c.videoMissing && <Notice tone="danger">The clip could not be loaded. Reload the page in a moment.</Notice>}
            {c.script && (
              <details className="proof-script">
                <summary>Script <Code>{c.script.name}</Code></summary>
                {c.script.text !== null
                  ? <Code display="block">{c.script.text}</Code>
                  : <Text size="small" tone="secondary">The script could not be read here.{c.script.href && <> <Link href={c.script.href} external>Open it</Link>.</>}</Text>}
              </details>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
