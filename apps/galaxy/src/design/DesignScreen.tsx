import type { CSSProperties } from 'react';
import { OMNI_LOOP, logoSvg, spritePixels, type FontRole, type Tint } from '@omni/design';
import {
  CAST, COLOURS, FLEETS, FRAMES, ICONS, LOGOS, LOGO_NOTES, LOGO_SCALES, LOGO_SHOWINGS, POSES, POSTER_SCALE,
  TYPE_STEPS, fleetHero, ratio,
} from './catalogue';
import { pixelSvg } from './pixel-svg';

// /design: the Omni Loop design system, rendered on the server straight from @omni/design: every
// logo form, every colour, every type step, every sprite in every frame, the heroes in every
// fleet's colours, the OmniMan poses at poster scale, and the icons. Every drawing is an inline SVG,
// crisp at a whole-number scale, so the page shows the whole system with no script. Its styles are
// in design.css, scoped to `.ds`.

const SECTIONS = [
  ['logo', 'Logo'], ['colours', 'Colours'], ['type', 'Type'], ['sprites', 'Sprites'],
  ['heroes', 'Heroes'], ['poses', 'Poses'], ['icons', 'Icons'],
] as const;

/** What each role's specimen reads: short enough for the largest display step on a phone. */
const SAMPLE: Record<FontRole, string> = {
  display: 'Ship the loop',
  pixel: 'Terraform the galaxy',
  body: 'Terraform the galaxy, one slice at a time.',
  mono: 'omni do-work --in-wave',
};

/** A string of SVG markup, as an element's only child. */
const Svg = ({ svg }: { svg: string }) => <span className="ds-svg" dangerouslySetInnerHTML={{ __html: svg }} />;

function SpriteFrame({ name, frame, scale, tint, label }: { name: string; frame: number; scale: number; tint?: Tint; label?: string }) {
  return <Svg svg={pixelSvg(spritePixels(name, { frame, tint }), { scale, title: `${label ?? name}, frame ${frame + 1}` })} />;
}

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: React.ReactNode }) {
  return (
    <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="ds-h2">{title}</h2>
      <p className="ds-lede">{lede}</p>
      {children}
    </section>
  );
}

