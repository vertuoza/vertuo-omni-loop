import type { ReactNode } from 'react';
import { PITCH_PRESETS, type PitchPreset, type PitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { lookLabel } from './model';
import { acceptOf } from './pitch-form-assets';
import {
  COLOUR_TOKENS, FONT_PROVIDERS, fileNameOf, isDirty, labelOf, MOODS, MUSIC_PROVIDERS, secondsOf, THEMES, VOICES, WEIGHTS,
  withColour, withFont, withMusicProvider, withSection, withTheme,
  type AssetTarget, type Font, type FontRole, type PitchFormState,
} from './pitch-form-model';

// A product's Pitch section drawn (PRD 1108 s2, spec acceptance 1): Look (a preset that fills it, four
// colours, the Heading and Text fonts, a logo, a theme), Voice (a preset and instructions), Intro /
// outro, Music and Length. Whoever may edit Settings › Business gets the controls, a file picker for
// each file and Save; anyone else reads every value as text. Drawn on the server first; ProductPage.tsx
// wires it.

export const PITCH_HINT = 'How this product’s pitch videos look and sound. Every pitch made for it follows these.';
export const READ_ONLY = 'Only someone who may edit the business changes these.';

export interface PitchHandlers {
  edit(draft: PitchSettings): void;
  preset(preset: PitchPreset): void;
  upload(target: AssetTarget, file: File): void;
  save(): void;
  reset(): void;
}

const IDLE: PitchHandlers = { edit: () => {}, preset: () => {}, upload: () => {}, save: () => {}, reset: () => {} };

type Choice = { value: string; label: string };
type Editing = { draft: PitchSettings; disabled: boolean; on: PitchHandlers };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="pitch-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({ label, value, choices, disabled, onChange }: { label: string; value: string; choices: readonly Choice[]; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <select className="products-look-select" value={value} disabled={disabled} onChange={(e) => { onChange(e.currentTarget.value); }}>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </Field>
  );
}

function Upload({ label, target, current, disabled, on }: { label: string; target: AssetTarget; current: string | null; disabled: boolean; on: PitchHandlers }) {
  return (
    <Field label={label}>
      <span className="pitch-file">
        <span className="ask-muted">{current ?? 'None yet'}</span>
        <input
          type="file"
          accept={acceptOf(target)}
          disabled={disabled}
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) on.upload(target, file);
            e.currentTarget.value = '';
          }}
        />
      </span>
    </Field>
  );
}

const PRESET_CHOICES: Choice[] = PITCH_PRESETS.map((value) => ({ value, label: lookLabel(value) }));
const WEIGHT_CHOICES: Choice[] = WEIGHTS.map((w) => ({ value: String(w), label: String(w) }));

function FontFields({ role, label, draft, disabled, on }: Editing & { role: FontRole; label: string }) {
  const font = draft.look[role];
  const edit = (part: Partial<Font>) => { on.edit(withFont(draft, role, part)); };
  return (
    <fieldset className="pitch-group">
      <legend>{label} font</legend>
      <Select label="Source" value={font.provider} choices={FONT_PROVIDERS} disabled={disabled} onChange={(provider) => { edit({ provider }); }} />
      {font.provider === 'file'
        ? <Upload label={`${label} font file`} target={role} current={fileNameOf(font.family)} disabled={disabled} on={on} />
        : (
          <Field label="Family">
            <input className="pitch-input" value={font.family} maxLength={80} disabled={disabled} onChange={(e) => { edit({ family: e.currentTarget.value }); }} />
          </Field>
        )}
      <Select label="Weight" value={String(font.weight)} choices={WEIGHT_CHOICES} disabled={disabled} onChange={(w) => { edit({ weight: Number(w) }); }} />
    </fieldset>
  );
}

