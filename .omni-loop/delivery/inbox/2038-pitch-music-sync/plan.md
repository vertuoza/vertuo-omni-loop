# Plan: Pitch music that lands on a measured rise, from tracks the person heard

PRD #2038, spec beside this plan (`spec.md`). The feature branch `feat/pitch-music-sync` merges into
`main` with `Closes #2038`. Each slice is a sub-PR from `feat/pitch-music-sync--<slice>` into
`feat/pitch-music-sync`, its body opening with `Part of #2038`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A track decoded by ffmpeg into mono 8 kHz samples is measured: its length, its rises and falls (`{ at, db }`), and its energy in 2-second blocks, by the method of `release-videos` | `kit/lib/pitch/energy` | — | 1 |
| s2 | Scenes take a unique `id`; `meta.music` takes `track` and a `sync` whose `scene` is an id or an index and whose `cue` is optional; the check refuses an unknown id and warns on an index | `kit/lib/pitch/storyboard.ts` `kit/lib/pitch/storyboard.test.ts` `kit/lib/pitch/check` | — | 1 |
| s4 | The music provider may `list({ mood, seconds })` and `pick` a given `track`; `freepd` lists the mood's tracks that cover the video and picks any pinned title; `file` and `none` do not list | `kit/lib/pitch/providers/` | — | 1 |
| s3 | The track's start is `cue − (the scene's start + at)`, the cue being the written one or the strongest measured rise, with scenes placed by one function the engine's timeline and the check share | `kit/lib/pitch/render-music` `kit/lib/pitch/scene-times` `kit/pitch-engine/timeline` | s1, s2 | 2 |
| s5 | `omni pitch music <dir>` lists the candidates (`--list`, `--mood`), or picks a track (`--track`, `meta.music.track`, the provider's pick), writes it with `music.json`, and prints its measure | `kit/lib/pitch/music-record` `kit/bin/commands/pitch-make` | s1, s2, s4 | 2 |
| s6 | `omni pitch check` reads `music.json`: a video starting before the track is an error; a track ending before the video, a cue off every rise, a track with no rise and a stale `music.json` are warnings | `kit/lib/pitch/check` | s3, s5 | 3 |
| s7 | `omni pitch render` reuses a matching `music.json`, otherwise picks and measures the track and names it; the track starts at its measured or written cue; `pitch.json` records track, cue and start; `TRACK_KEY_SECONDS` is gone | `kit/lib/pitch/render.ts` `kit/lib/pitch/render.test.ts` `kit/lib/pitch/render-music` `kit/bin/commands/pitch-make-render.test.ts` | s3, s5 | 3 |
| s8 | `/omni:pitch` gains its music step: scene ids, the listed tracks shown with their links and the person's pick awaited, the measure, the cue picked by the rule and said in one line; nothing when the settings ask for no music | `kit/plugin/skills/pitch/` | s5, s6, s7 | 4 |

**Shared ground.**

- `kit/lib/pitch/check` (`check.ts` and its test): s2 checks the sync's scene by id or index, s6 adds
  the findings that read `music.json` (waves 1 and 3).
- `kit/lib/pitch/render-music` (`render-music.ts` and its test): s3 adds the start from a cue and a
  measure, s7 removes `TRACK_KEY_SECONDS` and `audioOf`'s assumed second and wires the render to s3's
  function (waves 2 and 3).
- `kit/bin/commands/pitch-make-render.test.ts`: covered by s5's `kit/bin/commands/pitch-make` prefix,
  declared by s7 for the render's new stderr lines (waves 2 and 3).
- `kit/lib/pitch/storyboard.ts` is read by s3, s5, s6 and s7 but changed by s2 alone; `music-record`
  is written by s5 and read by s6 and s7; neither is declared by the readers.
- `kit/pitch-engine/timeline`: s3 alone. PRD 2030's s2 also changes `timeline.ts` (its still frame);
  whichever feature PR merges second takes the other's change in.
- `kit/dist/` is generated (`pnpm kit:build`): no slice lists or commits it; the wave rebuilds it.

## Per slice: done when

**s1: measuring a track**

- `energy.ts` turns samples at 8 kHz into 50 ms powers, rises (the next 1 s at least 3 dB louder than
  the 4 s before, the strongest within 8 s either side), falls (the same, quieter), 2-second energy
  blocks and the length, rounded to 0.01 s and 0.1 dB.
- On generated samples: 8 s quiet then 8 s loud gives one rise at 8 s; a steady tone gives none; two
  jumps 4 s apart give one rise, the larger; loud then quiet gives one fall.
- Decoding runs ffmpeg through an injected exec (mono, 8 kHz, 16-bit) and fails naming why when
  ffmpeg is missing or fails; the tests never run a real ffmpeg.

**s2: scene ids and the sync point**

- A scene accepts `id` (lower-case letters, digits, hyphens, 1 to 32 characters); two scenes with one
  id are refused, naming both paths.
- `meta.music` accepts `track` and `sync: { scene, at, cue? }`, `scene` an id or an index, `cue` at
  least 0; today's fixture storyboard parses unchanged.
- `omni pitch check` reports an error for `sync.scene: "wipe"` when no scene has the id `wipe`, keeps
  today's error for an index past the last scene and for an `at` past its scene's end (found by id
  too), and warns `name the scene by its id` for an index.

**s4: listing and picking tracks**

- The music interface has an optional `list({ mood, seconds }) → { title, seconds, url }[]`, and
  `pick` an optional `track`; the contract test holds for every registered provider.
- `freepd.list('upbeat', 30)` returns the upbeat tracks that cover 30 s with their archive addresses;
  a length no track covers returns the mood's longest; an unknown mood is refused naming the moods.
- `freepd.pick` with `track: 'Funshine'` downloads that title whatever the mood; an unknown title is
  refused naming the mood's titles; without `track`, the pick is today's.
- `file` and `none` have no `list`; `file` ignores `track`.

**s3: where the track starts**

- One function places the scenes on the video (start and length of each, transitions included);
  the engine's `buildTimeline` and the music placement both use it, and the engine's timeline tests
  still pass unchanged.
- For a scene `wipe` starting at 9 s, `sync: { scene: "wipe", at: 1, cue: 14 }` gives a start of 4 s;
  lengthening the scene before `wipe` by 2 s gives 2 s.
- Without `cue`, the cue is the strongest measured rise; with no rise, the start is 0; without
  `sync`, the start is 0. A start below 0 is returned as is, for the check to refuse and the render
  to clamp.

**s5: `omni pitch music`**

- `--list` prints `<n>. <title> · <m:ss> · <url>` per candidate for the settings' mood (or `--mood`)
  and the storyboard's longest length; an unknown mood exits 1 naming the moods; `file` and `none`
  print `no choice: the settings' music is <provider>` and exit 0.
