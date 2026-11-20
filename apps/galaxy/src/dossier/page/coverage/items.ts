import { MOMENTS, type MomentName } from './moments';
import type { PageTab } from '../view';

// The inventory of the PRD page (omni-loop-20 s9): every item a person can find on it, as data. A row names
// the item, where it is drawn (`on`: a tab of the PRD page, a segment of Specifications, the review screen of
// one decision, or a fix's page), the moments it shows in, and the words or markup that find it. The coverage
// test reads this list and renders the page in each moment. A slice that moves an item changes one row.
//
// `find` is read against the page's text (tags taken out, entities decoded) unless `html` is set, when it
// is read against the markup. An item the page cannot draw in a static render, because a script or a
// network call draws it, is `proved` by the existing test that holds it: its file must exist and name `find`.

type Moments = readonly MomentName[];
export type Place =
  | { page: 'prd'; tab: PageTab | null; segment?: string }
  | { page: 'review'; kind: 'approve' | 'tech' | 'feature' }
  | { page: 'fix'; tab?: string };

export type Item = {
  /** Which part of the inventory it is from, 1 to 7. */
  section: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  on: Place;
  /** The moments it shows in (a fix's and the review screen's items have none to vary: leave it empty). */
  moments: Moments;
  find: string;
  html?: true;
  /** A test file (relative to this folder) that proves an item a static render cannot draw. */
  proved?: string;
};

const ALL: Moments = MOMENTS;
const NUMBERED: Moments = ['approval', 'tech-approval', 'outbox', 'ready', 'shipped', 'main-broke'];
const AFTER_APPROVAL: Moments = ['tech-approval', 'outbox', 'ready', 'shipped', 'main-broke'];
const HEAD = (tab: PageTab | null = null): Place => ({ page: 'prd', tab });
const tab = (name: PageTab): Place => ({ page: 'prd', tab: name });
const seg = (segment: string): Place => ({ page: 'prd', tab: 'specifications', segment });

const row = (section: Item['section'], name: string, on: Place, moments: Moments, find: string, more: Partial<Item> = {}): Item => ({ section, name, on, moments, find, ...more });

