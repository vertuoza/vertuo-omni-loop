// The omni-hud mod (PRD 1208's spec, "The band"): a band above the prompt drawn from
// `omni now --json`, and the slash command that turns it off and on. It only draws: it reads
// nothing but `omni now`'s answer, sends nothing anywhere and changes no file.
//
// - **When it asks.** `node <project root>/.omni-loop/bin/omni.mjs now --json --session <id>`, at
//   the session's start, after a tool call (at most once every 10 seconds) and every 30 seconds.
//   The latest answer is held in `$.state`, so the band redraws when it changes. While the answer
//   holds an approval wait (PRD 1322's s5), it asks again every 5 seconds, so the approved line shows
//   within seconds, and once more when its toast ends, so the highlight lasts 10 seconds.
// - **Hidden** while the session is on nothing, while the command fails or prints no answer of
//   `omni now`'s shape, while a survey holds the band, and while the person turned it off.
// - **The command** turns the band off, or on again, for this person across sessions (`$.store`).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { HudNow } from '../types/index.d.ts'
import { bandRows, parseNow, waitAgainIn } from './band.ts'

const OFF_KEY = 'isOff'
const EVERY_MS = 30_000
const AFTER_TOOL_MS = 10_000

const now = atom({ plugin: 'omni-hud', key: 'now' } as const, null)
const isOff = atom({ plugin: 'omni-hud', key: 'isOff' } as const, false)

/** When the band last asked `omni now`, in `$.clock.now()`'s milliseconds. */
let askedAt = Number.NEGATIVE_INFINITY
/** The next ask an approval wait asked for, cancelled by any ask before it. */
let waitAgain: Timer | null = null

/** Asks `omni now --json` and holds its answer, `null` when it failed or had another shape. */
async function ask($: EngineInterface): Promise<void> {
  askedAt = await $.clock.now()
  let answer: HudNow | null = null
  try {
    const root = await $.session.root()
    const session = await $.session.id()
    const run = await $.process.run(['node', `${root}/.omni-loop/bin/omni.mjs`, 'now', '--json', '--session', session], { cwd: root })
    answer = run.exitCode === 0 ? parseNow(run.stdout) : null
  } catch {
    answer = null
  }
  await update($, now, () => answer)
  waitAgain?.cancel()
  const again = waitAgainIn(answer, await $.clock.now())
  waitAgain = again === null ? null : $.clock.after(again, () => void ask($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'omni-hud', description: 'Turn the Omni band above the prompt off, or on again' })
    const stored = await $.store.get(OFF_KEY)
    await update($, isOff, () => stored === true)
    await ask($)
    $.clock.every(EVERY_MS, () => void ask($))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if ((await $.clock.now()) - askedAt >= AFTER_TOOL_MS) $.clock.after(0, () => void ask($))
    return result
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'omni-hud' }, async $ => {
    const off = !(await read($, isOff))
    await $.store.set(OFF_KEY, off)
    await update($, isOff, () => off)
    return { text: off ? 'The Omni band is off. Type /omni-hud to turn it on again.' : 'The Omni band is on.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isOff))) return next(e)
    const rows = bandRows(await read($, now))
    if (rows.length === 0) return next(e)
    const { Box, Link, Text } = $.ui.resolve(e)
    return (
      <Box key="omni-hud" flexDirection="column">
        {rows.map(row => (
          <Box key={row.key}>
            <Text wrap="truncate-end" {...(row.toast ? { inverse: true, bold: true } : {})}>
              {row.parts.flatMap((part, index) => [
                ...(index > 0 ? [<Text dimColor> · </Text>] : []),
                'href' in part ? <Link href={part.href} label={part.label} /> : <Text>{part.text}</Text>,
              ])}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
