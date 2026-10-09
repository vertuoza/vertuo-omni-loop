// The omni-hud band (PRD 1208 s6), run by `claude plugin test kit/plugin-hud`, never by vitest: fed
// fixed `omni now --json` answers through a `process.run` hook beneath the plugin.
import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ProcessRunResult } from 'claude-code'

const ROOT = '/work/repo'
const PLUGIN = 'omni-hud'
const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const NOTHING = { headline: null, work: null, doing: null }

const PRD = {
  headline: null,
  work: {
    kind: 'prd',
    number: 315,
    topic: 'help-and-status',
    stage: 'building',
    slices: [
      { id: 's3', name: 'tabs', state: 'in-flight' },
      { id: 's4', name: 'board', state: 'claimed-stale' },
      { id: 's5', name: 'stuck one', state: 'stuck' },
    ],
    links: [
      { label: 'PRD page', href: 'https://example.test/prd/315' },
      { label: 'feature PR #1210', href: 'https://github.com/o/r/pull/1210' },
      { label: 'phase-0 PR #1201', href: 'https://github.com/o/r/pull/1201' },
    ],
  },
  doing: 'building s3 tabs, s4 board',
}

const ROADMAP = {
  headline: { kind: 'roadmap', number: 7, progress: '3/7 merged', links: [{ label: 'roadmap page', href: 'https://example.test/roadmap/7' }] },
  work: { ...PRD.work, links: [] },
  doing: 'step 4: wave PRD 315 · s3 merged',
}

type Answer = { exitCode: number; stdout: string }

const answered = ({ exitCode, stdout }: Answer): ProcessRunResult => ({
  exitCode,
  stdout,
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
})

/** The world beneath the plugin: the session, the store, the clock, and `omni now`'s answer. */
function world(on: On, first: Answer, store: Record<string, unknown> = {}) {
  const runs: string[][] = []
  const state = { answer: first }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: ROOT }))
  on('session.id', () => ({ value: 'session-1' }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  on('process.run', (_$, e) => {
    runs.push([...e.argv])
    return { value: answered(state.answer) }
  })
  mock.store(on, store)
  const clock = mock.clock(on, { now: 1_000_000 })
  return { runs, clock, answer: (next: Answer) => (state.answer = next) }
}

const json = (value: unknown): Answer => ({ exitCode: 0, stdout: `${JSON.stringify(value)}\n` })

async function start($: Engine) {
  await $.session.start({ cwd: ROOT, surface: 'terminal', isInteractive: true })
}

describe('the band', () => {
  test('draws the work and its links in rows, each link a Link with its href', async ($, on) => {
    const { runs } = world(on, json(PRD))
    await start($)
    expect(runs[0]).toEqual(['node', `${ROOT}/.omni-loop/bin/omni.mjs`, 'now', '--json', '--session', 'session-1'])
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
      expect((await ui.find({ key: 'work' }))?.text).toBe('PRD 315 help-and-status · building · now: s3 tabs, s4 board')
      const links = await ui.findAll({ type: 'Link' })
      expect(links.map((link) => [link.props.label, link.props.href])).toEqual(PRD.work.links.map((link) => [link.label, link.href]))
      expect(await ui.find({ key: 'headline' })).toBeUndefined()
      await ui.unmount()
    }
  })

  test('draws three rows under a roadmap: the headline, the work with doing, no links row', async ($, on) => {
    world(on, json({ ...ROADMAP, work: PRD.work }))
    await start($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
      expect((await ui.find({ key: 'headline' }))?.text).toBe('roadmap 7 · 3/7 merged · roadmap page')
      expect((await ui.find({ key: 'work' }))?.text).toBe('PRD 315 help-and-status · building · step 4: wave PRD 315 · s3 merged')
      expect((await ui.find({ key: 'links' }))?.text).toBe('PRD page · feature PR #1210 · phase-0 PR #1201')
      expect(await ui.findAll({ type: 'Link' })).toHaveLength(4)
      await ui.unmount()
    }
  })

  test('names a bug fix by its number', async ($, on) => {
    world(on, json({ headline: null, work: { kind: 'bug', number: 1180, topic: 'login-redirect', stage: 'fix PR open', slices: [], links: [] }, doing: null }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await ui.find({ key: 'work' }))?.text).toBe('bug #1180 login-redirect · fix PR open')
    expect(await ui.find({ key: 'links' })).toBeUndefined()
  })

  for (const [name, answer] of [
    ['no work and no headline', json(NOTHING)],
    ['a failed command', { exitCode: 1, stdout: '' }],
    ['bad JSON', { exitCode: 0, stdout: '{"work": ' }],
    ['JSON of another shape', json({ work: { kind: 'prd' } })],
  ] as const) {
    test(`draws nothing on ${name}`, async ($, on) => {
      world(on, answer)
      await start($)
      for (const surface of SURFACES) {
        const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
        expect(await ui.find({ key: 'work' })).toBeUndefined()
        expect(await ui.findAll({ type: 'Link' })).toHaveLength(0)
        await ui.unmount()
      }
    })
  }

  test('yields to a survey', async ($, on) => {
    world(on, json(PRD))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })
    expect(await ui.find({ key: 'work' })).toBeUndefined()
  })
})

