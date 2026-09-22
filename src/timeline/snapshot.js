function cloneNodeWithoutSnapshot(node){
 const {snapshot,...rest}=node??{};
 return structuredClone(rest);
}

function stripForSnapshot(state){
 const snapshot=structuredClone(state);
 const historyLength=snapshot.history?.length??0;
 const priorNodes=(snapshot.lifeTree?.nodes??[]).map(cloneNodeWithoutSnapshot);
 snapshot.history=[];
 snapshot.lifeTree={...(snapshot.lifeTree??{}),nodes:priorNodes};
 return {state:snapshot,historyLength,priorNodes};
}

export function createDecisionSnapshot(state,event,choices,rngSnapshot=null){
 const compact=stripForSnapshot(state);
 return {
  version:2,
  age:state.player.age,
  year:state.year,
  eventId:event.id,
  title:event.title,
  availableChoices:choices.map(choice=>({id:choice.id,label:choice.label})),
  historyLength:compact.historyLength,
  priorNodes:compact.priorNodes,
  rng:rngSnapshot?{seed:rngSnapshot.seed>>>0,state:rngSnapshot.state>>>0}:null,
  state:compact.state
 };
}

export function restoreDecisionSnapshot(snapshot){
 if(!snapshot?.state)throw new Error('Invalid decision snapshot.');
 const state=structuredClone(snapshot.state);
 state.lifeTree??={nodes:[],branches:[],nextBranchId:1};
 state.lifeTree.nodes=(snapshot.priorNodes??state.lifeTree.nodes??[]).map(cloneNodeWithoutSnapshot);
 state.lifeTree.branches??=[];
 state.lifeTree.nextBranchId??=1;
 return state;
}

export function snapshotRng(snapshot){
 return snapshot?.rng?{seed:snapshot.rng.seed>>>0,state:snapshot.rng.state>>>0}:null;
}
