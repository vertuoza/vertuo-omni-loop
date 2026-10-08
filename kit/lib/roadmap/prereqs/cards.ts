/**
 * **The base checks' cards** (PRD 1218, slice s2): for each base check of the catalog, where it
 * holds and the author card a roadmap's row of it carries, written for someone who is not technical.
 * `/omni:roadmap` copies a card under its table, adapting the command to the author's platform; the
 * runner never reads it.
 */
import type { PREREQUISITE_BASE_CHECKS } from '../grade.ts';
import type { PrerequisiteCard, PrerequisiteCategory } from '../parse.ts';

export type BaseCheckName = (typeof PREREQUISITE_BASE_CHECKS)[number];

/** A base check's category and card. */
export type BaseCard = { category: PrerequisiteCategory; card: PrerequisiteCard };

const managerCard = (name: string, install: string): BaseCard => ({
  category: 'local',
  card: {
    why: `This repository installs its code libraries with ${name}. Without it, nothing can be installed or tested.`,
    command: install,
    whatItDoes: `Installs ${name} on this computer, through Node, which is already there.`,
    whoCanDoIt: 'Anyone with this laptop.',
  },
});

export const BASE_CARDS: Record<BaseCheckName, BaseCard> = {
  'gh-auth': {
    category: 'permissions',
    card: {
      why: 'The loop opens pull requests and reads issues on GitHub as you. It needs to be signed in, with the right to change the repository.',
      command: 'gh auth login --scopes repo',
      whatItDoes: 'Opens GitHub in your browser so you can sign the gh tool in, with the right to read and change your repositories.',
      whoCanDoIt: 'Anyone with this laptop and a GitHub account that can write to the repository.',
    },
  },
  node: {
    category: 'local',
    card: {
      why: 'The code runs on Node, and this repository needs a recent enough version of it.',
      command: 'brew install node',
      whatItDoes: 'Installs the latest Node on a Mac. Without Homebrew, download it from https://nodejs.org and run the installer.',
      whoCanDoIt: 'Anyone with this laptop who can install apps on it.',
    },
  },
  pnpm: managerCard('pnpm', 'corepack enable pnpm'),
  npm: managerCard('npm', 'corepack enable npm'),
  yarn: managerCard('yarn', 'corepack enable yarn'),
  install: {
    category: 'access',
    card: {
      why: 'The code needs its libraries downloaded before anything can be built or tested.',
      command: 'npm ci',
      whatItDoes: 'Downloads the exact libraries the repository lists. If one is private, ask for access to it first.',
      whoCanDoIt: 'Anyone with this laptop; a private library needs someone who can grant access to it.',
    },
  },
  registry: {
    category: 'access',
    card: {
      why: 'The libraries come from a package registry. If it does not answer, nothing installs.',
      command: 'npm ping',
      whatItDoes: 'Asks the registry whether it answers. If it is a private one, you may need to sign in to it, or ask whoever runs it for access.',
      whoCanDoIt: 'An engineer of your team, or whoever manages your company\'s private registry.',
    },
  },
  docker: {
    category: 'local',
    card: {
      why: 'Some tests start a database inside Docker. Without Docker running, they cannot run, and no slice can merge.',
      command: 'open -a Docker',
      whatItDoes: 'Starts the Docker app on your Mac. If it is not installed, get it from https://www.docker.com/products/docker-desktop and open it once.',
      whoCanDoIt: 'Anyone with this laptop.',
    },
  },
  labels: {
    category: 'github',
    card: {
      why: 'The loop marks its pull requests with labels. If they do not exist on GitHub, it cannot mark them.',
      command: 'node .omni-loop/bin/omni.mjs init',
      whatItDoes: 'Sets the loop up again on this repository, which creates the labels it is missing and changes nothing else.',
      whoCanDoIt: 'Anyone who can manage the repository\'s labels on GitHub (write access).',
    },
  },
  'env-file': {
    category: 'local',
    card: {
      why: 'The app reads its settings from a .env file, and each folder that needs one has an example to start from.',
      command: 'cp .env.example .env',
      whatItDoes: 'Makes your own settings file from the example. Any secret it asks for comes from the person who looks after it on your team.',
      whoCanDoIt: 'Anyone with this laptop; the secrets come from whoever looks after them.',
    },
  },
  'omni-signin': {
    category: 'services',
    card: {
      why: 'The loop sends its progress to the Omni page, which needs this computer to be signed in.',
      command: 'node .omni-loop/bin/omni.mjs signin',
      whatItDoes: 'Opens the Omni page in your browser so you can sign in; this computer then remembers it.',
      whoCanDoIt: 'Anyone with this laptop and a member account of your workspace.',
    },
  },
};
