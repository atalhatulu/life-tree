const VALID_ESTATE_PLANS=new Set(['balanced','children-first','spouse-first','charity']);

export function setEstatePlan(state,plan){
 // Unknown plans otherwise appear in the summary but silently distribute
 // assets as balanced. A settled estate is a finalized ledger.
 if(!VALID_ESTATE_PLANS.has(plan))throw new Error('Geçersiz miras planı.');
 if(state.estate)throw new Error('Kapanmış terekenin miras planı değiştirilemez.');
 if(state.estatePlan?.type===plan)return state.estatePlan;
 state.estatePlan={type:plan,setAtAge:state.player.age};
 return state.estatePlan;
}
