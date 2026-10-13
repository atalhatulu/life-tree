import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';
import {settleEstate} from '../src/finance/estate_system.js';

function adult(seed){
 const state=new Game(seed).state;
 state.player.age=40;
 ensurePersonalFinance(state);
 state.finance.cash=100_000;
 state.finance.savings=0;
 state.finance.debt=0;
 state.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 state.career={employed:false,monthlyIncome:0};
 return state;
}
const noShock={fork:()=>({chance:()=>false})};

test('deceased cohabiting or married partners contribute no income to annual finances',()=>{
 for(const status of ['cohabiting','married']){
  const state=adult('deceased-partner-finance-'+status);
  state.social.romance={name:'Late partner',status,alive:false,monthlyIncome:100_000};
  processPersonalFinanceYear(state);
  assert.equal(state.finance.partnerContributionMonthly,0,status);
 }
});

test('living partner and legacy partner without alive field retain normal contributions',()=>{
 for(const alive of [true,undefined]){
  const state=adult('living-partner-finance-'+alive);
  state.social.romance={name:'Partner',status:'married',monthlyIncome:100_000};
  if(alive!==undefined)state.social.romance.alive=alive;
  processPersonalFinanceYear(state);
  assert.equal(state.finance.partnerContributionMonthly,55_000);
 }
});

test('deceased dependent children do not increase family support burden',()=>{
 const state=adult('deceased-dependent-burden');
 state.children=[{age:12,alive:false},{age:15,alive:true},{age:19,alive:false},{age:24,alive:true}];
 processHouseholdDepthYear(state,noShock);
 assert.equal(state.householdDynamics.familySupportBurden,12);
});

test('household emergency reserves cannot be negative when old cash is overdrawn',()=>{
 const state=adult('negative-reserve-months');
 state.finance.cash=-50_000;
 state.finance.savings=0;
 state.finance.monthlyExpenses=10_000;
 state.finance.ownershipCostsMonthly=0;
 processHouseholdDepthYear(state,noShock);
 assert.equal(state.householdDynamics.emergencyReserveMonths,0);
});

test('negative cash is an estate liability, not a negative gross asset',()=>{
 const state=adult('negative-cash-estate');
 state.finance.cash=-25_000;
 state.finance.savings=80_000;
 state.finance.debt=10_000;
 state.assets={home:null,car:null};
 state.business=null;
 state.social.romance=null;
 state.children=[];
 const estate=settleEstate(state);
 assert.equal(estate.gross,80_000);
 assert.equal(estate.debt,35_000);
 assert.equal(estate.net,45_000);
 assert.equal(estate.heirs.reduce((sum,h)=>sum+h.amount,0),estate.net);
});

test('negative cash without positive assets leaves zero distributable estate',()=>{
 const state=adult('insolvent-estate');
 state.finance.cash=-20_000;
 state.finance.savings=0;
 state.finance.debt=7_000;
 state.assets={home:null,car:null};
 state.business=null;
 const estate=settleEstate(state);
 assert.equal(estate.gross,0);
 assert.equal(estate.debt,27_000);
 assert.equal(estate.net,0);
});
