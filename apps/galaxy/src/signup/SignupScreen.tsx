import { SETUP_ERRORS, type SetupError } from './installed';

// /signup's screens (PRD 359): the install link, the wait for an org's owner, and why a sign-up
// stopped. Which one comes from the address /signup/installed sends the visitor to (setupReturn()),
// read back by readView(): only a known reason or GitHub logins, never text shown as it came.

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
    text: 'Start from the install button below: once Omni Loop is installed, GitHub sends you back here with it.',
  },
  github: {
    title: 'GitHub did not answer',
    text: 'Omni Loop could not check the installation with GitHub, so nothing was created. Try again in a moment.',
  },
  unknown: {
    title: 'GitHub knows no such installation',
    text: 'Nothing was created. Install Omni Loop from the button below, and GitHub sends you back with the right one.',
  },
  'not-yours': {
    title: 'That installation is not yours',
    text: 'Omni Loop is installed on a GitHub account you neither are nor belong to, so nothing was created. Install it on your own account, or on an org you belong to.',
  },
  'no-org': {
    title: 'No org of yours is waiting for Omni Loop',
    text: 'Every GitHub org you belong to has Omni Loop already, or you belong to none. Sign in again to join their workspaces, or install Omni Loop on your own account.',
  },
  failed: {
    title: 'Your workspace could not be created',
    text: 'Nothing was created. Try again in a moment.',
  },
  closed: {
    title: 'Sign-up is not open here',
    text: 'This deployment has no database, or no GitHub App set up, so it cannot make a workspace.',
  },
};

const names = (orgs: string[]) => (orgs.length === 1 ? orgs[0] : `${orgs.slice(0, -1).join(', ')} or ${orgs[orgs.length - 1]}`);

function InstallLink({ href }: { href: string | null }) {
  return href
    ? <a className="ask-button signup-link" href={href}>Install Omni Loop on GitHub</a>
    : <p className="ask-muted">This deployment has no GitHub App set up: sign-up is not open here.</p>;
}

export function SignupScreen({ view, installUrl }: { view: SignupView; installUrl: string | null }) {
  if (view.kind === 'waiting') {
    return (
      <div className="ask-col">
        <section className="ask-card" aria-labelledby="signup-title">
          <h1 id="signup-title">
            {view.orgs.length === 1 ? `Waiting for ${view.orgs[0]}'s owner` : `Waiting for the owner of ${names(view.orgs)}`}
          </h1>
          <p className="ask-muted">
            You asked for Omni Loop on {names(view.orgs)}. Only an owner of the org can install it. Once they
            have approved it on GitHub, sign in again: you land in its workspace.
          </p>
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
        <p className="ask-muted">
          Omni Loop works on your GitHub org&apos;s repositories. Install it on the org, and pick the repositories
          it may read: you land in a workspace named after the org, as its owner. Not an owner of the org?
          GitHub asks its owner for you. Install it on your own account for a workspace of your own.
        </p>
        <InstallLink href={installUrl} />
        <p className="ask-muted">
          Your org uses Omni Loop already? <a href="/play">Sign in again</a>: you join its workspace, with nothing to install.
        </p>
      </section>
    </div>
  );
}
