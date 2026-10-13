# Life Tree

Seeded, modular, state-driven life simulation written in JavaScript.

## Test profiles

- `npm run test:web`: browserless packaging preflight for the HTML entry, stylesheets, and reachable UI ES modules; CI runs this before the fast suite. This does **not** replace browser E2E tests.

- `npm run test:fast`: deterministic regression suite plus core and NPC activity tests. CI runs this first to surface failures quickly.
- `npm run test:midlife`: deterministic 10-life, age-40 integration gate, covering the first parent-care referral window; CI runs this after the fast checks.
- `npm test`: full Node test suite (including long-running audits). CI runs the same discovered `.test.js` files in four deterministic, disjoint shards using `npm run test:shard -- <1..4> 4`, so each shard can execute on a separate runner; this does not skip any tests.
- `npm run fast-sim -- --lives 1000 --to-age 100 --policy random --seed-prefix main-1000-audit`: separate full-life CI simulation audit.

The web, fast and midlife profiles are preflights, **not** replacements for the full CI suite or browser E2E testing. Parent-care event eligibility is rechecked against the current parent health/age after annual processing; a referral made obsolete by later health changes is not offered as a decision. Transaction graph snapshots use iterative traversal to avoid stack overflow on deeply nested history. Transaction rollback also restores reachable ArrayBuffer backing bytes, including buffers reached only through typed arrays or DataViews, and restores resizable ArrayBuffer lengths before view properties. Detached buffers cannot be reconstructed and cause a reported rollback error. SharedArrayBuffer and external I/O are not covered. They capture own property descriptors without invoking getters and restore non-enumerable/symbol fields, sparse arrays and original property flags on rollback.

### Annual and NPC data integrity

- Annual social processing restores friend records, existing social archive arrays, and health/isolation ledgers when a downstream callback fails. Built-in `RNG` draw state is restored; custom RNGs may opt in through `snapshotState()` and `restoreState(token)`.
- NPC daily activity history validates **all** persisted historical years, including year keys and duplicate/current-year conflicts, before summaries, settlement, or recording. New stress totals are calculated in calendar order and verified via the `stressOrder: "calendar"` marker; legacy unmarked ledgers remain readable and are normalized on the next write.
- Partner annual processing restores its object graph and the RNG checkpoint on failure; custom RNGs require the explicit checkpoint protocol.
- RNG subclasses implementing `snapshotState()` and `restoreState(token)` use their explicit checkpoint protocol even when they extend the built-in `RNG`; partial protocols are rejected.
- Save import rejects malformed present finance/debt, action, child-money, primary-stat, health-risk, world/economy, health-conditions and mental-health containers before legacy schema migration. Missing legacy optional containers still migrate.
- Friend annual processing restores all original living-friend nested object/array references and the built-in RNG state if a later NPC routine, activity, or RNG callback throws. It does not undo external side effects outside those friend records.

## Current milestone: v0.12 — Fast Simulation Full Telemetry

The simulation supports a complete life arc from birth into advanced age and death.

### Career Coherence

- jobs belong to persistent career families
- first graduate jobs prioritize matching degrees
- regulated professions require the matching completed degree path
- deliberate career changes are limited to same or adjacent sectors
- prior job and sector experience persist across years
- reemployment prioritizes previous occupation / career family
- recent voluntary exits block immediate ping-pong return
- unexplained large salary collapses are rejected for satisfied workers
- entrepreneurship and hometown-return exits preserve career memory

### Genetic Inheritance

- every generated person carries a hidden genome state
- children inherit one allele from each parent for monogenic traits
- autosomal recessive carrier / affected states are distinct
- autosomal dominant inheritance is supported
- current inherited conditions include beta thalassemia, Familial Mediterranean Fever and familial hypercholesterolemia
- polygenic hypertension, metabolic and cardiac risk is inherited as a bounded parental blend
- inherited risk modifies adult disease probability rather than guaranteeing disease
- affected monogenic conditions can manifest during childhood or adulthood
- pediatric treatment is family-covered instead of creating personal debt
- player, siblings and later children all use the same inheritance engine

