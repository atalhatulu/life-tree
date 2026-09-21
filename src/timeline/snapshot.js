function stripForSnapshot(state){
 const snapshot=structuredClone(state);
 // History is not needed to branch simulation logic and would make every
 // Life Tree node recursively heavier. Keep only the history position.
 const historyLength=snapshot.history?.length??0;
 snapshot.history=[];
 // The tree itself is represented separately; avoid recursive snapshots.
 if(snapshot.lifeTree)snapshot.lifeTree={nodes:[]};
 return {state:snapshot,historyLength};
}

export function createDecisionSnapshot(state,event,choices){
 const compact=stripForSnapshot(state);
 return {
  version:1,
  age:state.player.age,
  year:state.year,
  eventId:event.id,
  title:event.title,
  availableChoices:choices.map(choice=>({id:choice.id,label:choice.label})),
  historyLength:compact.historyLength,
  state:compact.state
 };
}

export function restoreDecisionSnapshot(snapshot){
 if(!snapshot?.state)throw new Error('Invalid decision snapshot.');
 return structuredClone(snapshot.state);
}
