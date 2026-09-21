import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processPersonalFinanceYear,ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {generateJobOffers} from '../src/career/job_market.js';
import {treatmentOptions} from '../src/health/treatment_system.js';

test('same seed produces same macro economy trajectory',()=>{
 const a=new Game('world-determinism');
 const b=new Game('world-determinism');

 for(let i=0;i<20;i++){
  const ea=a.ageOneYear();
  const eb=b.ageOneYear();
  if(ea)a.makeChoice(ea,a.eventChoices(ea)[0].id);
  if(eb)b.makeChoice(eb,b.eventChoices(eb)[0].id);
 }

 assert.deepEqual(a.state.world,b.state.world);
});

test('cost of living index changes real household expenses',()=>{
 const low=new Game('cost-low');
 const high=new Game('cost-high');
 low.state.player.age=30;
 high.state.player.age=30;
 ensurePersonalFinance(low.state);
 ensurePersonalFinance(high.state);
 low.state.world.economy.costOfLiving=.80;
 high.state.world.economy.costOfLiving=1.20;

 processPersonalFinanceYear(low.state);
 processPersonalFinanceYear(high.state);

 assert.ok(high.state.finance.monthlyExpenses>low.state.finance.monthlyExpenses);
});

test('wage index changes otherwise equivalent job offers',()=>{
 const low=new Game('wage-index');
 const high=new Game('wage-index');
 low.state.player.age=25;
 high.state.player.age=25;
 low.state.world.economy.wageIndex=.85;
 high.state.world.economy.wageIndex=1.15;

 const a=generateJobOffers(low.state,new RNG('same-job-market'));
 const b=generateJobOffers(high.state,new RNG('same-job-market'));

 assert.equal(a[0].id,b[0].id);
 assert.ok(b[0].salary>a[0].salary);
});

test('healthcare index changes treatment cost',()=>{
 const low=new Game('health-cost');
 const high=new Game('health-cost');
 low.state.player.age=60;
 high.state.player.age=60;
 low.state.healthProfile={conditions:[{id:'cardiac',label:'Kalp-damar hastalığı',severity:3}],stress:40,fitness:40};
 high.state.healthProfile=structuredClone(low.state.healthProfile);
 low.state.world.economy.healthcareCost=.90;
 high.state.world.economy.healthcareCost=1.25;

 const lowCost=treatmentOptions(low.state)[0].cost;
 const highCost=treatmentOptions(high.state)[0].cost;
 assert.ok(highCost>lowCost);
});
