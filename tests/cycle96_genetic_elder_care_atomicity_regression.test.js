import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processGeneticHealthYear} from '../src/health/genetic_system.js';
import {processElderFamilyYear,evaluateParentCareNeed,setParentCareMode} from '../src/family/elder_system.js';

function state(seed){
 const s=new Game('cycle96-'+seed).state;
 s.year=2078;s.player.age=45;s.player.alive=true;
 return s;
}
function rng({failAt=Infinity,manifest=true,death=null}={}){
 return {position:0,label:null,
  snapshotState(){return this.position;},restoreState(token){this.position=token;},
  fork(label){this.label=label;return this;},
  draw(){this.position++;if(this.position===failAt)throw Error('injected RNG failure');},
  chance(){this.draw();return this.label?.startsWith('manifest-')?manifest:this.label==='death-'+death;},
  int(){this.draw();return this.label?.startsWith('inheritance-')?10:0;}
 };
}
function unchangedOnFailure(run,s,r,pattern=/injected RNG failure/){
 const before=structuredClone(s);
 assert.throws(()=>run(s,r),pattern);
 assert.deepEqual(s,before);
 assert.equal(r.position,0);
}
function affected(s){
 s.player.health.genetics={monogenic:{
  beta_thalassemia:{status:'affected',alleles:['V','V']},
  fmf:{status:'affected',alleles:['V','V']}
 },polygenic:{}};
 s.player.health.current=85;
 s.healthProfile={conditions:[],stress:30,fitness:50};
}

test('genetic manifestation rolls back earlier diagnosis, health and RNG after later failure',()=>{
 const s=state('genetic-late');affected(s);
 const refs=[s.player.health,s.healthProfile,s.healthProfile.conditions,s.player.health.genetics];
 unchangedOnFailure(processGeneticHealthYear,s,rng({failAt:2}));
 assert.strictEqual(s.player.health,refs[0]);assert.strictEqual(s.healthProfile,refs[1]);
 assert.strictEqual(s.healthProfile.conditions,refs[2]);assert.strictEqual(s.player.health.genetics,refs[3]);
});
test('genetic manifestation restores absent health profile on first draw failure',()=>{
 const s=state('genetic-missing');affected(s);delete s.healthProfile;
 unchangedOnFailure(processGeneticHealthYear,s,rng({failAt:1}));
 assert.equal(Object.hasOwn(s,'healthProfile'),false);
});
test('genetic manifestation rejects invalid late condition, reserve, and locus before RNG',()=>{
 const mutations=[
  s=>s.healthProfile.conditions.push(null),
  s=>s.healthProfile.conditions='invalid',
  s=>s.player.health.current=NaN,
  s=>s.player.health.genetics.monogenic.fmf={status:'affected',alleles:'bad'},
  s=>s.player.health.genetics.monogenic.beta_thalassemia={status:'wrong'},
  s=>s.player.age=NaN
 ];
 for(const mutate of mutations){
  const s=state('genetic-preflight');affected(s);mutate(s);
  const before=structuredClone(s),r=rng();
  assert.throws(()=>processGeneticHealthYear(s,r),/genetic|condition|health|age|locus/i);
  assert.deepEqual(s,before);assert.equal(r.position,0);
 }
});
test('genetic manifestation commits, and same-year replay skips RNG checkpoint',()=>{
 const s=state('genetic-success');affected(s);const r=rng();
 assert.equal(processGeneticHealthYear(s,r).length,2);
 assert.equal(s.healthProfile.conditions.length,2);
 const after=structuredClone(s),pos=r.position;
 r.snapshotState=()=>{throw Error('replay must not snapshot');};
 assert.deepEqual(processGeneticHealthYear(s,r),[]);
 assert.deepEqual(s,after);assert.equal(r.position,pos);
});
test('genetic manifestation rejects incomplete custom checkpoint without mutation',()=>{
 const s=state('genetic-half');affected(s);const before=structuredClone(s);
 assert.throws(()=>processGeneticHealthYear(s,{snapshotState(){return 0;},fork(){throw Error('draw');}}),/checkpoint/i);
 assert.deepEqual(s,before);
});
test('genetic manifestation retains original failure when RNG restore fails',()=>{
 const s=state('genetic-aggregate');affected(s);const before=structuredClone(s),r=rng({failAt:2});
 r.restoreState=()=>{throw Error('restore error');};
 assert.throws(()=>processGeneticHealthYear(s,r),e=>{
  assert.ok(e instanceof AggregateError);assert.match(e.errors[0].message,/injected RNG failure/);
  assert.match(e.errors[1].message,/restore error/);return true;
 });
 assert.deepEqual(s,before);
});

