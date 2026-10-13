import { SETUP_ERRORS, type SetupError } from './installed';

// /signup's screens (PRD 359): the install link, the wait for an org's owner, and why a sign-up
// stopped. Which one comes from the address /signup/installed sends the visitor to (setupReturn()),
// read back by readView(): only a known reason or GitHub logins, never text shown as it came. Each
// screen keeps what a person must know to press its button, every sentence at rest within 7 words
// (PRD 1705, the word pass); what it used to explain is in /docs/install#install-the-github-app.

export type SignupView =
  | { kind: 'install' }
  | { kind: 'waiting'; orgs: string[] }
  | { kind: 'error'; reason: SetupError };

const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

export function readView(query: { waiting?: string | null; error?: string | null }): SignupView {
  const reason = SETUP_ERRORS.find((r) => r === query.error);
  if (reason) return { kind: 'error', reason };
  const orgs = (query.waiting ?? '').split(',').filter((o) => LOGIN.test(o)).slice(0, 10);
  return orgs.length ? { kind: 'waiting', orgs } : { kind: 'install' };
}

const ERRORS: Record<SetupError, { title: string; text: string }> = {
  link: {
    title: 'This link is not one GitHub sent',
    text: 'Start from the install button below.',
  },
  github: {
    title: 'GitHub did not answer',
    text: 'Nothing was created. Try again shortly.',
  },
  unknown: {
    title: 'GitHub knows no such installation',
    text: 'Nothing was created. Install from the button below.',
  },
  'not-yours': {
    title: 'That installation is not yours',
    text: 'Nothing was created. Install it on your account or org.',
  },
  'no-org': {
    title: 'No org of yours is waiting',
    text: 'Sign in again to join their workspaces.',
  },
  failed: {
    title: 'Your workspace could not be created',
    text: 'Nothing was created. Try again in a moment.',
  },
  closed: {
    title: 'Sign-up is not open here',
    text: 'This deployment cannot make a workspace.',
  },
};

/** Where the docs say what the install card no longer explains (PRD 1705). */
const HOW_SIGNUP_WORKS = '/docs/install#install-the-github-app';

const names = (orgs: string[]) => (orgs.length === 1 ? orgs[0] : `${orgs.slice(0, -1).join(', ')} or ${orgs[orgs.length - 1]}`);

function InstallLink({ href }: { href: string | null }) {
  return href
    ? <a className="ask-button signup-link" href={href}>Install Omni Loop on GitHub</a>
    : <p className="ask-muted">Sign-up is not open here.</p>;
}

export function SignupScreen({ view, installUrl }: { view: SignupView; installUrl: string | null }) {
  if (view.kind === 'waiting') {
    return (
      <div className="ask-col">
        <section className="ask-card" aria-labelledby="signup-title">
          <h1 id="signup-title">
            {view.orgs.length === 1 ? `Waiting for ${view.orgs[0]}'s owner` : `Waiting for the owner of ${names(view.orgs)}`}
          </h1>
          <p className="ask-muted">Only an org owner can install it.</p>
          <p className="ask-muted">Once approved, sign in again.</p>
          <a className="ask-button quiet signup-link" href="/play">Sign in again</a>
        </section>
      </div>
    );
  }
  if (view.kind === 'error') {
    const { title, text } = ERRORS[view.reason];
    return (
      <div className="ask-col">
        <section className="ask-card" role="alert" aria-labelledby="signup-title">
          <h1 id="signup-title" className="ask-error">{title}</h1>
          <p className="ask-muted">{text}</p>
          <InstallLink href={installUrl} />
        </section>
      </div>
    );
  }
  return (
    <div className="ask-col">
      <section className="ask-card" aria-labelledby="signup-title">
        <h1 id="signup-title">Install Omni Loop on your org</h1>
        <p className="ask-muted">Pick the repositories it may read.</p>
        <InstallLink href={installUrl} />
        <p className="ask-muted">Not the owner? GitHub asks them.</p>
        <p className="ask-muted">Already in a workspace? <a href="/play">Sign in again</a></p>
        <p className="ask-muted"><a href={HOW_SIGNUP_WORKS}>How sign-up works</a></p>
      </section>
    </div>
  );
}