### Life Pacing Governor

Adult life is now centrally paced rather than allowing every eligible system to become a major event immediately.

- discretionary major decisions have a global cooldown
- career, relationship, family, asset and migration decisions have category cooldowns
- critical transitions such as graduation, first job and urgent treatment bypass pacing
- some adult years intentionally contain no decision event
- promotion, firing, close-family/partner loss and new health diagnoses block unrelated major decisions in the same year
- forced consequences can still follow naturally, such as finding a new job after returning home

Türkiye 2026 remains the default balancing world. City is now a persistent life-state rather than cosmetic text.

### Fast simulation audit

A dedicated high-speed audit runner now executes the real deterministic life engine in batch and reports systemic quality metrics.

Run:

`npm run fast-sim -- --lives 100 --to-age 100 --policy random`

It reports:

- invalid-state rate and throughput
- age/death distribution
- education outcomes
- career transition coherence and causal re-employment categories
- marriage/parenthood conversion
- migration frequency and reasons
- health-at-death and condition incidence
- inherited carrier/affected genetic states
- pacing density
- finance/asset aggregates

The 100-life audit is also part of CI so large changes can be checked against systemic regressions before the longer 300-life batch.

### Multigenerational genetics

Genetics now follows the actual family tree instead of generating every adult independently.

- grandparents are founder genomes
- mother inherits from maternal grandparents
- father inherits from paternal grandparents
- player and siblings inherit one allele from each parent
- later children inherit from player + partner
- autosomal recessive carrier / affected states are distinct
- autosomal dominant inheritance is supported
- polygenic cardiovascular/metabolic risk is inherited around the parental midpoint
- inheritance remains deterministic for the same seed

This gives the simulation a continuous genetic lineage:
grandparents → parents → player/siblings → descendants.

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


### Fast Simulation Full Telemetry

`npm run fast-sim -- --lives 100 --to-age 100 --policy random`

Fast Sim runs the real deterministic life simulation in batch mode and now collects full-system telemetry rather than only a few summary KPIs.

Measured domains include:
- population, sex, city, childhood class, siblings and guardianship
- personality, appearance, constitution and adult preferences
- lifespan, death causes, health-at-death and age distributions
- parent/grandparent/sibling/friend losses, inheritance and trust funds
- school path, aptitude, performance, university applications, graduation and degree-career alignment
- career experience, job families, transitions, promotions, firings, unemployment, retirement and pensions
- entrepreneurship, business survival, profit, employees and exit type
- dating, cohabitation, marriage, divorce, widowhood, children and grandchildren
- friendship formation and loss
- migration routes, reasons, ages and costs
- health, diagnoses, treatment outcomes, stress, fitness and checkups
- monogenic carrier/affected state and polygenic risk distributions
- cash, debt, net worth, assets, taxes, household support and estate values
- world-economy shocks and final macro indices
- Life Tree pacing, event frequencies, choices and activities
- five-year longitudinal snapshots across the life course
- cross-system correlations for traits, education, career, family, health and wealth

The report also keeps bounded anomaly samples so aggregate statistics can be traced back to concrete deterministic seeds.

### Annual transaction checkpoints (cycle 93)

The social, friend-life and partner-life annual processors restore their state
on a thrown exception. Built-in `RNG` instances restore their draw counter.
Injected custom RNGs can opt in by providing **both** `snapshotState()` and
`restoreState(token)`. The token must represent all mutable RNG state shared
with forks; `snapshotState()` must be side-effect free and `restoreState()` must
restore the token without throwing. Injected RNGs with neither method retain
legacy behavior (game-state rollback only). An incomplete protocol is rejected
before annual mutations. If restoration itself throws, an `AggregateError`
contains both the original exception and the restoration failure; RNG rollback
must not be assumed. Replayed years do not take new checkpoints.

