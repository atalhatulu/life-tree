import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {Game} from '../src/core/game.js';
import {
 inheritGenome,processGeneticHealthYear,geneticRiskMultiplier
} from '../src/health/genetic_system.js';

function parentWith(targetId,alleles,poly=50){
 return {
  health:{
   genetics:{
    monogenic:{
     beta_thalassemia:{alleles:['N','N'],status:'clear'},
     fmf:{alleles:['N','N'],status:'clear'},
     familial_hypercholesterolemia:{alleles:['N','N'],status:'clear'},
     [targetId]:{alleles,status:'test'}
    },
    polygenic:{hypertension:poly,metabolic:poly,cardiac:poly}
   }
  }
 };
}

test('two recessive carriers can produce clear carrier and affected children',()=>{
 const mother=parentWith('beta_thalassemia',['N','V']);
 const father=parentWith('beta_thalassemia',['N','V']);
 const counts={clear:0,carrier:0,affected:0};
 for(let i=0;i<500;i++){
  const child=inheritGenome(new RNG('recessive-'+i),mother,father);
  counts[child.monogenic.beta_thalassemia.status]++;
 }
 assert.ok(counts.clear>70);
 assert.ok(counts.carrier>150);
 assert.ok(counts.affected>70);
});

test('dominant heterozygous parent passes affected status to roughly half of children',()=>{
 const mother=parentWith('familial_hypercholesterolemia',['N','V']);
 const father=parentWith('familial_hypercholesterolemia',['N','N']);
 let affected=0;
 for(let i=0;i<500;i++){
  const child=inheritGenome(new RNG('dominant-'+i),mother,father);
  if(child.monogenic.familial_hypercholesterolemia.status==='affected')affected++;
 }
 assert.ok(affected>180&&affected<320,'affected='+affected);
});

test('generated player alleles come one from each parent',()=>{
 const game=new Game('family-genetic-proof');
 for(const id of ['beta_thalassemia','fmf','familial_hypercholesterolemia']){
  const child=game.state.player.health.genetics.monogenic[id].alleles;
  const mother=game.state.parents.mother.health.genetics.monogenic[id].alleles;
  const father=game.state.parents.father.health.genetics.monogenic[id].alleles;
  assert.ok(mother.includes(child[0]),id+' maternal allele mismatch');
  assert.ok(father.includes(child[1]),id+' paternal allele mismatch');
 }
});

test('siblings inherit different recombinations from the same parental genomes',()=>{
 let foundDifferent=false;
 for(let i=0;i<100&&!foundDifferent;i++){
  const game=new Game('sibling-genetics-'+i);
  if(!game.state.siblings.length)continue;
  const a=game.state.player.health.genetics;
  const b=game.state.siblings[0].health.genetics;
  foundDifferent=JSON.stringify(a)!==JSON.stringify(b);
 }
 assert.equal(foundDifferent,true);
});

test('polygenic child risk stays near parental average with bounded variation',()=>{
 const mother=parentWith('fmf',['N','N'],80);
 const father=parentWith('fmf',['N','N'],40);
 for(let i=0;i<100;i++){
  const child=inheritGenome(new RNG('poly-'+i),mother,father);
  assert.ok(child.polygenic.hypertension>=50&&child.polygenic.hypertension<=70);
 }
});

test('higher inherited polygenic score increases but does not guarantee adult disease risk',()=>{
 const low=new Game('risk-low');
 const high=new Game('risk-high');
 low.state.player.health.genetics.polygenic.hypertension=10;
 high.state.player.health.genetics.polygenic.hypertension=90;
 assert.ok(
  geneticRiskMultiplier(high.state,'hypertension')>
  geneticRiskMultiplier(low.state,'hypertension')
 );
 assert.ok(geneticRiskMultiplier(high.state,'hypertension')<3);
});

test('affected monogenic genotype can manifest as a real health condition',()=>{
 const game=new Game('manifest-genetic');
 game.state.player.age=1;
 game.state.player.health.genetics.monogenic.beta_thalassemia={
  alleles:['V','V'],status:'affected'
 };
 game.state.healthProfile={conditions:[],stress:20,fitness:50,lastCheckupAge:null};

 let manifested=false;
 for(let i=0;i<8&&!manifested;i++){
  const entries=processGeneticHealthYear(game.state,new RNG('manifest-'+i));
  manifested=entries.some(e=>e.text.includes('Beta talasemi'));
 }
 assert.equal(manifested,true);
 assert.ok(game.state.healthProfile.conditions.some(c=>c.id==='beta_thalassemia'&&c.genetic));
});

test('full-life simulations remain deterministic with inherited genetics',()=>{
 const a=new Game('genetic-determinism');
 const b=new Game('genetic-determinism');
 assert.deepEqual(a.state.player.health.genetics,b.state.player.health.genetics);
 assert.deepEqual(a.state.parents.mother.health.genetics,b.state.parents.mother.health.genetics);
});
