import { personaGrid, type PersonaAvatar, type PersonaTrade } from '@omni/design';
import type { ReactNode } from 'react';
import { pixelSvg } from '../../design/pixel-svg';
import { Svg } from '../poster/Poster';
import './Customers.css';

// Built for your customers (PRD 971, s3): the agents build for a team's customers, so the team writes
// down once who those are — its business, its products, its personas — and every run reads them. The
// chain is filled by one invented company, labelled EXAMPLE; nothing in it is a real business.

/** A persona's stance towards the product, in the order the spread shows them. */
export const STANCES = ['EXCITED', 'NEUTRAL', 'SKEPTICAL'] as const;
export type Stance = (typeof STANCES)[number];

export interface ExamplePersona {
  name: string;
  trade: PersonaTrade;
  /** The trade as the spread says it. */
  title: string;
  stance: Stance;
  avatar: PersonaAvatar;
}

export interface ExampleBusiness {
  name: string;
  pitch: string;
  business: { size: string; region: string; trade: string; rivals: string };
  products: readonly { name: string; line: string }[];
  personas: readonly ExamplePersona[];
  /** The skeptical persona objects, the team answers, and the answer becomes a fact the agents keep. */
  exchange: { persona: string; objection: string; answer: string; fact: string };
}

/** The invented company that fills the spread. */
export const EXAMPLE_BUSINESS: ExampleBusiness = {
  name: 'Brick & Bolt',
  pitch: 'Software for renovation firms, up against the spreadsheet.',
  business: {
    size: '5 to 50 people',
    region: 'Europe',
    trade: 'Renovation firms',
    rivals: 'The spreadsheet',
  },
  products: [
    { name: 'Site Diary', line: 'A site diary app: the day\'s work, photos and hours, logged from the site.' },
  ],
  personas: [
    { name: 'Nadia', trade: 'office', title: 'Office manager', stance: 'EXCITED', avatar: { v: 1, skin: 2, hair: 3, hairColor: 1, outfit: 0, accessory: 2 } },
    { name: 'Theo', trade: 'plumber', title: 'Plumber, subcontracting', stance: 'NEUTRAL', avatar: { v: 1, skin: 4, hair: 0, hairColor: 0, outfit: 0, accessory: 1 } },
    { name: 'Marek', trade: 'foreman', title: 'Site foreman', stance: 'SKEPTICAL', avatar: { v: 1, skin: 0, hair: 5, hairColor: 3, outfit: 0, accessory: 3 } },
  ],
  exchange: {
    persona: 'Marek',
    objection: 'This approval screen expects a back office. My crew is five people and I sign off my own work.',
    answer: 'We sell to 5-person crews too.',
    fact: 'A crew may have no back office: the foreman approves his own work.',
  },
};

const portrait = (p: ExamplePersona) => pixelSvg(personaGrid(p.trade, p.avatar), { scale: 2, title: `${p.name}, ${p.title}` });

function Step({ head, children }: { head: string; children: ReactNode }) {
  return (
    <li className="home-customers-step">
      <h3 className="home-customers-step-head">{head}</h3>
      {children}
    </li>
  );
}

export function Customers() {
  const { business, products, personas, exchange } = EXAMPLE_BUSINESS;
  return (
    <section className="home-spread" aria-labelledby="home-customers">
      <h2 id="home-customers" className="home-spread-head">Built for <em>your customers</em></h2>
      <p className="home-lead">
        The agents don&apos;t build for you. They build for your customers. Tell them who those are
        once, and every run reads it.
      </p>
      <p className="home-customers-company">
        <span className="home-example">EXAMPLE</span> <b>{EXAMPLE_BUSINESS.name}</b>: {EXAMPLE_BUSINESS.pitch}
      </p>
      <ol className="home-customers-chain">
        <Step head="BUSINESS">
          <p className="home-note">Who you sell to.</p>
          <dl className="home-customers-facts">
            <dt>SIZE</dt><dd>{business.size}</dd>
            <dt>REGION</dt><dd>{business.region}</dd>
            <dt>TRADE</dt><dd>{business.trade}</dd>
            <dt>RIVALS</dt><dd>{business.rivals}</dd>
          </dl>
        </Step>
        <Step head="PRODUCTS">
          <p className="home-note">What you sell them, one product at a time.</p>
          <ul className="home-customers-products">
            {products.map((p) => <li key={p.name}><b>{p.name}</b>: {p.line}</li>)}
          </ul>
        </Step>
        <Step head="PERSONAS">
          <p className="home-note">The people who use it.</p>
          <ul className="home-personas">
            {personas.map((p) => (
              <li key={p.name} className="home-persona" data-stance={p.stance}>
                <Svg svg={portrait(p)} />
                <span className="home-persona-name">{p.name}</span>
                <span className="home-persona-trade">{p.title}</span>
                <span className="home-persona-stance">{p.stance}</span>
              </li>
            ))}
          </ul>
        </Step>
      </ol>
      <div className="home-customers-run">
        <h3 className="home-customers-step-head">THE AGENTS READ THEM ON EVERY RUN</h3>
        <figure className="home-customers-exchange">
          <blockquote>
            <p><b>{exchange.persona}</b>: “{exchange.objection}”</p>
          </blockquote>
          <figcaption>
            <p><b>YOU</b>: “{exchange.answer}”</p>
            <p className="home-customers-fact"><span className="home-glyph">★</span> KEPT: {exchange.fact}</p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