NPC friend-life annual processing now preflights all unprocessed living friends
before any RNG draw and supplies missing values in partially populated legacy
life ledgers. Partner rollback preserves existing nested life, goal and routine
object/array references as well as the partner object itself.

### Additional annual atomicity (cycle 94)

Adult descendant, child-development and relationship-depth yearly processors now
restore their mutable ledgers and supported RNG checkpoints if a later participant
or random callback fails. Existing nested child, partner and friend object/array
references survive rollback. Descendant grandchild counters are checked for safe
increments, malformed child milestone lists are rejected before any draw, and
friend relationship-history counters cannot overflow. Partially populated legacy
child-development records receive missing defaults. Completed-year replays do not
create checkpoints or consume RNG.

The rollback covers only these processors' known state writes; external effects
and custom RNGs without the optional checkpoint protocol remain outside scope.

### Health, disease and mental-health annual transactions (cycle 95)

`processHealthYear`, `processDiseaseProgressionYear` and
`processMentalHealthYear` now reject malformed active records before random
numbers are consumed. If a later random callback or record write fails, the
processors restore their own health/mental-health ledgers, original nested
object identities, affected death/processed-year fields and a supported RNG
checkpoint. A replayed annual marker remains a no-op. Missing fields in
partial legacy health profiles, mental-health ledgers and disease progression
records receive safe defaults; explicitly corrupt numeric values are rejected
rather than silently producing `NaN`. These are **local** transaction boundaries,
not an application-wide rollback. Custom RNGs without the optional checkpoint
protocol cannot restore their draw position, and external side effects outside
these three processors are not reverted.

### Genetic, elder-family and parent-care integrity (cycle 96)

`processGeneticHealthYear` now preflights inherited loci, diagnosis ledgers,
player age and health reserve before any manifestation roll. A failed later
manifestation restores previously added diagnoses, health reserve, existing
nested object identities, the annual marker and a supported RNG checkpoint.

`processElderFamilyYear` validates the entire living parent/grandparent cohort,
care/household inputs and inheritance list before random draws. If a later
family member, estate credit or guardian transition throws, it restores its
family, household, care, inheritance and guardianship changes and the supported
RNG checkpoint. `setParentCareMode` also validates persisted care/stress/
relationship/sibling inputs before activation and rolls back partial decisions
if a subsequent write throws. Valid legacy missing care/health fields retain
existing defaults. All three boundaries are local: external side effects and
custom RNGs without checkpoint support are not rolled back.

### Game-level atomic mutation boundaries (cycle 97)

`Game.ageOneYear()` now treats the complete age transition as one transaction:
if any subsequent annual subsystem, finale, event selection or RNG fork throws,
the pre-transition state graph (including existing object identities), calendar
and age counters, history, active event and supported RNG checkpoint are
restored. `Game.makeChoice()` likewise covers event resolution, derived stats,
history and Life Tree node commits. Interactive `Game.performActivity()`,
`Game.setLifeGoal()` and `Game.performLifeAction()` now cover their full effects,
including a late history-write failure. Successful operations retain their
previous results and reference semantics. These protections apply to the
**Game methods**; direct low-level system calls retain their own transaction
boundaries. Snapshotting has a memory/runtime cost for large timelines.

The rollback restores enumerable state objects and arrays, game state/event
references and supported RNG checkpoints. External side effects, non-enumerable
custom objects and RNGs without `snapshotState`/`restoreState` are not covered;
failed checkpoint restoration raises an `AggregateError` rather than claiming
successful rollback.

### Transaction checkpoint and save/replay integrity (cycle 99)

