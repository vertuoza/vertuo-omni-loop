import { renderInlineMarkdown, renderMarkdownBody } from '../../dossier/markdown';
import { foldSummary, longQuestion, type LongQuestion } from '../long-question';

// A question's text wherever the page shows it in full (PRD 752): the open round's heading, the
// answered round, the shared round and the lists of a waiting or moved round. A short question is
// plain text, as it always was. A long one is its lead in bold, then the rest folded, closed at first,
// under "Read the full question · N steps · N words". Both are rendered as the dossier's safe
// markdown (raw HTML shown as text), the only HTML the page sets itself.

/** The rest of a long question, folded. Nothing when nothing is left after the lead. */
export function QuestionFold({ long }: { long: LongQuestion }) {
  if (!long.rest) return null;
  return (
    <details className="ask-fold">
      <summary>{foldSummary(long)}</summary>
      <div className="ask-prose" dangerouslySetInnerHTML={{ __html: renderMarkdownBody(long.rest) }} />
    </details>
  );
}

/** The open round's heading: the question, or the lead of a long one followed by its fold. */
export function QuestionHeading({ id, text }: { id: string; text: string }) {
  const long = longQuestion(text);
  if (!long) return <h2 className="ask-question" id={id}>{text}</h2>;
  return (
    <>
      <h2 className="ask-question ask-question-long" id={id} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(long.lead) }} />
      <QuestionFold long={long} />
    </>
  );
}

/** A question inside a list or an answer: the text, or the lead of a long one and its fold. */
export function QuestionText({ text }: { text: string }) {
  const long = longQuestion(text);
  if (!long) return <>{text}</>;
  return (
    <>
      <span className="ask-lead" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(long.lead) }} />
      <QuestionFold long={long} />
    </>
  );
}

/** An option's description, as one line of safe markdown. */
export function OptionDescription({ text }: { text: string }) {
  return <span className="ask-opt-desc" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(text) }} />;
}