function LookFields({ draft, disabled, on }: Editing) {
  return (
    <section className="pitch-part" aria-labelledby="pitch-look">
      <h3 id="pitch-look">Look</h3>
      <Select label="Preset" value={draft.look.preset} choices={PRESET_CHOICES} disabled={disabled} onChange={(preset) => { on.preset(preset === 'keynote' ? 'keynote' : 'arcade'); }} />
      <div className="pitch-colours">
        {COLOUR_TOKENS.map((t) => (
          <Field key={t.value} label={t.label}>
            <input type="color" value={draft.look.colors[t.value].toLowerCase()} disabled={disabled} onChange={(e) => { on.edit(withColour(draft, t.value, e.currentTarget.value)); }} />
          </Field>
        ))}
      </div>
      <FontFields role="heading" label="Heading" draft={draft} disabled={disabled} on={on} />
      <FontFields role="text" label="Text" draft={draft} disabled={disabled} on={on} />
      <Upload label="Logo" target="logo" current={fileNameOf(draft.look.logo)} disabled={disabled} on={on} />
      <Select label="Theme" value={draft.look.theme} choices={THEMES} disabled={disabled} onChange={(theme) => { on.edit(withTheme(draft, theme === 'dark' ? 'dark' : 'light')); }} />
    </section>
  );
}

function VoiceFields({ draft, disabled, on }: Editing) {
  return (
    <section className="pitch-part" aria-labelledby="pitch-voice">
      <h3 id="pitch-voice">Voice</h3>
      <Select
        label="Preset"
        value={draft.voice.preset}
        choices={VOICES}
        disabled={disabled}
        onChange={(preset) => { on.edit(withSection(draft, 'voice', { preset: VOICES.find((v) => v.value === preset)?.value ?? 'confident-warm' })); }}
      />
      <Field label="Instructions">
        <textarea className="pitch-input" rows={3} maxLength={600} value={draft.voice.instructions} disabled={disabled} onChange={(e) => { on.edit(withSection(draft, 'voice', { instructions: e.currentTarget.value })); }} />
      </Field>
    </section>
  );
}

function IntroOutroFields({ draft, disabled, on }: Editing) {
  return (
    <section className="pitch-part" aria-labelledby="pitch-intro-outro">
      <h3 id="pitch-intro-outro">Intro / outro</h3>
      <Field label="Intro eyebrow">
        <input className="pitch-input" maxLength={60} value={draft.intro.eyebrow} disabled={disabled} onChange={(e) => { on.edit(withSection(draft, 'intro', { eyebrow: e.currentTarget.value })); }} />
      </Field>
      <Field label="Outro call to action">
        <input className="pitch-input" maxLength={60} value={draft.outro.cta} disabled={disabled} onChange={(e) => { on.edit(withSection(draft, 'outro', { cta: e.currentTarget.value })); }} />
      </Field>
      <label className="pitch-check">
        <input type="checkbox" checked={draft.outro.credits} disabled={disabled} onChange={(e) => { on.edit(withSection(draft, 'outro', { credits: e.currentTarget.checked })); }} />
        <span>Show credits</span>
      </label>
    </section>
  );
}

function MusicFields({ draft, disabled, on }: Editing) {
  const { music } = draft;
  return (
    <section className="pitch-part" aria-labelledby="pitch-music">
      <h3 id="pitch-music">Music</h3>
      <Select label="Source" value={music.provider} choices={MUSIC_PROVIDERS} disabled={disabled} onChange={(provider) => { on.edit(withMusicProvider(draft, provider)); }} />
      {music.provider === 'freepd' && (
        <Select label="Mood" value={music.mood ?? MOODS[0].value} choices={MOODS} disabled={disabled} onChange={(mood) => { on.edit(withSection(draft, 'music', { mood })); }} />
      )}
      {music.provider === 'file' && <Upload label="Track" target="music" current={fileNameOf(music.file)} disabled={disabled} on={on} />}
    </section>
  );
}

function LengthFields({ draft, disabled, on }: Editing) {
  const bound = (key: 'min' | 'max', label: string) => (
    <Field label={label}>
      <input
        className="pitch-input pitch-seconds"
        type="number"
        min={15}
        max={60}
        value={Number.isNaN(draft.length[key]) ? '' : draft.length[key]}
        disabled={disabled}
        onChange={(e) => { on.edit(withSection(draft, 'length', { [key]: secondsOf(e.currentTarget.value) })); }}
      />
    </Field>
  );
  return (
    <section className="pitch-part" aria-labelledby="pitch-length">
      <h3 id="pitch-length">Length</h3>
      <p className="ask-muted">In seconds, 15 to 60.</p>
      <div className="pitch-row">
        {bound('min', 'Shortest')}
        {bound('max', 'Longest')}
      </div>
    </section>
  );
}

