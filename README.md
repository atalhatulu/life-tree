# Life Tree

Seeded, modular, state-driven life simulation written in JavaScript.

## Current milestone: v0.9 — Life Pacing

The simulation supports a complete life arc from birth into advanced age and death.

### Life Pacing Governor

Adult life is now centrally paced rather than allowing every eligible system to become a major event immediately.

- discretionary major decisions have a global cooldown
- career, relationship, family, asset and migration decisions have category cooldowns
- critical transitions such as graduation, first job and urgent treatment bypass pacing
- some adult years intentionally contain no decision event
- promotion, firing, close-family/partner loss and new health diagnoses block unrelated major decisions in the same year
- forced consequences can still follow naturally, such as finding a new job after returning home

Türkiye 2026 remains the default balancing world. City is now a persistent life-state rather than cosmetic text.

## Türkiye 2026 world

- Procedural birth city
- City-sensitive wages, job availability, living costs and home prices
- Turkish schools and university campuses
- University-related city moves
- Job-related city moves
- Career-switch relocation
- Partner-career relocation
- One major hometown-return decision
- Household moving costs
- Partner moves with a cohabiting/married household
- Old-city salaried work ends when returning home
- Full migration history stored in state and death recap
- Migration reason, age and cost visible in trace
- Persistent hometown-attachment preference

Current test cities:
İstanbul, Ankara, İzmir, Bursa, Antalya, Adana, Konya, Gaziantep, Mersin, Eskişehir, Samsun, Kayseri, Diyarbakır and Trabzon.

City multipliers are simulation balancing parameters, not live listings.

## Migration behavior

A move can currently happen because of:

- university
- first/new job
- career switch
- partner's career
- returning to hometown

Cross-city job choices expose approximate moving cost before the decision.

Moving can:
- consume savings
- create debt
- change housing state
- move spouse/partner with the household
- change city wage/cost context
- enter Life Tree as a major decision

## Current batch balance

The migration layer is stress-tested with full random lives.

Current reference run:
- 300 lives
- 0 invalid states
- average internal migrations: ~2.75
- moved for university: ~29%
- returned to hometown at least once: ~34%

## Other major systems

- Procedural family and genetics
- Childhood and school development
- High-school and university branches
- Career, unemployment and entrepreneurship
- Housing, cars, personal finance, taxes and debt
- Adult relationships, marriage and divorce
- Children, adult children and grandchildren
- Health, treatment and mortality
- Retirement, elder care and inheritance
- Save/load
- Life Tree snapshots and alternate branches
- Whole-life recap and death summary

## CLI

Play:

```bash
npm run play -- --to-age 100
```

Trace one life:

```bash
npm run trace -- --seed test-life --policy random --to-age 100
```

Verbose trace:

```bash
npm run trace -- --seed test-life --policy random --to-age 100 --verbose
```

Batch:

```bash
npm run simulate -- --lives 5000 --to-age 100 --policy random
```

## Tests

```bash
npm test
```

GitHub Actions runs:
- complete test suite
- full-life random batch
- deterministic full-life trace

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
├── data/
│   └── countries/
│       └── turkey/
├── cli/
└── ui/
```

## Next milestones

- Türkiye-specific YKS / preference period
- Student dormitory / family home / shared-flat choices
- Military-service life interruption model
- Public-sector / private-sector / self-employment distinctions
- Richer partner career visibility
- Child/no-child reasoning
- More middle-age content
- Life Tree branch explorer UI
- Final browser/mobile interface
