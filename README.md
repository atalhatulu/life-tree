# Life Tree

Procedural life simulation prototype built with modular JavaScript.

## Current milestone: v0.3

The simulation currently covers birth through early adulthood (tested to age 30):

- Seeded deterministic RNG
- Procedural parents, grandparents, siblings and later-born siblings
- Parent-derived genetics, interests, education support and household class
- Childhood development and primary/middle school progression
- Yearly action economy: study, exercise, socialize, hobby
- Procedural friends and early romance
- Major Life Tree decisions
  - High-school path
  - Post-high-school direction
  - University applications
  - Gap-year direction
  - First job
- Dynamic event choices generated from current state
- Procedural university program applications
- Procedural job offers
- Degree-to-career matching
- Career performance and raises
- Personal cash/debt state and student family support
- CLI play mode
- Batch simulation and invariant checks

## Run tests

```bash
npm test
```

## Play in terminal

```bash
npm run play
```

Default CLI milestone is age 30. To change it:

```bash
npm run play -- --to-age 25
```

## Run batch simulation

```bash
npm run simulate -- --lives 3000 --to-age 30 --policy random
```

Policies:

- `random`
- `balanced`
- `academic`
- `social`
- `vocational`

## Architecture

The game engine is independent from the UI.

```text
src/
├── core/
├── character/
├── family/
├── education/
├── career/
├── finance/
├── social/
├── life/
├── events/
├── simulation/
├── cli/
└── ui/
```

The web UI is intentionally secondary while the simulation model is being stabilized.