function Status({ state }: { state: PitchFormState }) {
  return (
    <>
      {state.refusal && <p className="products-refusal" role="alert">{state.refusal}</p>}
      {state.notice && <p className="pitch-notice" role="status">{state.notice}</p>}
    </>
  );
}

function PitchEditor({ state, on }: { state: PitchFormState; on: PitchHandlers }) {
  const editing: Editing = { draft: state.draft, disabled: state.busy, on };
  const dirty = isDirty(state);
  return (
    <form className="pitch-form" onSubmit={(e) => { e.preventDefault(); on.save(); }}>
      <LookFields {...editing} />
      <VoiceFields {...editing} />
      <IntroOutroFields {...editing} />
      <MusicFields {...editing} />
      <LengthFields {...editing} />
      <Status state={state} />
      <div className="pitch-actions">
        <button className="ask-button" type="submit" disabled={state.busy || !dirty}>{state.busy ? 'Saving…' : 'Save'}</button>
        <button className="ask-button quiet" type="button" disabled={state.busy || !dirty} onClick={on.reset}>Discard changes</button>
      </div>
    </form>
  );
}

// ── For anyone who may not edit ──────────────────────────────────────────────────

const fontText = (font: Font) => `${fileNameOf(font.family) ?? font.family}, ${String(font.weight)} (${labelOf(FONT_PROVIDERS, font.provider)})`;

function musicText(music: PitchSettings['music']): string {
  if (music.provider === 'freepd') return `${labelOf(MUSIC_PROVIDERS, music.provider)}: ${labelOf(MOODS, music.mood)}`;
  if (music.provider === 'file') return `${labelOf(MUSIC_PROVIDERS, music.provider)}: ${fileNameOf(music.file) ?? 'none yet'}`;
  return labelOf(MUSIC_PROVIDERS, music.provider);
}

/** Every value of the settings, as label and text, in the order the editor shows them. */
export function pitchSummary(pitch: PitchSettings): [string, string][] {
  const { look } = pitch;
  return [
    ['Preset', lookLabel(look.preset)],
    ['Colours', COLOUR_TOKENS.map((t) => `${t.label} ${look.colors[t.value]}`).join(' · ')],
    ['Heading font', fontText(look.heading)],
    ['Text font', fontText(look.text)],
    ['Logo', fileNameOf(look.logo) ?? 'None'],
    ['Theme', labelOf(THEMES, look.theme)],
    ['Voice', labelOf(VOICES, pitch.voice.preset)],
    ['Instructions', pitch.voice.instructions || 'None'],
    ['Intro eyebrow', pitch.intro.eyebrow],
    ['Outro call to action', pitch.outro.cta],
    ['Credits', pitch.outro.credits ? 'Shown' : 'Hidden'],
    ['Music', musicText(pitch.music)],
    ['Length', `${String(pitch.length.min)} to ${String(pitch.length.max)} seconds`],
  ];
}

function PitchReader({ pitch }: { pitch: PitchSettings }) {
  return (
    <>
      <dl className="pitch-summary">
        {pitchSummary(pitch).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="ask-muted">{READ_ONLY}</p>
    </>
  );
}

export interface PitchSectionProps {
  state: PitchFormState;
  editable: boolean;
  on?: PitchHandlers;
}

export function PitchSection({ state, editable, on = IDLE }: PitchSectionProps) {
  return (
    <section className="ask-card products-section" aria-labelledby="pitch-title">
      <h2 id="pitch-title">Pitch</h2>
      <p className="ask-muted">{PITCH_HINT}</p>
      {editable ? <PitchEditor state={state} on={on} /> : <PitchReader pitch={state.saved} />}
    </section>
  );
}
