// The omni-hud band's runner rows (PRD 2251 s5), run by `claude plugin test kit/plugin-hud`, never by
// vitest: the same world as hud.test.tsx, kept apart from it since that file proves a locked law.
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

// PRD 2251 s5: the runner rows, `omni now`'s `runners` and `runner` fields, each hidden when absent.
describe('the runner rows', () => {
  test('draws the free slots and the followed job\'s last milestone, below the work', async ($, on) => {
    world(on, json({ ...PRD, runners: { free: 3, slots: 8 }, runner: { line: 'PRD 2223 on box-1 · 1/2 slices merged' } }))
    await start($)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
      expect((await ui.find({ key: 'runners' }))?.text).toBe('runners 3/8 slots free')
      expect((await ui.find({ key: 'runner' }))?.text).toBe('PRD 2223 on box-1 · 1/2 slices merged')
      expect((await ui.find({ key: 'work' }))?.text).toContain('PRD 315')
      await ui.unmount()
    }
  })

  test('hides each row when its field is absent or null, and draws them alone on a session on nothing', async ($, on) => {
    const { answer } = world(on, json({ ...PRD, runners: null }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'runners' })).toBeUndefined()
    expect(await ui.find({ key: 'runner' })).toBeUndefined()
    answer(json({ ...NOTHING, runners: { free: 1, slots: 2 } }))
  })

  test('draws nothing on a runners field of another shape', async ($, on) => {
    world(on, json({ ...PRD, runners: { free: 'many' } }))
    await start($)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'runners' })).toBeUndefined()
    expect(await ui.find({ key: 'work' })).toBeUndefined()
  })
})
