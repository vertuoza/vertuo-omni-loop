'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { decorative } from '../../people/face';
import { demoHeroesPort, httpHeroesPort, type Changed, type HeroesPort } from './heroes.client';
import { heroSvg, missingRoles, rowOf, WORDS, type HeroesView } from './heroes';
import './heroes.css';

// The Heroes tab of a Virtual Fleet (PRD 2842 s6, the `fleet-seats` screen): one row per hero, its sprite in
// the fleet's colour, its name and `Role · agent`, its skills, its agent and model (recorded: the runner's
// accounts still decide), its limits in sentences, and `Works alone` or `A person does this today` with why.
// An owner of the workspace sees `Add a hero` (a role the fleet lacks) and `Remove` on each row; a fleet
// keeps at least one hero. The rules live in ./heroes.ts; this file draws them and makes the calls.

export interface HeroesTabProps {
  view: HeroesView;
  /** Replaces the calls, for the tests. */
  port?: HeroesPort;
}

export function HeroesTab({ view, port }: HeroesTabProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const calls = useMemo(() => port ?? (view.workspace === null ? demoHeroesPort : httpHeroesPort(view.workspace, view.fleet)), [port, view.workspace, view.fleet]);
  const rows = view.heroes.map(rowOf);
  const free = missingRoles(view.heroes);

  async function change(key: string, act: () => Promise<Changed>) {
    setBusy(key);
    setProblem(null);
    const done = await act();
    setBusy(null);
    if (!done.ok) {
      setProblem(done.message);
      return;
    }
    setPicking(false);
    router.refresh();
  }

  return (
    <section className="heroes" data-screen="fleet-seats" aria-label={WORDS.tab}>
      <ul className="heroes-list">
        {rows.map((row) => (
          <li className="hero" key={row.id}>
            <span className="hero-sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: decorative(heroSvg(row.role, view.color, '', 3)) }} />
            <div className="hero-body">
              <h3 className="hero-name">{row.name}<span className="hero-role"> · {row.heading}</span></h3>
              <p className="hero-line" data-alone={row.alone}>{row.line}{row.why && <span className="ask-muted"> · {row.why}</span>}</p>
              <p className="hero-skills">{row.skills.length > 0 ? row.skills.map((skill) => <span className="hero-skill" key={skill}>{skill}</span>) : WORDS.noSkill}</p>
              <p className="hero-agent ask-muted">{row.preferred}</p>
              <ul className="hero-limits">{row.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
            </div>
            {view.canEdit && (
              <button type="button" className="ask-button quiet hero-remove" disabled={busy !== null || rows.length <= 1} onClick={() => { void change(row.id, () => calls.remove(row.id)); }}>
                {busy === row.id ? WORDS.removing : WORDS.remove}<span className="ask-sr"> {row.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {view.canEdit && free.length > 0 && (
        <div className="heroes-add">
          {picking ? (
            <ul className="heroes-roles" aria-label={WORDS.addTitle}>
              {free.map((role: HeroRole) => (
                <li key={role}>
                  <button type="button" className="ask-button quiet" disabled={busy !== null} onClick={() => { void change(role, () => calls.add(role)); }}>
                    {busy === role ? WORDS.adding : roleOf(role).name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button type="button" className="ask-button" data-primary="" onClick={() => { setPicking(true); }}>{WORDS.add}</button>
          )}
        </div>
      )}
      {!view.canEdit && <p className="ask-muted heroes-note">{WORDS.ownersOnly}</p>}
      {problem !== null && <p className="heroes-problem" role="alert">{problem}</p>}
    </section>
  );
}
