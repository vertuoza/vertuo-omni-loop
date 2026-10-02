import { personaGrid } from '@omni/design';
import { pixelSvg } from '../../design/pixel-svg';
import { StageHeaderCopy } from './StageHeaderCopy';
import type { VoiceCell, VoiceRow, VoiceView } from './voice';

// The User voice tab (PRD 822, s3), drawn from ./voice.ts on the server: a grid with one row per
// persona — portrait (PRD 799's sprite, else the name's initial), name, stance chip, latest reaction —
// and one column per round, each score with its move. Tapping a score opens that round's reaction (a
// <details>, so it works before any script runs). Under the grid, each round with its fit line and its
// objection, outlined with how it was settled. Rework with this feedback copies the brainstorm's rework
// of the PRD. At 393 px the grid scrolls inside its own box, never the page (dossier.css).

export const REWORK_LABEL = 'Rework with this feedback';
const STANCE_LABEL = { excited: 'Excited', neutral: 'Neutral', skeptical: 'Skeptical' } as const;
const MOVE_WORDS = { '▲': 'up', '▼': 'down', '=': 'the same' } as const;

function Portrait({ row }: { row: VoiceRow }) {
  if (row.portrait) {
    try {
      const svg = pixelSvg(personaGrid(row.portrait.trade, row.portrait.avatar), { scale: 1, title: row.name });
      return <span className="voice-portrait" dangerouslySetInnerHTML={{ __html: svg }} />;
    } catch {
      // A trade the design no longer draws falls back to the initial.
    }
  }
  return <span className="voice-portrait voice-portrait-none" role="img" aria-label={row.name}>{row.initial}</span>;
}

function Score({ cell, name, round }: { cell: VoiceCell; name: string; round: string }) {
  if (cell.score === null) return <span className="voice-none" aria-label={`${name} sat out ${round}`}>—</span>;
  const said = cell.move ? `${cell.from} → ${cell.score}, ${MOVE_WORDS[cell.move]}` : cell.score;
  return (
    <details className="voice-score">
      <summary aria-label={`${name}, ${round}: ${said}. Show the reaction`}>
        <strong>{cell.score}</strong>
        {cell.move && <span className="voice-move" data-move={MOVE_WORDS[cell.move]}>{cell.move}</span>}
      </summary>
      <p className="voice-reaction">
        {cell.move && <span className="ask-hint">{cell.words} · </span>}
        {cell.reaction}
      </p>
    </details>
  );
}

function Grid({ view }: { view: VoiceView }) {
  return (
    <div className="voice-scroll">
      <table className="voice-grid">
        <thead>
          <tr>
            <th scope="col">Persona</th>
            {view.rounds.map((r) => (
              <th key={r.stage} scope="col">{r.label}<small>{r.date}</small></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">
                <span className="voice-persona">
                  <Portrait row={row} />
                  <span className="voice-who">
                    <strong>{row.name}</strong>
                    <span className="voice-stance" data-stance={row.stance}>{STANCE_LABEL[row.stance]}</span>
                    <span className="voice-latest">{row.latest}</span>
                  </span>
                </span>
              </th>
              {row.cells.map((cell, i) => (
                <td key={cell.stage} className={cell.objected ? 'voice-cell voice-objected' : 'voice-cell'}>
                  <Score cell={cell} name={row.name} round={view.rounds[i]!.label} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VoicePane({ view, rework }: { view: VoiceView | null; rework: string | null }) {
  return (
    <div className="voice">
      {rework && (
        <div className="voice-rework">
          <StageHeaderCopy label={REWORK_LABEL} command={rework} />
        </div>
      )}
      {view ? (
        <>
          <Grid view={view} />
          <ol className="voice-rounds" aria-label="Rounds">
            {view.rounds.map((r) => (
              <li key={r.stage} className="voice-round">
                <h3>{r.label} <small className="ask-hint">{r.date}</small></h3>
                {r.fit && <p className="voice-fit">{r.fit}</p>}
                {r.objection ? (
                  <blockquote className="voice-objection" data-settled={r.objection.settled}>
                    <p><strong>{r.objection.persona} objects:</strong> {r.objection.text}</p>
                    <p className="voice-cites">{r.objection.citations.join(' · ')}</p>
                    <p className="voice-settled">{r.objection.settled}</p>
                  </blockquote>
                ) : (
                  <p className="ask-hint">Nobody objected.</p>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="ask-problem" role="alert">This version could not be read. Reload the page in a moment.</p>
      )}
    </div>
  );
}
