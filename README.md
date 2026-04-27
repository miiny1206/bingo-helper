# Bingo Helper 4x4

Vite + React + Bun. Suggests next pick to reach 4x4 bingo with fewest tickets.

## Dev

```bash
bun install
bun dev
```

Open http://localhost:5173

## Build

```bash
bun run build
bun run preview
```

## Deploy to Vercel

Vercel detects `bun.lockb` and uses Bun automatically. `vercel.json` pins it explicitly.

**Option A — Vercel CLI:**
```bash
bun add -g vercel
vercel              # preview
vercel --prod       # production
```

**Option B — Git + dashboard:**
1. Push repo to GitHub.
2. https://vercel.com/new → import repo.
3. Vercel auto-detects Vite + Bun. Build: `bun run build`. Output: `dist`.
4. Deploy.

## Algorithm

- 10 lines (4 rows + 4 cols + 2 diagonals); diagonals can be toggled off.
- Line "alive" = 0 misses.
- Score for unknown cell = Σ `2^(hits)` across alive lines passing through it.
- Tiebreak: more alive lines through cell, then closer to completing best line.
- Top 4 ranked suggestions shown; user picks based on risk preference.
