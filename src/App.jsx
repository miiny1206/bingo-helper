import { useState, useMemo } from 'react'
import './App.css'

const N = 4
const TOTAL = N * N
const N_SIMS = 800

const LINES = (() => {
  const lines = []
  for (let r = 0; r < N; r++) {
    const row = []
    for (let c = 0; c < N; c++) row.push(r * N + c)
    lines.push({ name: `Row ${r + 1}`, cells: row })
  }
  for (let c = 0; c < N; c++) {
    const col = []
    for (let r = 0; r < N; r++) col.push(r * N + c)
    lines.push({ name: `Col ${c + 1}`, cells: col })
  }
  lines.push({ name: 'Diag 1', cells: [0, 5, 10, 15] })
  lines.push({ name: 'Diag 2', cells: [3, 6, 9, 12] })
  return lines
})()

const NEXT_STATE = { unknown: 'hit', hit: 'miss', miss: 'unknown' }

function lineStatus(line, cells) {
  let hits = 0
  let misses = 0
  for (const c of line.cells) {
    if (cells[c] === 'hit') hits++
    else if (cells[c] === 'miss') misses++
  }
  return { hits, misses, alive: misses === 0, complete: hits === N }
}

// Bayesian-smoothed P(hit) from observed picks. Prior 0.5, gradually shifts to empirical.
function adaptiveP(cells) {
  let hits = 0
  let misses = 0
  for (const c of cells) {
    if (c === 'hit') hits++
    else if (c === 'miss') misses++
  }
  const total = hits + misses
  if (total === 0) return 0.5
  const empirical = hits / total
  const weight = total / (total + 4) // smooth: needs ~4 observations to fully trust empirical
  return weight * empirical + (1 - weight) * 0.5
}

function pathCost(candidateIdx, truth, cells) {
  let bestRem = Infinity
  for (const line of LINES) {
    let unknowns = 0
    let dead = false
    for (const idx of line.cells) {
      const orig = cells[idx]
      const tVal = orig === 'unknown' ? truth[idx] : orig
      if (tVal === 'miss') { dead = true; break }
      if (orig === 'unknown' && idx !== candidateIdx) unknowns++
    }
    if (dead) continue
    if (unknowns < bestRem) bestRem = unknowns
  }
  if (!isFinite(bestRem)) return TOTAL + 5
  return 1 + bestRem
}

function bestPick(cells, p, nSims) {
  const enriched = LINES.map(l => ({ ...l, ...lineStatus(l, cells) }))
  if (enriched.some(l => l.complete)) return null
  if (enriched.every(l => !l.alive)) return null

  const aliveLineCells = new Set()
  for (const l of enriched) {
    if (l.alive) for (const idx of l.cells) aliveLineCells.add(idx)
  }

  const candidates = []
  for (let i = 0; i < TOTAL; i++) {
    if (cells[i] === 'unknown' && aliveLineCells.has(i)) candidates.push(i)
  }
  if (candidates.length === 0) return null

  const truths = Array.from({ length: nSims }, () => {
    const t = new Array(TOTAL)
    for (let i = 0; i < TOTAL; i++) {
      if (cells[i] === 'unknown') t[i] = Math.random() < p ? 'hit' : 'miss'
    }
    return t
  })

  let best = null

  for (const c of candidates) {
    let total = 0
    for (let s = 0; s < nSims; s++) {
      total += pathCost(c, truths[s], cells)
    }
    const expectedCost = total / nSims

    const passingLines = enriched.filter(l => l.alive && l.cells.includes(c))
    const aliveCount = passingLines.length
    const imminent = passingLines.some(l => l.hits === N - 1)

    if (
      best === null ||
      expectedCost < best.expectedCost - 1e-6 ||
      (Math.abs(expectedCost - best.expectedCost) < 1e-6 && aliveCount > best.aliveCount)
    ) {
      best = { idx: c, expectedCost, aliveCount, imminent, lines: passingLines }
    }
  }
  return best
}