// PRD 1322 s5: the approval wait's line while `omni wait approval` waits, and the approved or voided
// line highlighted for 10 seconds (the toast), as `omni now` answers them.
const WAITING = { prd: 315, line: '◌ PRD 315 · waiting for Irisa or Paul', toast: false, until: null }
const APPROVED = '✓ PRD 315 approved by irisa · 2026-10-09T12:00:00.000Z · 3 files pinned'
const toast = (line: string, until: number) => ({ prd: 315, line, toast: true, until })
const highlighted = async (ui: { findAll: (query: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) =>
  (await ui.findAll({ type: 'Text' })).filter((text) => text.props.inverse === true)

describe('the approval wait', () => {
  test('draws the waiting line below the work, before its links, not highlighted', async ($, on) => {
    world(on, json({ ...PRD, wait: WAITING }))
    await start($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
      expect((await ui.find({ key: 'wait' }))?.text).toBe(WAITING.line)
      expect((await ui.find({ key: 'work' }))?.text).toBe('PRD 315 help-and-status · building · now: s3 tabs, s4 board')
      expect(await ui.find({ key: 'links' })).toBeDefined()
      expect(await ui.find({ key: 'toast' })).toBeUndefined()
      expect(await highlighted(ui)).toHaveLength(0)
      await ui.unmount()
    }
  })

  test('draws the waiting line alone for a session on nothing else', async ($, on) => {
    world(on, json({ ...NOTHING, wait: WAITING }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await ui.find({ key: 'wait' }))?.text).toBe(WAITING.line)
    expect(await ui.find({ key: 'work' })).toBeUndefined()
  })

  test('draws nothing on a wait of another shape', async ($, on) => {
    world(on, json({ ...PRD, wait: { prd: 315, line: 'x', toast: 'yes', until: null } }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'work' })).toBeUndefined()
    expect(await ui.find({ key: 'wait' })).toBeUndefined()
  })

  test('asks every 5 seconds while it waits, and shows the approved line within seconds', async ($, on) => {
    const { runs, clock, answer } = world(on, json({ ...PRD, wait: WAITING }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    await clock.advance(4_999)
    expect(runs).toHaveLength(1)
    answer(json({ ...PRD, wait: toast(APPROVED, 1_015_000) }))
    await clock.advance(1)
    expect(runs).toHaveLength(2)
    expect((await ui.find({ key: 'toast' }))?.text).toBe(APPROVED)
    expect(await ui.find({ key: 'wait' })).toBeUndefined()
  })

  test('highlights the approved line for 10 seconds, then asks again and draws what follows', async ($, on) => {
    const { runs, clock, answer } = world(on, json({ ...PRD, wait: toast(APPROVED, 1_010_000) }))
    await start($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
      expect((await ui.find({ key: 'toast' }))?.text).toBe(APPROVED)
      expect((await highlighted(ui)).length).toBeGreaterThan(0)
      await ui.unmount()
    }
    answer(json(PRD))
    await clock.advance(9_999)
    expect(runs).toHaveLength(1)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'toast' })).toBeDefined()
    await clock.advance(1)
    expect(runs).toHaveLength(2)
    expect(await ui.find({ key: 'toast' })).toBeUndefined()
    expect(await highlighted(ui)).toHaveLength(0)
    expect(await ui.find({ key: 'work' })).toBeDefined()
    await clock.advance(20_000)
    expect(runs).toHaveLength(3)
  })

  test('highlights the voided line, then draws the waiting line again', async ($, on) => {
    const voided = "✗ approval voided by paul's push 1234567→89abcde · asked again"
    const { clock, answer } = world(on, json({ ...PRD, wait: toast(voided, 1_010_000) }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect((await ui.find({ key: 'toast' }))?.text).toBe(voided)
    answer(json({ ...PRD, wait: WAITING }))
    await clock.advance(10_000)
    expect(await ui.find({ key: 'toast' })).toBeUndefined()
    expect((await ui.find({ key: 'wait' }))?.text).toBe(WAITING.line)
  })
})

describe('when it asks omni now', () => {
  test('every 30 seconds, and redraws from the latest answer', async ($, on) => {
    const { runs, clock, answer } = world(on, json(PRD))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(runs).toHaveLength(1)
    answer(json(NOTHING))
    await clock.advance(29_000)
    expect(runs).toHaveLength(1)
    await clock.advance(1_000)
    expect(runs).toHaveLength(2)
    expect(await ui.find({ key: 'work' })).toBeUndefined()
  })

  test('after a tool call, at most once every 10 seconds', async ($, on) => {
    const { runs, clock } = world(on, json(PRD))
    on('tool.call', () => ({ result: { text: 'ok' } }) as never)
    await start($)
    const call = () => $.tool.call({ tool: 'Read', input: { file_path: `${ROOT}/a` }, tool_use_id: `t${String(clock.now())}` } as never)
    await clock.advance(5_000)
    await call()
    await clock.settle()
    expect(runs).toHaveLength(1)
    await clock.advance(5_000)
    await call()
    await clock.settle()
    expect(runs).toHaveLength(2)
    await clock.advance(1_000)
    await call()
    await clock.settle()
    expect(runs).toHaveLength(2)
  })
})

describe('the command', () => {
  test('turns the band off, then on, and keeps it across sessions', async ($, on) => {
    world(on, json(PRD))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'work' })).toBeDefined()

    const off = await $.command.run({ command: 'omni-hud', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
    expect(off.text).toBe('The Omni band is off. Type /omni-hud to turn it on again.')
    expect(await ui.find({ key: 'work' })).toBeUndefined()
    await start($)
    expect(await ui.find({ key: 'work' })).toBeUndefined()

    const back = await $.command.run({ command: 'omni-hud', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
    expect(back.text).toBe('The Omni band is on.')
    expect(await ui.find({ key: 'work' })).toBeDefined()
    await start($)
    expect(await ui.find({ key: 'work' })).toBeDefined()
  })

  test('a session started with the band off draws nothing', async ($, on) => {
    world(on, json(PRD), { isOff: true })
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'work' })).toBeUndefined()
  })
})
