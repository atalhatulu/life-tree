import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {geneticDiseaseModifiers} from '../src/health/genetic_system.js';
import {processDiseaseProgressionYear,ensureConditionProgression} from '../src/health/disease_progression.js';

function base(score){
 const g=new Game('genetic-course-'+score);
 g.state.player.age=50;
 g.state.player.health.current=70;
 g.state.player.health.constitution=60;
 g.state.healthProfile={conditions:[],stress:40,fitness:60,lastCheckupAge:null};
 g.state.player.health.genetics.polygenic.cardiac=score;
 return g;
}

test('high cardiac genetic risk shifts onset earlier and progression faster',()=>{
 const low=base(20),high=base(80);
 const a=geneticDiseaseModifiers(low.state,'cardiac');
 const b=geneticDiseaseModifiers(high.state,'cardiac');
 assert.ok(b.onsetAgeOffset<a.onsetAgeOffset);
 assert.ok(b.progressionMultiplier>a.progressionMultiplier);
 assert.ok(b.complicationMultiplier>a.complicationMultiplier);
 assert.ok(b.initialProgressionBonus>=a.initialProgressionBonus);
});

test('familial hypercholesterolemia further intensifies cardiac course',()=>{
 const g=base(50);
 g.state.player.health.genetics.monogenic.familial_hypercholesterolemia={alleles:['V','N'],status:'affected'};
 const mod=geneticDiseaseModifiers(g.state,'cardiac');
 assert.ok(mod.onsetAgeOffset<=-5);
 assert.ok(mod.progressionMultiplier>1);
 assert.ok(mod.complicationMultiplier>1);
 assert.ok(mod.initialProgressionBonus>=8);
});

test('same disease advances faster under high genetic risk',()=>{
 const low=base(20),high=base(80);
 for(const g of [low,high]){
  g.state.healthProfile.conditions=[{id:'cardiac',label:'Kalp-damar hastalığı',severity:3,diagnosedAtAge:50}];
 }
 const rng={int:()=>0,chance:()=>false};
 processDiseaseProgressionYear(low.state,rng);
 processDiseaseProgressionYear(high.state,rng);
 const lp=ensureConditionProgression(low.state.healthProfile.conditions[0]);
 const hp=ensureConditionProgression(high.state.healthProfile.conditions[0]);
 assert.ok(hp.score>lp.score);
});