- Without `--list`, the verb picks (`--track`, else `meta.music.track`, else the provider's pick),
  writes `music.<ext>` and `music.json` (`music`, `provider`, `track`, `file`, `seconds`, `licence`,
  `credit`, `rises`, `falls`, `energy`), and prints the track, its length, its energy blocks, its
  rises and its falls.
- With `none` it prints `no music: the settings ask for none` and writes nothing; a failed download
  or ffmpeg exits 1 with why, writing no `music.json`.
- `music-record.ts` reads and writes `music.json` with a strict schema; a file that does not read is
  reported, never trusted.
- Tests run on a faked network and a faked ffmpeg.

**s6: the check reads the music**

- With `music.json` in the run folder: an error when the sync starts the video before the track
  ("pick a later rise or a later scene", naming the start); warnings when the track ends before the
  video (by how many seconds), when `cue` is more than 0.5 s from every rise, when the track has no
  rise, and when `music.json` names another provider or track than `settings.json` and
  `meta.music.track`.
- Each finding's path is under `meta.music`; without `music.json` the findings of today's fixture are
  unchanged.

**s7: the render places the measured track**

- A `music.json` matching the settings' provider and `meta.music.track` is reused, its file not
  fetched again; otherwise the render picks through the provider, measures, and writes one stderr
  line naming the track and `omni pitch music <dir> --list`.
- The audio starts at s3's start; a start below 0 is clamped to 0 with one stderr line;
  `TRACK_KEY_SECONDS` no longer exists.
- A storyboard with a sync and no `cue` renders with the strongest measured rise on the sync point.
- `pitch.json`'s music records `track`, `cue` and `start` beside `provider`, `licence` and `credit`;
  a track that cannot be had still falls back to silence with one line.

**s8: the skill's music step**

- `kit/plugin/skills/pitch/SKILL.md` adds the step between the storyboard and the check, run only
  when the settings' provider is not `none`: ids on the scenes, `--list`, the numbered tracks with
  their links and the question "Listen to these and pick one by its number, or name another mood",
  no pick and no download before the answer, then `--track`, `meta.music.track`, the cue rule
  (strongest rise that starts the video at or after the track's beginning and lasts to its end,
  preferring no fall before the video's end, synced on the reveal) and the one line naming track,
  rise and scene.
- The step's music errors are fixed in the storyboard; the meta bullet names the sync by scene id
  and cue.
