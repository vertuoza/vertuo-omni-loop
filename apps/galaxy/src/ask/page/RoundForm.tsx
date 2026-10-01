'use client';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import {
  activeQuestion,
  addShots,
  keyIntent,
  pickByKey,
  pickOption,
  removeShot,
  roundShots,
  SHOT_TYPES,
  shownLabel,
  shownPreview,
  toggleOther,
  typeOther,
  type AskQuestion,
  type Draft,
  type Pick,
  type Shot,
} from '../answer-model';
import { OptionDescription, QuestionHeading } from './QuestionText';
import { imagesOf, progressOf, progressText, shotOf, stageShots, subscribeTrays, type Progress } from './attachments';

// The open round: each question with its header chip and its text as the heading (a long one as
// its lead, the rest folded: PRD 752), the options as
// large rows (radios, or checkboxes for a multi-select) with their descriptions, the Recommended
// badge, Other, and a preview panel beside the options when an option carries one. Keys 1 to 4 pick
// in the question with the focus (else the first without an answer) and Enter sends. Other takes
// screenshots (PRD 620) by its button, by pasting into its text and by dropping files on it; the form
// stages them for its round, and Send uploads them first, saying how far it got.

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

/** One screenshot's thumbnail, drawn from its file once the page runs, with the × that removes it. */
function Thumb({ shot, n, onRemove }: { shot: Shot; n: number; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const made = URL.createObjectURL(shot.file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [shot.file]);
  return (
    <li className="ask-shot">
      {url ? <img className="ask-shot-img" src={url} alt={`Screenshot ${n}`} /> : <span className="ask-shot-img" aria-hidden="true" />}
      <button type="button" className="ask-shot-x" aria-label={`Remove screenshot ${n}`} onClick={onRemove}>×</button>
    </li>
  );
}

/** Files a drop or a paste carries: when there are some, the browser's own handling is stopped and
 * they go to `add`. */
function takeFiles(event: { preventDefault(): void }, data: { files: FileList } | null | undefined, add: (files: File[]) => void) {
  const files = imagesOf(data);
  if (!files.length) return;
  event.preventDefault();
  add(files);
}

type OtherProps = { name: string; question: AskQuestion; pick: Pick; questions: AskQuestion[]; draft: Draft; index: number; onDraft: (draft: Draft) => void; update: (pick: Pick) => void };

/** Other: its choice, its text, and its screenshots — by the button, a paste or a drop — with what
 * was refused. */
function OtherBox({ name, question, pick, questions, draft, index, onDraft, update }: OtherProps) {
  const [refused, setRefused] = useState<string[]>([]);
  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const added = addShots(questions, draft, index, files.map(shotOf));
    if (added.draft !== draft) onDraft(added.draft);
    setRefused(added.refused);
  };
  const dropShot = (id: string) => {
    onDraft(removeShot(draft, index, id));
    setRefused([]);
  };
  return (
    <div
      className="ask-opt ask-other"
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => takeFiles(event, event.dataTransfer, addFiles)}
    >
      <input
        id={`${name}-other`}
        type={question.multiSelect ? 'checkbox' : 'radio'}
        name={name}
        checked={pick.otherOn}
        onChange={() => update(toggleOther(question, pick))}
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
        onChange={(event) => update(typeOther(question, pick, event.target.value))}
        onPaste={(event) => takeFiles(event, event.clipboardData, addFiles)}
      />
      <div className="ask-shots">
        {!!pick.shots?.length && (
          <ul className="ask-shot-list" aria-label="Screenshots">
            {pick.shots.map((shot, n) => <Thumb key={shot.id} shot={shot} n={n + 1} onRemove={() => dropShot(shot.id)} />)}
          </ul>
        )}
        <input
          id={`${name}-shots`}
          className="ask-sr"
          type="file"
          multiple
          accept={SHOT_TYPES.join(',')}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <button type="button" className="ask-shot-add" onClick={() => document.getElementById(`${name}-shots`)?.click()}>
          Add screenshot
        </button>
        {!!refused.length && <p className="ask-shot-refused" role="status">{refused.join(' · ')}</p>}
      </div>
    </div>
  );
}

type OptionProps = { name: string; question: AskQuestion; pick: Pick; k: number; onFocus: () => void; update: (pick: Pick) => void };

/** One option's row: its radio or checkbox, its key, its label with the Recommended badge, its description. */
function OptionRow({ name, question, pick, k, onFocus, update }: OptionProps) {
  const option = question.options[k];
  if (!option) return null;
  const shown = shownLabel(option.label);
  return (
    <label className="ask-opt" onMouseEnter={onFocus} onFocus={onFocus}>
      <input
        type={question.multiSelect ? 'checkbox' : 'radio'}
        name={name}
        value={option.label}
        checked={pick.labels.includes(option.label)}
        onChange={() => update(pickOption(question, pick, option.label))}
      />
      <span className="ask-key" aria-hidden="true">{k < 4 ? k + 1 : ''}</span>
      <span>
        <span className="ask-opt-label">
          {shown.text}
          {shown.recommended && <span className="ask-rec">Recommended</span>}
        </span>
        {option.description && <OptionDescription text={option.description} />}
      </span>
    </label>
  );
}