Built-in RNG checkpoints now restore both the seed and draw counter when a
transaction fails. Object-graph snapshots queue each shared object only once,
reducing redundant pending references in alias-heavy timelines. Restoration
also preserves an own JSON `"__proto__"` data key without invoking the
prototype setter. These changes do not extend rollback to external I/O,
non-enumerable custom state, or injected RNGs lacking checkpoint support.

The fast regression suite now includes a deterministic save/resume comparison:
two seeded lives are saved at age 25, resumed to age 40, and compared against
uninterrupted runs (full state, RNG, pending event and invariants). The graph
queue change is a memory/worklist hardening, **not** a guaranteed runtime
speedup for all saves.

### Best-effort rollback and optional save repair (cycle 102)

Transaction graph and selected top-level field rollback now attempt **every**
property and object restoration even if an earlier property cannot be undone.
Multiple rollback failures are reported as an `AggregateError`; a single
failure is still raised directly. Field snapshots preserve own property
accessors, flags and symbols without evaluating getters. Rollback is **not**
fully atomic if failed code adds non-configurable fields or changes external
state; the error is deliberately surfaced instead of reporting success.

Legacy saves with certain *optional* malformed containers can be repaired
explicitly (normal `Game.fromSave` remains strict):

```bash
npm run save:repair -- old-save.json --dry-run
npm run save:repair -- old-save.json repaired-save.json
```

Only `world.shockHistory`, `healthProfile.conditions`,
`healthProfile.riskExposure`, `mentalHealth.episodes` and `finance.debts`
are eligible for replacement with empty defaults. **Their malformed previous
contents are discarded**; the original input file is never modified, and
existing output files cannot be overwritten. Repair returns an audit list and
revalidates the complete save; it refuses corrupted family IDs, timelines,
RNG or other unrecognized damage. Make a backup before using the repaired
save. `--dry-run` validates and reports without writing.

### Snapshot profili ve güvenli kayıt onarımı (döngü 103)

- `npm run bench:snapshot -- 300`: aynı tohumda, değişmeyen ve tek alanı değişmiş transaction grafı için yerel snapshot + rollback süresini ölçer. Sonuçlar makineye bağlıdır; CI performans eşiği değildir.
- `npm run save:repair -- broken.json repaired.json`: geçerli hale getirilen kayıt önce geçici bir dosyaya bütünüyle yazılır, sonra mevcut olmayan hedefe atomik hard-link ile yayımlanır. Hedef mevcutsa (sembolik bağlantı dahil) üzerine yazılmaz; geçici dosya temizlenir. Kaynak korunur. Hard-link desteklemeyen dosya sistemlerinde işlem açık hatayla durur.
- `npm run test:shard -- 1 4`: test keşfi alt dizinlerdeki `*.test.js` dosyalarını da kapsar, sembolik bağlantı dizinlerine girmez; dört parçanın birleşimi tüm keşfedilen test dosyalarıdır.

### Yerel koleksiyonların transaction geri alımı (döngü 104)

`snapshotObjectGraph` artık erişilebilir `Map` ve `Set` örneklerinin **iç girdilerini**, `Date` örneklerinin de **zaman damgasını** checkpoint'e dahil eder. Geri alma sırasında koleksiyonların ekleme sırası, özgün anahtar/değer nesne kimlikleri, döngüsel referanslar ve geçersiz `Date` (`NaN`) korunur. Değişmemiş koleksiyonlar gereksiz yere temizlenmez; yerleşik `Map`/`Set`/`Date` metotları kullanılarak alt sınıfların override edilmiş mutatörleri çalıştırılmaz. Bir alanda rollback hatası oluşursa diğer alan ve koleksiyonlar yine de denenir; tamamlanamayan rollback açık hata üretir.

Sınırlar: `WeakMap`/`WeakSet`, `RegExp` son indeks durumu, `ArrayBuffer`/typed-array baytları, DOM nesneleri, harici I/O ve `Proxy` tuzakları için genel geri alma garantisi **yoktur**. Bu mekanizma tam uygulama düzeyinde ACID transaction değildir.
