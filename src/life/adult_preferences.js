const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureAdultPreferences(state,rng){
 if(state.preferences)return state.preferences;
 const p=state.player.personality;
 state.preferences={
  partnershipDesire:clamp(Math.round(28+p.sociability*.42+p.patience*.12+rng.int(-20,20))),
  marriageDesire:clamp(Math.round(22+p.patience*.28+p.ambition*.10+rng.int(-25,25))),
  parenthoodDesire:clamp(Math.round(25+p.patience*.24+p.sociability*.18+rng.int(-28,28))),
  homeOwnershipDesire:clamp(Math.round(25+p.discipline*.18+p.ambition*.28+rng.int(-22,22))),
  carOwnershipDesire:clamp(Math.round(20+p.ambition*.16+p.sociability*.12+rng.int(-28,28))),
  riskTolerance:clamp(Math.round(35+(100-p.patience)*.18+p.ambition*.20+rng.int(-18,18)))
 };
 return state.preferences;
}