type QuestionProps = {
  name: string;
  questions: AskQuestion[];
  draft: Draft;
  index: number;
  focused: number | null;
  setFocus: (focus: { question: number; option: number }) => void;
  onDraft: (draft: Draft) => void;
};

/** One question: its head, its options with Other, and the preview beside them when one is shown. */
function QuestionBlock({ name, questions, draft, index, focused, setFocus, onDraft }: QuestionProps) {
  const question = questions[index];
  const pick = draft[index];
  if (!question || !pick) return null;
  const preview = shownPreview(question, pick, focused);
  const previewOption = preview ? question.options[preview.option] : undefined;
  const hasPreview = question.options.some((o) => o.preview !== null);
  const update = (next: Pick) => onDraft(draft.map((p, i) => (i === index ? next : p)));
  return (
    <section className={hasPreview ? 'ask-q has-preview' : 'ask-q'} data-question={index} aria-labelledby={`${name}-text`}>
      <div className="ask-q-head">
        {question.header && <span className="ask-chip">{question.header}</span>}
        <span className="ask-pick-hint">{question.multiSelect ? 'Pick any that apply' : 'Pick one'}</span>
      </div>
      <QuestionHeading id={`${name}-text`} text={question.question} />
      <div className={hasPreview ? 'ask-q-body has-preview' : 'ask-q-body'}>
        <fieldset className="ask-opts" data-multi={question.multiSelect}>
          <legend className="ask-sr">{question.question}</legend>
          {question.options.map((_, k) => (
            <OptionRow key={k} name={name} question={question} pick={pick} k={k} onFocus={() => setFocus({ question: index, option: k })} update={update} />
          ))}
          <OtherBox name={name} question={question} pick={pick} questions={questions} draft={draft} index={index} onDraft={onDraft} update={update} />
        </fieldset>
        {preview && previewOption && (
          <pre className="ask-preview" aria-label={`Preview of ${shownLabel(previewOption.label).text}`}>
            <span className="ask-preview-for" aria-hidden="true">Preview · {shownLabel(previewOption.label).text}</span>
            {preview.text}
          </pre>
        )}
      </div>
    </section>
  );
}

/** What Send's button says: where the upload stands while sending. */
function sendLabel(sending: boolean, progress: Progress, upload: string | null): string | null {
  if (!sending) return 'Send to Claude';
  return progress.kind === 'uploading' ? upload : 'Sending…';
}

export function RoundForm({ roundId, questions, draft, onDraft, canSend, sending, onSend, minutesLeft }: Props) {
  const id = useId();
  const [focus, setFocus] = useState<{ question: number; option: number } | null>(null);
  const progress = useSyncExternalStore(subscribeTrays, () => progressOf(roundId), () => progressOf(roundId));
  const upload = progressText(progress);

  // What Send uploads: the screenshots of every question whose Other is chosen.
  useEffect(() => {
    stageShots(roundId, roundShots(questions, draft));
  }, [roundId, questions, draft]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const typing = isTyping(target);
      const intent = keyIntent(event, typing);
      if (!intent) return;
      if (intent.kind === 'send') {
        // A focused button, link or history row keeps its own Enter (Send itself sends by its click).
        if (target?.closest('button, a, summary, select')) return;
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

  return (
    <section className="ask-round" aria-label="Claude asks">
      {questions.map((_, index) => (
        <QuestionBlock
          key={index}
          name={`${id}-${roundId}-${index}`}
          questions={questions}
          draft={draft}
          index={index}
          focused={focus?.question === index ? focus.option : null}
          setFocus={setFocus}
          onDraft={onDraft}
        />
      ))}
      <div className="ask-foot">
        <span className="ask-hint">
          <span className="ask-keys-hint"><kbd>1</kbd>–<kbd>4</kbd> pick · <kbd>Enter</kbd> send · </span>
          <span suppressHydrationWarning>
            {minutesLeft > 1 ? `moves to the terminal in ${minutesLeft} min` : 'moves to the terminal in a minute'}
          </span>
        </span>
        {progress.kind === 'failed' && !sending && <p className="ask-shot-problem" role="status">{upload}</p>}
        <button type="button" className="ask-button" disabled={!canSend || sending} onClick={onSend}>
          {sendLabel(sending, progress, upload)}
        </button>
      </div>
    </section>
  );
}
