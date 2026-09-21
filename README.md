# Life Tree

Modular, seeded life simulation in JavaScript.

## v0.4

Current simulation covers birth through mature adulthood and is tested with large automated life batches.

### Systems
- Procedural family, siblings and genetics
- Childhood development, school and hobbies
- Friends and relationships
- High-school, university and work paths
- Procedural job market, promotions, job changes and unemployment
- Personal cash, debt and annual expenses
- Housing, food, clothing and transport standards
- Cars and homes
- Adult dating, cohabitation and marriage
- Procedural children with inherited traits
- Stress, fitness and health conditions
- Major decisions recorded in Life Tree
- Interactive terminal play
- Batch simulation with invariant checks

## Play

```bash
npm run play -- --to-age 50
```

## Stress test

```bash
npm run simulate -- --lives 5000 --to-age 50 --policy random
```

Policies: `random`, `balanced`, `academic`, `social`, `vocational`.

## Tests

```bash
npm test
```

GitHub Actions runs the full test suite plus a separate age-50 batch simulation on every push.

## Architecture

```text
src/
├── core/
├── character/
├── family/
├── education/
├── career/
├── finance/
├── lifestyle/
├── assets/
├── health/
├── social/
├── life/
├── events/
├── simulation/
├── cli/
└── ui/
```

Simulation rules are independent from presentation. The CLI and browser UI consume the same game state.
