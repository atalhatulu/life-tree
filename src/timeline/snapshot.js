function cloneNodeWithoutSnapshot(node){
 const {snapshot,...rest}=node??{};
 return structuredClone(rest);
}

function stripForSnapshot(state){
 const snapshot=structuredClone(state);
 const historyLength=snapshot.history?.length??0;
 const priorNodes=(snapshot.lifeTree?.nodes??[]).map(cloneNodeWithoutSnapshot);

 // History is not required to resume simulation logic. Keeping only its
 // length makes snapshots much smaller while preserving chronology metadata.
 snapshot.history=[];
 snapshot.lifeTree={nodes:priorNodes};

 return {state:snapshot,historyLength,priorNodes};
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
  priorNodes:compact.priorNodes,
  state:compact.state
 };
}

export function restoreDecisionSnapshot(snapshot){
 if(!snapshot?.state)throw new Error('Invalid decision snapshot.');
 const state=structuredClone(snapshot.state);
 state.lifeTree??={nodes:[]};
 state.lifeTree.nodes=(snapshot.priorNodes??state.lifeTree.nodes??[]).map(cloneNodeWithoutSnapshot);
 return state;
}