test('elder year rolls back parent death, estate, household, and RNG on later failure',()=>{
 const s=state('elder-late');s.parents.mother.monthlyIncome=1000;
 s.pendingInheritance=[];s.parentCare={active:false,pendingParentId:null,pendingParentName:null};
 const refs=[s.parents.mother,s.household,s.pendingInheritance,s.parentCare,s.parents];
 unchangedOnFailure(processElderFamilyYear,s,rng({death:'mother',failAt:4}));
 assert.strictEqual(s.parents.mother,refs[0]);assert.strictEqual(s.household,refs[1]);
 assert.strictEqual(s.pendingInheritance,refs[2]);assert.strictEqual(s.parentCare,refs[3]);
 assert.strictEqual(s.parents,refs[4]);
});
test('elder year rolls back minor trust fund after parent death and later failure',()=>{
 const s=state('elder-minor');s.player.age=12;s.parents.mother.monthlyIncome=2000;
 const fund=s.trustFund;
 unchangedOnFailure(processElderFamilyYear,s,rng({death:'mother',failAt:4}));
 assert.strictEqual(s.trustFund,fund);
});
test('elder year rejects corrupt late grandparent and income before any RNG',()=>{
 const mutations=[
  s=>s.grandparents.paternal.grandfather.health.current=Infinity,
  s=>s.grandparents.paternal.grandmother.age=NaN,
  s=>s.parents.father.monthlyIncome=-1,
  s=>s.household.monthlyIncome=NaN,
  s=>s.siblings='broken',
  s=>s.healthProfile={stress:NaN},
  s=>s.parentCare={active:true,monthlyCost:Infinity}
 ];
 for(const mutate of mutations){
  const s=state('elder-preflight');mutate(s);const before=structuredClone(s),r=rng();
  assert.throws(()=>processElderFamilyYear(s,r),/elder|family|income|health|care|household|siblings|age|stress/i);
  assert.deepEqual(s,before);assert.equal(r.position,0);
 }
});
test('elder year restores missing care ledger and pending inheritance after failure',()=>{
 const s=state('elder-absent');delete s.parentCare;delete s.pendingInheritance;
 unchangedOnFailure(processElderFamilyYear,s,rng({death:'mother',failAt:4}));
 assert.equal(Object.hasOwn(s,'parentCare'),false);
 assert.equal(Object.hasOwn(s,'pendingInheritance'),false);
});
test('elder year commits death and care once and skips RNG on replay',()=>{
 const s=state('elder-commit');s.parents.mother.monthlyIncome=1000;
 const r=rng({death:'mother'});processElderFamilyYear(s,r);
 assert.equal(s.parents.mother.alive,false);
 assert.equal(s.pendingInheritance.length,1);
 const before=structuredClone(s),pos=r.position;
 r.snapshotState=()=>{throw Error('replay checkpoint');};
 assert.deepEqual(processElderFamilyYear(s,r),[]);
 assert.deepEqual(s,before);assert.equal(r.position,pos);
});
test('elder year rejects incomplete RNG checkpoint without creating care ledger',()=>{
 const s=state('elder-half');delete s.parentCare;const before=structuredClone(s);
 assert.throws(()=>processElderFamilyYear(s,{snapshotState(){return 0;},fork(){throw Error('draw');}}),/checkpoint/i);
 assert.deepEqual(s,before);
});

function careState(seed){
 const s=state(seed);s.healthProfile={conditions:[],stress:30,fitness:50};
 s.parents.mother.age=80;s.parents.mother.health.current=35;
 s.parents.father.age=60;s.parents.father.health.current=80;
 evaluateParentCareNeed(s);
 return s;
}
test('care decision rejects malformed stress and relationship scores without partial activation',()=>{
 for(const mutate of [
  s=>s.healthProfile.stress=NaN,
  s=>s.player.relationships.mother=Infinity,
  s=>s.player.relationships='broken',
  s=>s.siblings='broken'
 ]){
  const s=careState('care-preflight');mutate(s);const before=structuredClone(s);
  assert.throws(()=>setParentCareMode(s,'family'),/care|stress|relationship|siblings|health/i);
  assert.deepEqual(s,before);
 }
});
test('care decision preserves legacy missing relationships and health profile',()=>{
 const s=careState('care-legacy');delete s.player.relationships;delete s.healthProfile;
 const care=setParentCareMode(s,'family');
 assert.equal(care.active,true);assert.equal(s.player.relationships.mother,67);
});
test('care decision rejects overflowing age and corrupt existing care ledger',()=>{
 for(const mutate of [
  s=>s.player.age=NaN,
  s=>s.parentCare.monthlyCost=Infinity,
  s=>s.siblings.push(null)
 ]){
  const s=careState('care-invalid');mutate(s);const before=structuredClone(s);
  assert.throws(()=>setParentCareMode(s,'family'),/age|care|siblings/i);
  assert.deepEqual(s,before);
 }
});

test('elder year rolls back mortality and RNG when a released trust fund rejects inheritance',()=>{
 const s=state('elder-released-fund');s.player.age=12;
 s.parents.mother.monthlyIncome=1500;
 s.trustFund={balance:5000,sources:[],released:true};
 const before=structuredClone(s),r=rng({death:'mother'});
 assert.throws(()=>processElderFamilyYear(s,r),/Released trust fund/);
 assert.deepEqual(s,before);assert.equal(r.position,0);
});
test('care decision rolls back parent and care state after a late relationship write fails',()=>{
 const s=careState('care-late');const care=s.parentCare,parent=s.parents.mother;
 const target=s.player.relationships;let attempts=0;
 const relationships=new Proxy(target,{set(obj,key,value){
  if(key==='mother'&&attempts++===0)throw Error('late relationship update failed');
  return Reflect.set(obj,key,value);
 }});
 s.player.relationships=relationships;
 const before=JSON.stringify(s);
 assert.throws(()=>setParentCareMode(s,'family'),/late relationship update failed/);
 assert.equal(JSON.stringify(s),before);
 assert.strictEqual(s.parentCare,care);assert.strictEqual(s.parents.mother,parent);
 assert.strictEqual(s.player.relationships,relationships);
});
