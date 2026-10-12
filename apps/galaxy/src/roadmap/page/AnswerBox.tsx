'use client';
import { useState } from 'react';
import type { IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { copyLink } from '../../ask/page/share';
import { answerCommand } from './model';

// The answer box of a roadmap's `person` question (PRD 1162): the person writes the answer, and the box
// turns it into the one line that records it, `omni roadmap answer <n> <question> "<answer>"`, with a
// copy button, beside a link to the roadmap's issue, where that line comments with its marker. The next
// tick of the drive reads it from there and takes up the PRDs the question parked.

type Props = { roadmap: IssueNumber; question: string; issueUrl: string };

export function AnswerBox({ roadmap, question, issueUrl }: Props) {
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  const line = answer.trim() === '' ? null : answerCommand(roadmap, question, answer.trim());
  const id = `roadmap-answer-${question}`;

  async function copy() {
    if (line === null) return;
    setCopied((await copyLink(line, navigator.clipboard, () => {})) === 'copied');
  }

  return (
    <div className="roadmap-answer">
      <label htmlFor={id}>Your answer to {question}</label>
      <textarea id={id} className="roadmap-answer-text" rows={2} value={answer} onChange={(e) => { setAnswer(e.target.value); setCopied(false); }} />
      <p className="roadmap-muted">
        Record it from a checkout with{' '}
        <code>{line ?? answerCommand(roadmap, question, '…')}</code>{' '}
        <button type="button" className="ask-button quiet" onClick={() => void copy()} disabled={line === null}>Copy</button>
        {copied ? <span className="ask-hint" role="status"> Copied.</span> : null}
        {' '}· it comments on <a href={issueUrl}>the roadmap&apos;s issue</a>, and the next tick takes up what it parked.
      </p>
    </div>
  );
}
