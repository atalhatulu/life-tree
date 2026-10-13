import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {settleEstate} from '../src/finance/estate_system.js';

function estateFor(plan, {net=101, childCount=3, spouse=false}={}) {
 const state=new Game('estate-allocation-'+plan+'-'+net+'-'+childCount+'-'+spouse).state;
 state.player.age=70;
 state.finance={cash:net,savings:0,debt:0};
 state.assets={home:null,car:null};
 state.business=null;
 state.children=Array.from({length:childCount},(_,i)=>({id:'child-'+i,name:'Child '+i,age:30,health:{current:80},relationship:70}));
 state.social.romance=spouse?{name:'Spouse',status:'married',alive:true}:null;
 state.estatePlan={type:plan};
 return settleEstate(state);
}

function assertConserved(estate) {
 assert.equal(estate.heirs.reduce((sum,heir)=>sum+heir.amount,0),estate.net,'heirs must receive the entire net estate');
 assert.ok(estate.heirs.every(heir=>Number.isInteger(heir.amount)&&heir.amount>=0));
}

test('children-first without spouse gives all proceeds to children',()=>{
 const estate=estateFor('children-first',{net:101,childCount:3});
 assertConserved(estate);
 assert.equal(estate.heirs.filter(h=>h.type==='child').reduce((sum,h)=>sum+h.amount,0),101);
 assert.deepEqual(estate.heirs.map(h=>h.amount),[34,34,33]);
});

test('each estate plan conserves uneven child shares with and without a spouse',()=>{
 for(const plan of ['balanced','children-first','spouse-first','charity']){
  for(const spouse of [false,true]){
   for(const net of [0,1,2,101,1001]){
    for(const childCount of [0,1,2,3,7]){
     const estate=estateFor(plan,{net,childCount,spouse});
     assertConserved(estate);
    }
   }
  }
 }
});

test('children-first with spouse retains spouse share and allocates all child cents',()=>{
 const estate=estateFor('children-first',{net:101,childCount:2,spouse:true});
 assertConserved(estate);
 assert.equal(estate.heirs.find(h=>h.type==='spouse').amount,15);
 assert.deepEqual(estate.heirs.filter(h=>h.type==='child').map(h=>h.amount),[43,43]);
});

test('settling an estate twice is idempotent',()=>{
 const state=new Game('estate-idempotent').state;
 state.player.age=70;
 state.finance={cash:101,savings:0,debt:0};
 state.children=[{id:'a',name:'A',age:30},{id:'b',name:'B',age:32}];
 state.social.romance=null;
 state.estatePlan={type:'children-first'};
 const first=settleEstate(state);
 assert.strictEqual(settleEstate(state),first);
 assertConserved(first);
});

test('deceased spouse is excluded from inheritance even if marriage status was not cleared',()=>{
 const state=new Game('estate-deceased-spouse').state;
 state.player.age=75;
 state.finance={cash:101,savings:0,debt:0};
 state.assets={home:null,car:null};
 state.business=null;
 state.social.romance={id:'spouse',name:'Late spouse',status:'married',alive:false};
 state.children=[{id:'living',name:'Living child',age:40,alive:true}];
 state.estatePlan={type:'spouse-first'};
 const estate=settleEstate(state);
 assertConserved(estate);
 assert.deepEqual(estate.heirs.map(h=>({type:h.type,name:h.name,amount:h.amount})),[
  {type:'child',name:'Living child',amount:101}
 ]);
});

test('deceased children are excluded from estate distribution and surviving children receive all',()=>{
 for(const plan of ['balanced','children-first','spouse-first','charity']){
  const state=new Game('estate-deceased-child-'+plan).state;
  state.player.age=75;
  state.finance={cash:101,savings:0,debt:0};
  state.assets={home:null,car:null};
  state.business=null;
  state.social.romance=null;
  state.children=[
   {id:'dead',name:'Deceased child',age:40,alive:false},
   {id:'living',name:'Living child',age:38,alive:true}
  ];
  state.estatePlan={type:plan};
  const estate=settleEstate(state);
  assertConserved(estate);
  assert.ok(estate.heirs.every(h=>h.name!=='Deceased child'),plan);
  assert.equal(estate.heirs.filter(h=>h.type==='child').length,1,plan);
 }
});

test('when all children have died, estate is not allocated to them',()=>{
 const state=new Game('estate-no-survivors').state;
 state.player.age=75;
 state.finance={cash:101,savings:0,debt:0};
 state.assets={home:null,car:null};
 state.business=null;
 state.social.romance=null;
 state.children=[{id:'dead',name:'Deceased child',age:40,alive:false}];
 state.estatePlan={type:'children-first'};
 const estate=settleEstate(state);
 assertConserved(estate);
 assert.deepEqual(estate.heirs,[{type:'estate',name:'Tereke',amount:101}]);
});
