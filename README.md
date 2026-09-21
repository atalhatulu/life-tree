# Life Tree

Seeded, modular, state-driven life simulation written in JavaScript.

## Current milestone: v0.6

The simulation now supports a complete life arc from birth into advanced age and death.

The core is UI-independent. The CLI and browser interface consume the same simulation state.

## Main systems

### Family and childhood
- Procedural parents, grandparents and siblings
- Genetics
- Household economic background
- Parent jobs, education and interests
- Childhood development
- Guardianship after parental loss
- Minor inheritance trust funds

### Education
- Primary and middle school
- School quality
- Academic performance
- High-school branches
- University applications
- Program-to-career matching

### Career and economy
- Procedural job offers
- Labor-market conditions
- Promotions and raises
- Firing and unemployment
- Career switching
- Entrepreneurship
- Side businesses and full-time businesses
- Business closure
- Career and entrepreneur retirement
- Personal cash and debt
- Taxes and ownership costs
- Housing, food, clothing and transport standards
- Cars and homes
- Inheritance

All money is expressed in **real 2026 TRY**. The world model changes real living costs, wages, labor-market conditions and healthcare costs without requiring nominal inflation simulation.

### Relationships and generations
- Friends
- Adult relationships
- Cohabitation
- Marriage and divorce
- Partner mortality and widowhood
- Children
- Parenting decisions
- Child education choices
- Adult child careers
- Grandchildren
- Friend and sibling loss

### Health and late life
- Fitness and stress
- Lifestyle effects
- Health conditions
- Treatment decisions
- Age-based mortality
- Retirement lifestyle
- Elder-care needs
- Estate planning
- Death summary
- Structured whole-life recap
- Natural lifespan cap

### Life Tree
Important choices are stored as explicit Life Tree nodes.

Major decisions store compact pre-choice snapshots, so a previous decision can be replayed as an alternate branch without mutating the original life.

### World
A lightweight background world simulation tracks:
- labor market
- real cost of living
- real wages
- healthcare costs
- economic confidence
- occasional recessions and strong economic periods

The world is intentionally lighter than the personal-life simulation.

## CLI

Play a life:

```bash
npm run play
```

Play toward a specific age:

```bash
npm run play -- --to-age 100
```

Autosave:

```bash
npm run play -- --save save.json
```

Load a save:

```bash
npm run play -- --load save.json --save save.json
```

Inspect one deterministic life:

```bash
npm run trace -- --seed test-life --policy random --to-age 100
```

JSON trace:

```bash
npm run trace -- --seed test-life --policy balanced --to-age 100 --json
```

## Batch simulation

```bash
npm run simulate -- --lives 5000 --to-age 100 --policy random
```

Policies:
- `random`
- `balanced`
- `academic`
- `social`
- `vocational`

The batch runner reports state integrity plus education, career, retirement, business, relationships, generations, assets, health, mortality, estates, Life Tree and macro-world statistics.

## Tests

```bash
npm test
```

GitHub Actions runs the complete test suite and a separate full-life batch simulation on every push.

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
├── world/
├── life/
├── timeline/
├── events/
├── simulation/
├── cli/
└── ui/
```

Simulation rules remain separate from presentation.

## Next milestones

- More event/content variety
- Deeper child and sibling lives
- More career specializations
- Relationship conflict history
- Richer illness and recovery paths
- Life Tree branch explorer UI
- Modern 2026 internet/social systems
- Final browser/mobile interface