export const ITEMS: readonly Item[] = [
  // 1 · The head
  row(1, 'Eyebrow: PRD number', HEAD(), NUMBERED, 'PRD #216'),
  row(1, 'Eyebrow: Draft', HEAD(), ['draft'], 'Draft'),
  row(1, 'Eyebrow: Product PRD', HEAD(), NUMBERED, 'Product PRD'),
  row(1, 'Title', HEAD(), ALL, 'Offline quotes'),
  row(1, 'Subtitle: you approve', HEAD(), ['approval'], 'You approve the spec and plan'),
  row(1, 'Subtitle: you review the plan', HEAD(), ['tech-approval'], 'You review the plan and give the Tech Approval.'),
  row(1, 'Subtitle: you answer the outbox', HEAD(), ['outbox'], 'You answer the 2 decisions the agents left open.'),
  row(1, 'Subtitle: the feature is ready', HEAD(), ['ready'], 'The feature is ready: you review it, then merge it on GitHub.'),
  row(1, 'Subtitle: shipped', HEAD(), ['shipped'], 'Shipped: the retro is written next, and you may pitch it.'),
  row(1, 'Subtitle: main broke', HEAD(), ['main-broke'], 'It broke main after it merged'),
  row(1, 'Subtitle: nothing waits on you', HEAD(), ['draft'], 'Nothing waits on you.'),
  row(1, 'Meta: repository', HEAD(), ALL, 'acme/widgets'),
  row(1, 'Meta: approved by', HEAD(), AFTER_APPROVAL, 'Approved by pierre'),
  row(1, 'Primary: Review and approve', HEAD(), ['approval'], 'Review and approve'),
  row(1, 'Primary: Review the plan', HEAD(), ['tech-approval'], 'Review the plan'),
  row(1, 'Primary: Answer the outbox', HEAD(), ['outbox'], 'Answer 2 items'),
  row(1, 'Primary: Review the feature', HEAD(), ['ready'], 'Review the feature'),
  row(1, 'Primary: Pitch', HEAD(), ['shipped'], 'Pitch'),
  row(1, 'Primary: Read the breaks', HEAD(), ['main-broke'], 'Read the breaks'),
  row(1, 'Actions menu', HEAD(), ['approval'], 'Actions'),
  row(1, 'Copy link', HEAD(), ALL, 'Copy link'),
  row(1, 'Send to terminal', HEAD(), ['approval'], 'Send to terminal', { proved: '../../../runners/send/SendToTerminal.render.test.ts' }),
  row(1, 'Delete draft', HEAD(), ['draft'], 'Delete draft', { proved: 'render.test.ts' }),

  // 2 · The stage and the tab row
  row(2, 'Stage: Idea', HEAD(), ALL, 'Idea'),
  row(2, 'Stage: PRD', HEAD(), ALL, 'PRD'),
  row(2, 'Stage: Inbox', HEAD(), ALL, 'Inbox'),
  row(2, 'Stage: Building', HEAD(), ALL, 'Building'),
  row(2, 'Stage: Outbox', HEAD(), ALL, 'Outbox'),
  row(2, 'Stage: Shipped', HEAD(), ALL, 'Shipped'),
  row(2, 'Stage: Retro', HEAD(), ALL, 'Retro'),
  row(2, 'Stage: current mark', HEAD(), ALL, 'omni-stage-track__stage--current', { html: true }),
  row(2, 'Stage: waits for your approval', HEAD(), ['approval'], 'PRD · waits for your approval'),
  row(2, 'Stage: waits for your Tech Approval', HEAD(), ['tech-approval'], 'PRD · waits for your Tech Approval'),
  row(2, 'Stage: building progress', HEAD(), ['outbox'], 'Building · 3 of 5 slices'),
  row(2, 'Stage: outbox progress', HEAD(), ['ready'], 'Outbox · 3 of 5 slices'),
  row(2, 'Tab: Brainstorm', HEAD(), ALL, 'Brainstorm'),
  row(2, 'Tab: Specifications', HEAD(), ALL, 'Specifications'),
  row(2, 'Tab: User voice', HEAD(), ALL, 'User voice'),
  row(2, 'Tab: Outbox', HEAD(), ALL, 'Outbox'),
  row(2, 'Tab: Feature', HEAD(), ALL, 'Feature'),
  row(2, 'Tab: Retro', HEAD(), ALL, 'Retro'),
  row(2, 'Tab: Timeline', HEAD(), ALL, 'Timeline'),
  row(2, 'Tab count: questions answered', HEAD(), ALL, '1/2'),
  row(2, 'Tab count: spec version', HEAD(), ALL, 'v2'),
  row(2, 'Tab count: voice version', HEAD(), ALL, 'v1'),
  row(2, 'Tab count: open outbox items', HEAD(), ['outbox'], '2 open'),
  row(2, 'Tab count: open reviews', HEAD(), ['approval', 'tech-approval', 'outbox', 'ready'], '1 open'),
  row(2, 'Tab count: retro merged', HEAD(), ['shipped'], 'merged'),

  // 3 · Brainstorm and User voice
  row(3, 'Brainstorm: progress', tab('brainstorm'), ALL, '1 of 2 answered'),
  row(3, 'Brainstorm: rounds to answer', tab('brainstorm'), ['draft'], '1 to answer'),
  row(3, 'Brainstorm: round category', tab('brainstorm'), ALL, 'UX/UI'),
  row(3, 'Brainstorm: who answered, and how', tab('brainstorm'), ALL, 'answered by'),
  row(3, 'Brainstorm: the chosen option', tab('brainstorm'), ALL, 'Square'),
  row(3, 'Brainstorm: recommended mark', tab('brainstorm'), ALL, 'Recommended'),
  row(3, 'Brainstorm: who asked', tab('brainstorm'), ALL, 'asked by'),
  row(3, 'Brainstorm: Open the question', tab('brainstorm'), ALL, 'Open the question'),
  row(3, 'Brainstorm: open round not answered yet', tab('brainstorm'), ALL, 'not answered yet'),
  row(3, 'Brainstorm: round when and where', tab('brainstorm'), ALL, 'acme/widgets · main · /omni:brainstorm'),
  row(3, 'Brainstorm: quick round buttons', tab('brainstorm'), ['draft'], 'Hexagonal', { proved: 'render.test.ts' }),
  row(3, 'User voice: version picker', tab('voice'), ALL, 'Version'),
  row(3, 'User voice: Rework with this feedback', tab('voice'), NUMBERED, 'Rework with this feedback'),
  row(3, 'User voice: the rework command', tab('voice'), NUMBERED, '/omni:brainstorm --rework 216'),
  row(3, 'User voice: persona by round grid', tab('voice'), ALL, 'could not be read', { proved: 'voice-render.test.ts' }),

  // 4 · Specifications
  row(4, 'Segment: Before/after', seg('before-after'), ALL, 'Before/after'),
  row(4, 'Segment: Spec', seg('spec'), ALL, 'Spec'),
  row(4, 'Segment: Plan', seg('plan'), ALL, 'Plan'),
  row(4, 'Segment: Approval record', seg('approval'), NUMBERED, 'Approval record'),
  row(4, 'Version picker: the version, its date and who', seg('spec'), ALL, 'v1 · 27 Sep · Pierre (kit)'),
  row(4, 'Version picker: an older version from GitHub', seg('spec'), ALL, 'v2 · 28 Sep · commit a1b2c3d (github)'),
  row(4, 'Version picker: opens the list of versions', seg('spec'), ALL, 'dossier-version__list', { html: true }),
  row(4, 'Before/after: the framed page', seg('before-after'), ALL, '/v/1/page', { html: true }),
  row(4, 'Before/after: sandbox caption', seg('before-after'), ALL, 'sandboxed · no cookies · no network'),
  row(4, 'Before/after: open on its own', seg('before-after'), ALL, 'open on its own'),
  row(4, 'Spec: the front-matter line', seg('spec'), ALL, 'prd: 216'),
  row(4, 'Spec: the markdown', seg('spec'), ALL, 'Quotes keep working offline.'),
  row(4, 'Plan: the markdown', seg('plan'), ALL, 'Quotes keep working offline.'),
  row(4, 'One line to the review screen: approval', seg('before-after'), ['approval'], 'This version waits for your approval.'),
  row(4, 'One line to the review screen: link', seg('before-after'), ['approval'], '/review"', { html: true }),
  row(4, 'One line to the review screen: Tech Approval', seg('before-after'), ['tech-approval'], 'The plan waits for your Tech Approval.'),
  row(4, 'Approval record: nothing approved yet', seg('approval'), ['approval'], 'No approval is in force yet.'),
  row(4, 'Approval record: approved by', seg('approval'), AFTER_APPROVAL, 'Approved by pierre'),
  row(4, 'Approval record: files pinned', seg('approval'), AFTER_APPROVAL, '2 files pinned'),
  row(4, 'Approval record: a pinned file and its hash', seg('approval'), AFTER_APPROVAL, 'spec.md'),
  row(4, 'Approval record: a pinned file with no hash', seg('approval'), AFTER_APPROVAL, 'before-after.html'),
  row(4, 'Approval record: attestation table', seg('approval'), NUMBERED, 'attestation', { proved: 'Attestation.service.test.ts' }),
  row(4, 'Approval record: business-law verdict', seg('approval'), NUMBERED, 'Business laws', { proved: 'business-laws-render.test.ts' }),
  row(4, 'About this PRD: repository', seg('approval'), ALL, 'Repository'),
  row(4, 'About this PRD: On GitHub', seg('approval'), NUMBERED, 'On GitHub'),
  row(4, 'About this PRD: issue', seg('approval'), NUMBERED, 'issue #216'),
  row(4, 'About this PRD: phase-0 PR', seg('approval'), NUMBERED, 'phase-0 #220'),
  row(4, 'About this PRD: feature PR', seg('approval'), NUMBERED, 'feature #221'),
  row(4, 'About this PRD: retro PR', seg('approval'), ['shipped'], 'retro #230'),
  row(4, 'About this PRD: CI and conflict chip', seg('approval'), ['approval', 'tech-approval', 'outbox', 'ready'], 'CI red · conflict · 1 open'),
  row(4, 'About this PRD: approval state', seg('approval'), NUMBERED, 'Approval'),
  row(4, 'About this PRD: Main', seg('approval'), ['shipped'], 'Watching · 5 days left'),
  row(4, 'About this PRD: who opened it', seg('approval'), ALL, 'opened by'),
  row(4, 'About this PRD: the product picker', seg('approval'), ALL, 'Product', { proved: 'ProductPicker.test.ts' }),

  // 5 · Outbox
  row(5, 'Outbox: the context rail', tab('outbox'), ['outbox'], 'Context'),
  row(5, 'Outbox: Or answer on the pull request', tab('outbox'), ['outbox'], 'Or answer'),
  row(5, 'Outbox: Select every recommendation', tab('outbox'), ['outbox'], 'Select every recommendation'),
  row(5, 'Outbox: Send n answers', tab('outbox'), ['outbox'], 'Send 0 answers'),
  row(5, 'Outbox: sending is not open', tab('outbox'), ['outbox'], 'Sending from this page is not open yet'),
  row(5, 'Outbox: the human-action card', tab('outbox'), ['outbox'], 'needs a person'),
  row(5, 'Outbox: the person\'s steps', tab('outbox'), ['outbox'], 'Set the secret.'),
  row(5, 'Outbox: Done / Not done', tab('outbox'), ['outbox'], 'Not done'),
  row(5, 'Outbox: an item\'s rank', tab('outbox'), ['outbox'], 'high'),
  row(5, 'Outbox: an item\'s question', tab('outbox'), ['outbox'], 'Question s1-01-colour?'),
  row(5, 'Outbox: Decision taken', tab('outbox'), ['outbox'], 'Decision taken'),
  row(5, 'Outbox: the options', tab('outbox'), ['outbox'], 'built · recommended'),
  row(5, 'Outbox: not numbered yet', tab('outbox'), ['outbox'], 'Not numbered yet'),
  row(5, 'Outbox: Adopted unless you object', tab('outbox'), ['outbox'], 'Adopted unless you object'),
  row(5, 'Outbox: Object', tab('outbox'), ['outbox'], 'Object', { proved: 'outbox-render.test.ts' }),
  row(5, 'Outbox: Settled', tab('outbox'), ['outbox'], 'Settled'),
  row(5, 'Outbox: a settled item\'s verdict and reply', tab('outbox'), ['outbox'], 'A. Keep it.'),
  row(5, 'Outbox: empty', tab('outbox'), ['approval', 'tech-approval', 'ready', 'shipped', 'main-broke'], 'No decision yet', { proved: 'outbox-render.test.ts' }),
  row(5, 'Outbox: after Send', tab('outbox'), ['outbox'], 'Sent as', { proved: 'OutboxSend.test.ts' }),

  // 6 · Feature
  row(6, 'Ready: the headline', tab('feature'), ['ready'], 'Ready for review · 5 of 5'),
  row(6, 'Ready: who judged it', tab('feature'), ['ready'], 'Omni App · a41f9c2 · 07:00 UTC'),
  row(6, 'Ready: a check and its state', tab('feature'), ['ready'], 'CI green on the latest commit'),
  row(6, 'Ready: a check\'s evidence', tab('feature'), ['ready'], 'Evidence'),
  row(6, 'Ready: a criterion and its proof', tab('feature'), ['ready'], 'AC-1'),
  row(6, 'Ready: a criterion\'s steps', tab('feature'), ['ready'], 'Then it saves'),
  row(6, 'Ready: not merged, only a person merges', tab('feature'), ['ready'], 'Only a person merges.'),
  row(6, 'Ready: Review PR', tab('feature'), ['ready'], 'Review PR 221'),
  row(6, 'PR care: Open the feature PR', tab('feature'), ['ready', 'shipped', 'main-broke'], 'PR care'),
  row(6, 'PR care: CI', tab('feature'), ['ready'], 'CI'),
  row(6, 'PR care: conflicts', tab('feature'), ['ready'], 'conflicting with main'),
  row(6, 'PR care: review counts', tab('feature'), ['ready'], '0 open · 1 fixed · 0 pushed back · 1 asked'),
  row(6, 'PR care: a thread and its verdict', tab('feature'), ['ready'], 'asked: the PM decides'),
  row(6, 'PR care: a thread\'s reason', tab('feature'), ['ready'], 'Fixed in a1b2c3d.'),
  row(6, 'PR care: on GitHub link', tab('feature'), ['ready'], 'on GitHub'),
  row(6, 'PR care: the watcher line', tab('feature'), ['ready'], 'The agent is watching · last round 1 min ago'),
  row(6, 'PR care: nothing left to look after', tab('feature'), ['shipped', 'main-broke'], 'nothing is left to look after'),
  row(6, 'PR care: no feature PR yet', tab('feature'), ['draft'], 'The feature PR opens once the first slice is built.'),
  row(6, 'Proof: the run picker', tab('feature'), ['ready', 'shipped'], 'Run 1 · 30 Sep · commit a1b2c3d · Pierre'),
  row(6, 'Proof: the commit', tab('feature'), ['ready', 'shipped'], 'a1b2c3d'),
  row(6, 'Proof: where it was recorded', tab('feature'), ['ready', 'shipped'], 'https://preview.test/prd'),
  row(6, 'Proof: the verdict counts', tab('feature'), ['ready', 'shipped'], 'Verdicts'),
  row(6, 'Proof: a criterion row', tab('feature'), ['ready', 'shipped'], 'The tab shows a player'),
  row(6, 'Proof: a failing note', tab('feature'), ['ready', 'shipped'], 'expected x'),
  row(6, 'Proof: the script fold', tab('feature'), ['ready', 'shipped'], '1.spec.ts'),
  row(6, 'Proof: a clip that cannot load', tab('feature'), ['ready', 'shipped'], 'The clip could not be loaded.'),
  row(6, 'After merge: the status', tab('feature'), ['shipped', 'main-broke'], 'After merge'),
  row(6, 'After merge: watching', tab('feature'), ['shipped'], 'Watching · 5 days left'),
  row(6, 'After merge: nothing broke', tab('feature'), ['shipped'], 'Nothing broke main so far.'),
  row(6, 'After merge: Broke main', tab('feature'), ['main-broke'], 'Broke main'),
  row(6, 'After merge: first signal', tab('feature'), ['main-broke'], 'First signal'),
  row(6, 'After merge: a break and its link', tab('feature'), ['main-broke'], 'lint job'),
  row(6, 'After merge: the parent commit', tab('feature'), ['main-broke'], 'the parent commit was green'),
  row(6, 'After merge: the rewind\'s finding', tab('feature'), ['main-broke'], 'The lint was red on the slice.'),
  row(6, 'After merge: Approve / Reject', tab('feature'), ['main-broke'], 'Reject'),
  row(6, 'After merge: its evidence and fix', tab('feature'), ['main-broke'], 'Require the lint job.'),
  row(6, 'After merge: no rewind yet', tab('feature'), ['main-broke'], 'No rewind yet', { proved: 'MainPane.test.ts' }),
  row(6, 'After merge: unread signals', tab('feature'), ['shipped'], 'Could not read', { proved: 'MainPane.test.ts' }),

  // 7 · Retro, Timeline, the review screen and the fix pages
  row(7, 'Retro: the retro', tab('retro'), ['shipped'], 'It went well.'),
  row(7, 'Retro: Open the retro PR', tab('retro'), ['shipped'], 'Open the retro PR'),
  row(7, 'Retro: empty', tab('retro'), ['draft', 'approval', 'tech-approval', 'outbox', 'ready', 'main-broke'], 'The retro is written when the feature PR merges.'),
  row(7, 'Pitch: the audience', tab('retro'), ['shipped'], 'Customers'),
  row(7, 'Pitch: the look and its maker', tab('retro'), ['shipped'], 'Arcade poster'),
  row(7, 'Pitch: the slide copy', tab('retro'), ['shipped'], 'Work anywhere.'),
  row(7, 'Pitch: the five downloads', tab('retro'), ['shipped'], 'pitch-square.mp4'),
  row(7, 'Pitch: Copy GIF link', tab('retro'), ['shipped'], 'Copy GIF link'),
  row(7, 'Pitch: Make a pitch', tab('retro'), ['shipped'], 'Pitch', { proved: 'pitch-render.test.ts' }),
  row(7, 'Timeline: empty', tab('timeline'), ALL, 'No timeline for this page.'),
  row(7, 'Timeline: the PRD lane and one lane per repository', tab('timeline'), ALL, 'lane', { proved: '../../../timeline/view.test.tsx' }),
  row(7, 'Review: eyebrow and title', { page: 'review', kind: 'approve' }, [], 'PRD 216 · Offline quotes'),
  row(7, 'Review: Review and approve', { page: 'review', kind: 'approve' }, [], 'Review and approve'),
  row(7, 'Review: what changed', { page: 'review', kind: 'approve' }, [], '1 · What changed'),
  row(7, 'Review: the diff', { page: 'review', kind: 'approve' }, [], '+ two'),
  row(7, 'Review: the business-law verdict', { page: 'review', kind: 'approve' }, [], '2 · Business laws'),
  row(7, 'Review: what you approve', { page: 'review', kind: 'approve' }, [], '3 · What you approve'),
  row(7, 'Review: the plan line', { page: 'review', kind: 'approve' }, [], 'The plan: Plan v1 · 5 slices'),
  row(7, 'Review: the pinned files', { page: 'review', kind: 'approve' }, [], 'Pins Spec v1, Plan v1, Before/after v1.'),
  row(7, 'Review: Approve', { page: 'review', kind: 'approve' }, [], 'Approve'),
  row(7, 'Review: Back to the PRD', { page: 'review', kind: 'approve' }, [], 'Back to the PRD'),
  row(7, 'Review the plan: the plan first', { page: 'review', kind: 'tech' }, [], '1 · The plan'),
  row(7, 'Review the plan: Give Tech Approval', { page: 'review', kind: 'tech' }, [], 'Give Tech Approval'),
  row(7, 'Review the feature: the Ready checks', { page: 'review', kind: 'feature' }, [], '1 · Ready checks'),
  row(7, 'Review the feature: each criterion\'s proof', { page: 'review', kind: 'feature' }, [], '2 · Proof of each criterion'),
  row(7, 'Review the feature: Merge on GitHub', { page: 'review', kind: 'feature' }, [], 'Merge on GitHub'),
  row(7, 'Fix page: kind and number', { page: 'fix' }, [], 'Visual fix · #548'),
  row(7, 'Fix page: its own track', { page: 'fix' }, [], 'Released'),
  row(7, 'Fix page: its tabs', { page: 'fix' }, [], 'Variations'),
  row(7, 'Fix page: About this fix, its issue and PR', { page: 'fix' }, [], 'PR #562'),
  row(7, 'Fix page: its timeline', { page: 'fix' }, [], 'Picked C'),
  row(7, 'Fix page: a round of variations', { page: 'fix', tab: 'variations' }, [], 'Round 1 · 29 Sep · Pierre (kit)'),
  row(7, 'Fix page: Before/after', { page: 'fix', tab: 'before-after' }, [], 'sandboxed · no cookies · no network'),
  row(7, 'Fix page: Questions empty', { page: 'fix', tab: 'questions' }, [], 'No question yet.'),
];
