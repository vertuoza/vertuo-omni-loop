import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const REVIEW_SCREEN_LENGTHS = ['2', '3'] as const;

export const reviewScreenMeta = {
  name: 'ReviewScreen',
  variants: { sections: REVIEW_SCREEN_LENGTHS },
  usage: 'A focused, full-width screen for one signed decision: numbered reading sections in order, a step list beside them, and a decision bar that stays at the bottom of the window with the question and the one decision.',
  do: [
    'Order the sections as the reader should read them, and name each by what it shows (`What changed`).',
    'Put the question in the decision bar, a line under it when it needs one, the secondary actions beside the one decision.',
    'Let the screen span the width it is given; prose inside a section keeps its 900 px measure.',
  ],
  dont: [
    'Put anything else on the screen: no tabs, no side panels, nothing that is not read before the decision.',
    'Give the bar two primary decisions.',
    'Pass a className or a style: the part takes sections and actions as slots.',
  ],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('text-tertiary'), ...onSurfaces('focus-ring', { edge: true })] },
  accessibility: [
    'The step list is a `nav` named by `stepsLabel`: each link reaches the heading of its section, and the last reaches the decision bar.',
    'Each section is a region named by its numbered heading, in reading order.',
    'The decision bar is a group named by its question.',
  ],
  replaces: ['dossier-approve', 'dossier-approve-screen'],
  example: '<ReviewScreen title="Review and approve" sections={[{ title: "What changed", children: "The diff" }]} question="Approve this spec and plan?" decision={<Button variant="primary">Approve</Button>} />',
} satisfies ComponentMeta;