export function DesignScreen() {
  return (
    <div className="ds">
      <header className="ds-head">
        <Svg svg={logoSvg(OMNI_LOOP.logo, { scale: 2, title: OMNI_LOOP.name })} />
        <p className="ds-kicker">{OMNI_LOOP.tagline}</p>
        <h1 className="ds-h1">The {OMNI_LOOP.name} design system</h1>
        <p className="ds-lede">
          Every piece below is drawn from <code>@omni/design</code>: the logo, the colours, the type and the
          sprites. Pixels only ever grow by whole numbers.
        </p>
        <nav className="ds-toc" aria-label="Contents">
          {SECTIONS.map(([id, title]) => <a key={id} href={`#${id}`}>{title}</a>)}
        </nav>
      </header>

      <main>
        <Section id="logo" title="Logo" lede="The 16-bit crest in its three forms and the favicon: in colour on dark and light grounds, and in one colour for a light ground or a single ink.">
          {LOGOS.map((form) => (
            <article key={form} className="ds-logo">
              <h3 className="ds-h3"><code>{form}</code></h3>
              <p className="ds-note">{LOGO_NOTES[form]}</p>
              {LOGO_SHOWINGS.map(({ ground, ink }) => (
                <div key={`${ground}-${ink}`} className={`ds-strip ds-ground-${ground}`}>
                  {LOGO_SCALES.map((scale) => (
                    <figure key={scale} className="ds-fig" data-logo={form} data-ground={ground} data-ink={ink} data-scale={scale}>
                      <Svg svg={logoSvg(form, { scale, mono: ink === 'mono', title: `${form}, ${ink === 'mono' ? 'one colour' : 'colour'}, ${scale}×` })} />
                      <figcaption>{ink === 'mono' ? 'one colour' : 'colour'} · {scale}×</figcaption>
                    </figure>
                  ))}
                </div>
              ))}
            </article>
          ))}
        </Section>

        <Section id="colours" title="Colours" lede="The named colours, INK: each one's name, its hex, and its contrast on the void behind the arcade and on white.">
          <ul className="ds-swatches">
            {COLOURS.map(({ name, hex, onVoid, onWhite }) => (
              <li key={name} className="ds-swatch" data-colour={name}>
                <span className="ds-chip" style={{ background: hex }} aria-hidden="true" />
                <strong className="ds-name">{name}</strong>
                <code className="ds-hex">{hex}</code>
                <span className="ds-contrast">on void {ratio(onVoid)} · on white {ratio(onWhite)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="type" title="Type" lede="Four roles, eleven steps. Each step is a role, a face, a size, a line height and a slant, served from this origin.">
          <ul className="ds-steps">
            {TYPE_STEPS.map((step) => (
              <li key={step.name} className="ds-step" data-step={step.name}>
                <p className="ds-spec">
                  <code>{step.name}</code> · {step.role} · {step.face} · {step.size}px / {step.lineHeight}
                  {step.slant ? ` · ${step.slant}° slant` : ''}
                </p>
                <p
                  className="ds-sample"
                  style={{
                    fontFamily: `var(--type-${step.name}-family)`,
                    fontSize: `var(--type-${step.name}-size)`,
                    lineHeight: `var(--type-${step.name}-line)`,
                    '--slant': `var(--type-${step.name}-slant)`,
                  } as CSSProperties}
                >
                  {SAMPLE[step.role]}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="sprites" title="Sprites" lede="The cast, in both frames at 2×: OmniMan and his poses, the heroes, the fleet mascots and Entropy.">
          <ul className="ds-grid">
            {CAST.map((name) => (
              <li key={name} className="ds-card">
                <div className="ds-frames">
                  {FRAMES.map((frame) => (
                    <figure key={frame} className="ds-fig" data-sprite={name} data-frame={frame}>
                      <SpriteFrame name={name} frame={frame} scale={2} />
                    </figure>
                  ))}
                </div>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="heroes" title="Heroes" lede="Both hero bodies in every fleet's colours: the fleet suit and a red cape.">
          <ul className="ds-grid">
            {FLEETS.map((fleet) => (
              <li key={fleet.name} className="ds-card">
                <div className="ds-frames">
                  {(['girl', 'boy'] as const).map((body) => {
                    const look = fleetHero(body, fleet.color);
                    return (
                      <figure key={body} className="ds-fig" data-hero={body} data-fleet={fleet.name}>
                        <SpriteFrame name={look.sprite} frame={0} scale={2} tint={look.tint} label={`${fleet.label} ${body}`} />
                      </figure>
                    );
                  })}
                </div>
                <strong className="ds-name">{fleet.label}</strong>
                <code className="ds-hex">{fleet.color}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="poses" title="Poses" lede={`OmniMan points, cheers and runs, at poster scale: ${POSTER_SCALE}×, every pixel a ${POSTER_SCALE}×${POSTER_SCALE} block.`}>
          {POSES.map((pose) => (
            <article key={pose} className="ds-pose">
              <h3 className="ds-h3"><code>{pose}</code></h3>
              <div className="ds-strip ds-ground-dark">
                {FRAMES.map((frame) => (
                  <figure key={frame} className="ds-fig" data-pose={pose} data-frame={frame}>
                    <SpriteFrame name={pose} frame={frame} scale={POSTER_SCALE} />
                    <figcaption>frame {frame + 1}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </Section>

        <Section id="icons" title="Icons" lede="The icons, in both frames at 3×.">
          <ul className="ds-grid ds-grid-icons">
            {ICONS.map((name) => (
              <li key={name} className="ds-card">
                <div className="ds-frames">
                  {FRAMES.map((frame) => (
                    <figure key={frame} className="ds-fig" data-sprite={name} data-frame={frame}>
                      <SpriteFrame name={name} frame={frame} scale={3} />
                    </figure>
                  ))}
                </div>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
