'use client';
import { useEffect, useId, useState } from 'react';
import {
  activeQuestion,
  keyIntent,
  pickByKey,
  pickOption,
  shownLabel,
  shownPreview,
  toggleOther,
  typeOther,
  type AskQuestion,
  type Draft,
  type Pick,
} from '../answer-model';

// The open round: each question with its header chip and its text as the heading, the options as
// large rows (radios, or checkboxes for a multi-select) with their descriptions, the Recommended
// badge, Other, and a preview panel beside the options when an option carries one. Keys 1 to 4 pick
// in the question with the focus (else the first without an answer) and Enter sends.

type Props = {
  roundId: string;
  questions: AskQuestion[];
  draft: Draft;
  onDraft: (draft: Draft) => void;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  minutesLeft: number;
};

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text') || (el as HTMLElement).isContentEditable);

/** The question an element sits in, from its data-question attribute. */
function questionOf(el: Element | null): number | null {
  const at = el?.closest?.('[data-question]')?.getAttribute('data-question');
  return at === undefined || at === null ? null : Number(at);
}

export function RoundForm({ roundId, questions, draft, onDraft, canSend, sending, onSend, minutesLeft }: Props) {
  const id = useId();
  const [focus, setFocus] = useState<{ question: number; option: number } | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const typing = isTyping(target);
      const intent = keyIntent(event, typing);
      if (!intent) return;
      if (intent.kind === 'send') {
        // Enter in Other never breaks the line (Shift+Enter does); elsewhere it only acts once Send is on.
        if (typing || canSend) event.preventDefault();
        if (canSend && !sending) onSend();
        return;
      }
      event.preventDefault();
      onDraft(pickByKey(questions, draft, activeQuestion(questions, draft, questionOf(target)), intent.option));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [questions, draft, onDraft, canSend, sending, onSend]);

  const update = (index: number, pick: Pick) => onDraft(draft.map((p, i) => (i === index ? pick : p)));

  return (
    <section className="ask-round" aria-label="Claude asks">
      {questions.map((question, index) => {
        const pick = draft[index];
        const name = `${id}-${roundId}-${index}`;
        const preview = shownPreview(question, pick, focus?.question === index ? focus.option : null);
        const hasPreview = question.options.some((o) => o.preview !== null);
        return (
          <section key={index} className={hasPreview ? 'ask-q has-preview' : 'ask-q'} data-question={index} aria-labelledby={`${name}-text`}>
            <div className="ask-q-head">
              {question.header && <span className="ask-chip">{question.header}</span>}
              <span className="ask-pick-hint">{question.multiSelect ? 'Pick any that apply' : 'Pick one'}</span>
            </div>
            <h2 className="ask-question" id={`${name}-text`}>{question.question}</h2>
            <div className={hasPreview ? 'ask-q-body has-preview' : 'ask-q-body'}>
              <fieldset className="ask-opts" data-multi={question.multiSelect}>
                <legend className="ask-sr">{question.question}</legend>
                {question.options.map((option, k) => {
                  const shown = shownLabel(option.label);
                  return (
                    <label
                      key={k}
                      className="ask-opt"
                      onMouseEnter={() => setFocus({ question: index, option: k })}
                      onFocus={() => setFocus({ question: index, option: k })}
                    >
                      <input
                        type={question.multiSelect ? 'checkbox' : 'radio'}
                        name={name}
                        value={option.label}
                        checked={pick.labels.includes(option.label)}
                        onChange={() => update(index, pickOption(question, pick, option.label))}
                      />
                      <span className="ask-key" aria-hidden="true">{k < 4 ? k + 1 : ''}</span>
                      <span>
                        <span className="ask-opt-label">
                          {shown.text}
                          {shown.recommended && <span className="ask-rec">Recommended</span>}
                        </span>
                        {option.description && <span className="ask-opt-desc">{option.description}</span>}
                      </span>
                    </label>
                  );
                })}
                <div className="ask-opt ask-other">
                  <input
                    id={`${name}-other`}
                    type={question.multiSelect ? 'checkbox' : 'radio'}
                    name={name}
                    checked={pick.otherOn}
                    onChange={() => update(index, toggleOther(question, pick))}
                  />
                  <label htmlFor={`${name}-other`} className="ask-other-head">
                    <span className="ask-key" aria-hidden="true">…</span>
                    <span className="ask-opt-label">Other</span>
                  </label>
                  <textarea
                    className="ask-other-text"
                    rows={2}
                    placeholder="Type your own answer"
                    aria-label={`Your own answer: ${question.question}`}
                    value={pick.otherText}
                    onChange={(event) => update(index, typeOther(question, pick, event.target.value))}
                  />
                </div>
              </fieldset>
              {preview && (
                <pre className="ask-preview" aria-label={`Preview of ${shownLabel(question.options[preview.option].label).text}`}>
                  <span className="ask-preview-for" aria-hidden="true">Preview · {shownLabel(question.options[preview.option].label).text}</span>
                  {preview.text}
                </pre>
              )}
            </div>
          </section>
        );
      })}
      <div className="ask-foot">
        <span className="ask-hint">
          <span className="ask-keys-hint"><kbd>1</kbd>–<kbd>4</kbd> pick · <kbd>Enter</kbd> send · </span>
          <span suppressHydrationWarning>
            {minutesLeft > 1 ? `moves to the terminal in ${minutesLeft} min` : 'moves to the terminal in a minute'}
          </span>
        </span>
        <button type="button" className="ask-button" disabled={!canSend || sending} onClick={onSend}>
          {sending ? 'Sending…' : 'Send to Claude'}
        </button>
      </div>
    </section>
  );
}
