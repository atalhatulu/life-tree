import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processHealthYear} from '../src/health/health_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {affordableCarOptions,affordableHomeOptions,buyCar,buyHome} from '../src/assets/asset_system.js';
import {chooseProceduralEventChoice} from '../src/simulation/procedural_decision_agent.js';

function adult(seed='agency-v2'){
 const g=new Game(seed);
 g.state.player.age=35;
 g.state.player.health.current=80;
 g.state.player.health.constitution=60;
 g.state.healthProfile={conditions:[],stress:30,fitness:70,lastCheckupAge:null,lastExerciseAge:null};
 ensurePersonalFinance(g.state);
 return g;
}

test('recent exercise causally slows annual health wear without directly healing',()=>{
 const active=adult('health-protection-active');
 const inactive=adult('health-protection-inactive');
 active.state.player.age=70;
 inactive.state.player.age=70;
 active.state.healthProfile.lastExerciseAge=69;
 inactive.state.healthProfile.lastExerciseAge=50;
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processHealthYear(active.state,rng);
 processHealthYear(inactive.state,rng);
 assert.ok(active.state.player.health.current>inactive.state.player.health.current);
 assert.ok(active.state.player.health.current<80);
});

test('long-term savings count toward car affordability and down payment',()=>{
 const g=adult('liquid-car');
 g.state.finance.cash=0;
 g.state.finance.savings=2000000;
 g.state.finance.debt=0;
 const options=affordableCarOptions(g.state);
 assert.ok(options.length>0);
 const before=g.state.finance.savings;
 buyCar(g.state,options[0].id);
 assert.ok(g.state.assets.car);
 assert.ok(g.state.finance.savings<before);
 assert.equal(g.state.finance.cash,0);
});

test('long-term savings count toward home affordability',()=>{
 const g=adult('liquid-home');
 g.state.player.age=40;
 g.state.career={employed:true,monthlyIncome:150000};
 g.state.finance.cash=0;
 g.state.finance.savings=10000000;
 g.state.finance.debt=0;
 const options=affordableHomeOptions(g.state);
 assert.ok(options.length>0);
 const before=g.state.finance.savings;
 buyHome(g.state,options[0].id);
 assert.ok(g.state.assets.home);
 assert.ok(g.state.finance.savings<before);
});

function maxWeightRng(){
 return {weighted:items=>[...items].sort((a,b)=>b.weight-a.weight)[0].value};
}

test('procedural child decision follows desire, relationship and financial security',()=>{
 const high=adult('decision-child-high');
 high.state.preferences={parenthoodDesire:90};
 high.state.social.romance={relationship:85};
 high.state.finance.cash=1500000;
 high.state.finance.monthlyIncome=70000;
 const event={id:'child-decision'};
 const choices=[{id:'have-child'},{id:'wait-child'}];
 const mock={state:high.state,eventChoices:()=>choices};
 assert.equal(chooseProceduralEventChoice(mock,event,'random',maxWeightRng()).id,'have-child');

 const low=adult('decision-child-low');
 low.state.preferences={parenthoodDesire:10};
 low.state.social.romance={relationship:62};
 low.state.finance.cash=10000;
 low.state.finance.monthlyIncome=18000;
 const lowMock={state:low.state,eventChoices:()=>choices};
 assert.equal(chooseProceduralEventChoice(lowMock,event,'random',maxWeightRng()).id,'wait-child');
});
