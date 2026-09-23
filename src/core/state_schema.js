export const STATE_SCHEMA_VERSION=2;

function object(value,fallback={}){return value&&typeof value==='object'?value:fallback;}

export function ensureStateSchema(state){
 if(!state||typeof state!=='object')throw new Error('State must be an object.');
 state.schemaVersion=STATE_SCHEMA_VERSION;
 state.history??=[];
 state.flags=object(state.flags);
 state.flags.completedEvents??=[];
 state.lifeTree=object(state.lifeTree);
 state.lifeTree.nodes??=[];
 state.lifeTree.branches??=[];
 state.lifeTree.nextBranchId??=1;
 state.social=object(state.social);
 state.social.friends??=[];
 state.social.romance??=null;
 state.social.exPartners??=[];
 state.social.exSpouses??=[];
 state.social.deceasedPartners??=[];
 state.actions=object(state.actions,{remaining:0,max:3});
 state.actions.max??=3;
 state.actions.remaining??=0;
 state.children??=[];
 state.childMoney??={wallet:0,saved:0,totalAllowance:0,totalSpent:0,lastAllowanceAge:null};
 state.childMoney.wallet??=0;
 state.childMoney.saved??=0;
 state.childMoney.totalAllowance??=0;
 state.childMoney.totalSpent??=0;
 state.childMoney.lastAllowanceAge??=null;
 state.migrationHistory??=[];
 state.pendingInheritance??=[];
 state.activityMemory??={};
 state.middleAge??=null;
 state.militaryService??=null;
 state.parentCare??=null;
 state.unemployment??=null;
 state.retraining??=null;
 state.householdDynamics??={financialPressure:0,maintenanceBurden:0,familySupportBurden:0,emergencyReserveMonths:0,stability:65,recentShock:null};
 state.lifeMemory??={memories:[],tags:{},resilience:50,scarLoad:0,lastRecordedAge:null};
 state.storyletCooldowns??={};
 if(state.finance){
  state.finance.debts??={consumer:0,medical:0,housing:0,car:0,emergency:0};
  for(const key of ['consumer','medical','housing','car','emergency'])state.finance.debts[key]??=0;
 }
 if(state.healthProfile)state.healthProfile.riskExposure??={};
 return state;
}
