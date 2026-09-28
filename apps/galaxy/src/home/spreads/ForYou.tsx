import type { ReactNode } from 'react';
import './ForYou.css';

// What's in it for you? (PRD 285): what the loop gives a head of engineering, a developer and a
// product manager. Three cards, each a role, a one-line promise and three proofs, all drawn on the
// server and all visible at once: no tab, no toggle, no script (D3). Each proof names something the
// loop does today (D6).

type Role = { role: string; promise: string; proofs: readonly ReactNode[] };

export const roles: readonly Role[] = [
  {
    role: 'HEAD OF ENGINEERING',
    promise: 'More shipped, same guardrails.',
    proofs: [
      <>Nothing reaches <code>main</code> without a person: the agents never merge.</>,
      'Your rules for agents (how you test, review and release) live in your repository, and every agent follows them.',
      'One folder to adopt; delete it to stop.',
    ],
  },
  {
    role: 'DEVELOPER',
    promise: 'Review small pull requests, not prompts.',
    proofs: [
      'Each feature is cut into small pieces, each built test-first, each with its own pull request.',
      'The agents don\'t stop to ask: they write every call down, and you answer once, at the end.',
      'A red CI check is the agent\'s to fix, not yours.',
    ],
  },
  {
    role: 'PRODUCT MANAGER',
    promise: 'Your brief becomes the build.',
    proofs: [
      'Turn an idea into a brief with Claude, with a before/after page, approved before any code is written.',
      'Follow it live: the brief, the plan and every question, on one shareable page.',
      'Every shipped feature gets a release note in plain words.',
    ],
  },
];

export function ForYou() {
  return (
    <section className="home-spread" aria-labelledby="home-for-you">
      <h2 id="home-for-you" className="home-spread-head">What&apos;s in it <em>for you?</em></h2>
      <div className="home-roles">
        {roles.map(({ role, promise, proofs }) => (
          <article key={role} className="home-role">
            <h3 className="home-role-name">{role}</h3>
            <p className="home-role-promise">{promise}</p>
            <ul className="home-role-proofs">
              {proofs.map((proof, i) => <li key={i}>{proof}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
