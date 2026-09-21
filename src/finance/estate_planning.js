export function setEstatePlan(state,plan){
 state.estatePlan={type:plan,setAtAge:state.player.age};
 return state.estatePlan;
}
