import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processDiseaseProgressionYear,ensureConditionProgression} from '../src/health/disease_progression.js';
import {treatCondition} from '../src/health/treatment_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

function stateWithCondition({severity=2,health=70,fitness=60,stress=40}={}){
 const g=new Game('disease-progression-test');
 g.state.player.age=50;
 g.state.player.health.current=health;
 g.state.player.health.constitution=60;
 g.state.healthProfile={
  conditions:[{id:'metabolic',label:'Metabolik sorun',severity,diagnosedAtAge:45}],
  stress,fitness,lastCheckupAge:null
 };
 return g;
}

test('untreated disease progresses across stages over time',()=>{
 const g=stateWithCondition({severity:3,health:55,fitness:45,stress:65});
 const rng={int:()=>4,chance:()=>false};
 const condition=g.state.healthProfile.conditions[0];
 const start=ensureConditionProgression(condition).score;
 for(let i=0;i<4;i++)processDiseaseProgressionYear(g.state,rng);
 assert.ok(condition.progression.score>start);
 assert.ok(['severe','critical'].includes(condition.progression.stage));
 assert.equal(condition.progression.status,'active');
});

test('successful treatment moves progression toward stability or remission',()=>{
 const g=stateWithCondition({severity:2,health:85,fitness:80,stress:25});
 ensurePersonalFinance(g.state);
 g.state.finance.cash=200000;
 const condition=g.state.healthProfile.conditions[0];
 ensureConditionProgression(condition).score=30;
 const rng={next:()=>0.1,chance:()=>true};
 treatCondition(g.state,'metabolic',rng);
 assert.equal(condition.treatmentSuccessful,true);
 assert.ok(condition.progression.score<30);
 assert.ok(['stable','remission'].includes(condition.progression.status));
});

test('critical disease complication damages physical reserves',()=>{
 const g=stateWithCondition({severity:3,health:60,fitness:55,stress:60});
 const condition=g.state.healthProfile.conditions[0];
 const p=ensureConditionProgression(condition);
 p.score=90;
 p.stage='critical';
 const beforeHealth=g.state.player.health.current;
 const beforeFitness=g.state.healthProfile.fitness;
 const rng={int:()=>4,chance:()=>true};
 const entries=processDiseaseProgressionYear(g.state,rng);
 assert.ok(condition.progression.complicationCount>=1);
 assert.ok(g.state.player.health.current<beforeHealth);
 assert.ok(g.state.healthProfile.fitness<beforeFitness);
 assert.ok(entries.some(e=>e.text.includes('komplikasyon')));
});