export default function App() {
  const [cells, setCells] = useState(() => Array(TOTAL).fill('unknown'))

  const enriched = useMemo(
    () => LINES.map(l => ({ ...l, ...lineStatus(l, cells) })),
    [cells]
  )

  const bingoLine = useMemo(() => enriched.find(l => l.complete) || null, [enriched])

  const p = useMemo(() => adaptiveP(cells), [cells])

  const pick = useMemo(
    () => (bingoLine ? null : bestPick(cells, p, N_SIMS)),
    [cells, p, bingoLine]
  )

  const picks = cells.filter(c => c !== 'unknown').length
  const hitsTotal = cells.filter(c => c === 'hit').length
  const missTotal = cells.filter(c => c === 'miss').length
  const aliveLinesCount = enriched.filter(l => l.alive && !l.complete).length

  const handleCellClick = (i) => {
    setCells(prev => {
      const next = [...prev]
      next[i] = NEXT_STATE[next[i]]
      return next
    })
  }

  const handleReset = () => setCells(Array(TOTAL).fill('unknown'))

  const handleAuto = () => {
    if (!pick) return
    setCells(prev => {
      const next = [...prev]
      next[pick.idx] = 'hit'
      return next
    })
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Bingo Helper 4x4</h1>
        <p className="sub">
          Tap the highlighted cell. <b>1x</b> = hit, <b>2x</b> = miss, <b>3x</b> = clear.
          Algorithm picks the single optimal next cell. Just follow it.
        </p>
      </header>

      <div className="layout">
        <section className="board-section">
          {bingoLine && (
            <div className="bingo-banner">
              BINGO! Completed in <span>{picks}</span> picks.
            </div>
          )}

          <div className="grid">
            {cells.map((state, i) => {
              const isPick = pick && pick.idx === i
              const cls = [
                'cell',
                state !== 'unknown' ? state : '',
                isPick ? 'suggested suggested-tier-1' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <div
                  key={i}
                  className={cls}
                  onClick={() => handleCellClick(i)}
                >
                  <span className="idx">{i + 1}</span>
                  {isPick && <span className="rank">PICK</span>}
                </div>
              )
            })}
          </div>

          <div className="actions">
            <button onClick={handleReset}>Reset</button>
            <button onClick={handleAuto} disabled={!pick}>Auto pick</button>
          </div>
        </section>

        <aside className="info-section">
          <div className="stats">
            <div className="row">
              <span>Picks used</span>
              <b>{picks} / {TOTAL}</b>
            </div>
            <div className="row">
              <span>Hit / Miss</span>
              <span>
                <span style={{ color: '#22c55e' }}>{hitsTotal}</span>
                {' / '}
                <span style={{ color: '#ef4444' }}>{missTotal}</span>
              </span>
            </div>
            <div className="row">
              <span>Lines alive</span>
              <b>{aliveLinesCount} / {LINES.length}</b>
            </div>
            <div className="row">
              <span>Estimated P(hit)</span>
              <b>{Math.round(p * 100)}%</b>
            </div>
            {bingoLine ? (
              <div className="row">
                <span>Status</span>
                <b style={{ color: '#facc15' }}>BINGO on {bingoLine.name}</b>
              </div>
            ) : aliveLinesCount === 0 ? (
              <div className="row">
                <span>Status</span>
                <b style={{ color: '#ef4444' }}>No lines left</b>
              </div>
            ) : null}
          </div>

          {pick && (
            <div className="stats next-move">
              <div className="next-title">Next pick</div>
              <div className="next-pos">
                R{Math.floor(pick.idx / N) + 1}-C{(pick.idx % N) + 1}
                <span className="cell-num"> (cell {pick.idx + 1})</span>
              </div>
              <div className="next-meta">
                {pick.imminent && <span className="imminent-tag">BINGO POSSIBLE</span>}
                <span>Expected picks to BINGO: <b>{pick.expectedCost.toFixed(2)}</b></span>
              </div>
              {pick.lines.length > 0 && (
                <div className="next-lines">
                  Covers: {pick.lines.map(l => `${l.name} (${l.hits}/${N})`).join(', ')}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
