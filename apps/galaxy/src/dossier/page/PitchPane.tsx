'use client';
import type { PitchAudienceView, PitchView } from './pitch';
import { PitchPaneCopy } from './PitchPaneCopy';

// The Pitch tab of /prd/<id> (PRD 859 s3): what /omni:pitch made of a shipped PRD, the latest pitch per
// audience, Customers first. Each: the audience's picker (its pitches by date, a GET form keeping the
// tab, so it works before any script runs), the slide, the 16:9 video's player, the words, a download
// per file of the five, and Copy GIF link. Read-only; every text is escaped.

function PitchPicker({ action, pitch }: { action: string; pitch: PitchAudienceView }) {
  return (
    <form className="dossier-picker" method="get" action={action}>
      <input type="hidden" name="tab" value="pitch" />
      <label className="dossier-picker-field">
        <span className="ask-hint">Pitch</span>
        <select className="ask-share-pick" name="pitch" defaultValue={pitch.id} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          {pitch.versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <button type="submit" className="ask-button quiet">Show</button>
    </form>
  );
}

function PitchRun({ action, pitch }: { action: string; pitch: PitchAudienceView }) {
  const missing = pitch.slide === null || pitch.video === null;
  return (
    <section className="pitch-run" aria-label={`${pitch.label} pitch`}>
      <header className="pitch-run-head">
        <h2>{pitch.label}</h2>
        <PitchPicker action={action} pitch={pitch} />
      </header>
      <dl className="proof-facts">
        <div><dt>Made</dt><dd>{pitch.at}</dd></div>
        <div><dt>Look</dt><dd>{pitch.look}</dd></div>
        <div><dt>Commit</dt><dd><code>{pitch.commit}</code></dd></div>
      </dl>
      <div className="pitch-media">
        {pitch.slide && <img className="pitch-slide" src={pitch.slide} alt={`Slide: ${pitch.hook}`} />}
        {pitch.video && <video className="pitch-video" src={pitch.video} controls preload="metadata" playsInline aria-label={`Video: ${pitch.hook}`} />}
      </div>
      {missing && <p className="ask-problem" role="alert">A file could not be loaded. Reload the page in a moment.</p>}
      <div className="pitch-words">
        <p className="pitch-kicker">{pitch.kicker}</p>
        <p className="pitch-hook">{pitch.hook}</p>
        <p>{pitch.benefit}</p>
        <p className="ask-muted">{pitch.closing}</p>
      </div>
      <ul className="pitch-downloads" aria-label="Downloads">
        {pitch.downloads.map((d) => (
          <li key={d.name}>
            {d.href
              ? <a className="ask-button quiet" href={d.href} download={d.name}>{d.name}</a>
              : <span className="ask-button quiet" aria-disabled="true" title="Could not be loaded">{d.name}</span>}
          </li>
        ))}
        <li><PitchPaneCopy path={pitch.gif} /></li>
      </ul>
    </section>
  );
}

export function PitchPane({ pitch, action }: { pitch: PitchView | null; action: string }) {
  if (!pitch) return <p className="dossier-empty">No pitch was made for this PRD.</p>;
  return (
    <div className="pitch-runs">
      {pitch.audiences.map((p) => <PitchRun key={p.audience} action={action} pitch={p} />)}
    </div>
  );
}
