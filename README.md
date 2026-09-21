# Life Tree

Seeded, modular, state-driven life simulation written in JavaScript.

## Current milestone: v0.7 — Türkiye 2026 test world

The simulation supports a complete life arc from birth into advanced age and death.

The core remains UI-independent. During the current balancing phase, new lives use **Türkiye in 2026** as the default test world so school, work, family, housing and city-level economic outcomes can be evaluated in one coherent setting.

## Türkiye 2026 scenario

- Expanded Turkish first-name and surname pools
- Procedural birth city
- City-sensitive wages and job opportunity context
- City-sensitive living and housing costs
- Turkish primary, middle and high-school naming
- Turkish university campuses and cities
- Moving city for university
- Student housing costs after moving away from family
- 2026 TRY economic baseline
- 2026 net minimum-wage baseline stored in country data
- Türkiye city state exposed in CLI, recap and batch reports

Current test cities include İstanbul, Ankara, İzmir, Bursa, Antalya, Adana, Konya, Gaziantep, Mersin, Eskişehir, Samsun, Kayseri, Diyarbakır and Trabzon.

City multipliers are **simulation balancing parameters**, not live property listings or exact market quotes.

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
- University campus/city assignment
- Education-related city moves

### Career and economy
- Procedural job offers
- City-sensitive wages and opportunity
- Labor-market conditions
- Promotions and raises
- Firing and unemployment
- Protection against same-year promotion + firing
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

All money is expressed in **real 2026 TRY**. The background world model changes real living costs, wages, labor-market conditions and healthcare costs without requiring nominal inflation simulation.

### Activities
- School study during school years
- University study while enrolled
- Adult courses / continuing education after school
- Exercise
- Hobbies
- Socializing
- Work focus
- Partner time
- Checkups
- Budget planning

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

## CLI

Play a life:

```bash
npm run play
```

Play toward a specific age:

```bash
npm run play -- --to-age 100
```

Autosave / load:

```bash
npm run play -- --save save.json
npm run play -- --load save.json --save save.json
```

Inspect one deterministic life:

```bash
npm run trace -- --seed test-life --policy random --to-age 100
```

Show routine yearly details too:

```bash
npm run trace -- --seed test-life --policy random --to-age 100 --verbose
```

## Batch simulation

```bash
npm run simulate -- --lives 5000 --to-age 100 --policy random
```

The batch report includes birth-city distribution, current-city distribution and university city-move rate in addition to the existing education, career, retirement, business, relationship, health, estate and world statistics.

## Tests

```bash
npm test
```

GitHub Actions runs the complete test suite, a full-life random batch and one deterministic full-life trace on every push.

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

- Work-related city migration
- Explicit move-city decisions in Life Tree
- Türkiye-specific education and early-adult events
- Deeper partner career and family visibility
- Child/no-child reasoning and fertility-independent preference history
- More middle-age content
- Life Tree branch explorer UI
- Final browser/mobile interface
