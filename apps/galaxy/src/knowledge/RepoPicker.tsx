'use client';
import type { RepoMenu } from './access';

// The knowledge map's repository menu: the checkout this app is deployed from, then every repository
// of the crew's workspaces set up with Omni Loop. A GET form to /knowledge, so it works before any
// script runs (the Show button); once the page runs, picking a repository opens it at once, on its
// first domain, and the deployed checkout at the page's own address.

export const repoHref = (value: string) => (value ? `/knowledge?${new URLSearchParams({ repo: value })}` : '/knowledge');

export function RepoPicker({ menu }: { menu: RepoMenu }) {
  return (
    <form className="km-picker" method="get" action="/knowledge">
      <label className="km-picker-field">
        <span className="ask-hint">Repository</span>
        <select
          className="ask-share-pick"
          name="repo"
          defaultValue={menu.current}
          onChange={(event) => window.location.assign(repoHref(event.currentTarget.value))}
        >
          {menu.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="submit" className="ask-button quiet">Show</button>
    </form>
  );
}
