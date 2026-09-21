# Life Tree

Modular, deterministic life simulation in JavaScript.

## v0.5

Life Tree simulates one person from birth through old age and death. The simulation core is independent from the web UI and is primarily tested through the CLI and large seeded batch runs.

### Current systems

- Procedural parents, grandparents, siblings and later-born siblings
- Genetics, health constitution, personality and interests
- Childhood household class, parental support and family loss
- Minor guardianship and inherited trust funds
- Primary school, middle school and high-school paths
- Friends, hobbies, relationships and yearly activities
- University, work and gap-year branches
- Procedural university applications and job offers
- Career performance, raises, promotions, job switching and unemployment
- Lifestyle, housing, food, clothing, transport, tax and debt
- Cars and home ownership
- Adult dating, cohabitation, marriage, divorce and widowhood
- Children with inherited traits
- Parenting styles and child education decisions
- Adult children, careers and grandchildren
- Chronic and serious health conditions
- Treatment choices and treatment cost
- Stress, fitness, mobility and social isolation
- Entrepreneurship and business failure risk
- Retirement and pension income
- Elder-care modes
- Parent and grandparent mortality
- Inheritance and estate planning
- Death causes, estate settlement and final life summary
- Life Tree nodes for major life-changing decisions

## Play in terminal

```bash
npm run play -- --to-age 80
```

## Batch simulation

```bash
npm run simulate -- --lives 5000 --to-age 80 --policy random
```

Policies:

- `random`
- `balanced`
- `academic`
- `social`
- `vocational`

The batch runner reports state validity, education, career, retirement, relationships, children, grandchildren, assets, health, mortality, inheritance, elder care, estate planning and Life Tree statistics.

## Tests

```bash
npm test
```

GitHub Actions runs the complete test suite and an additional age-80 batch simulation on each push.

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

Simulation rules stay outside the presentation layers. The CLI and browser UI consume the same game state.
