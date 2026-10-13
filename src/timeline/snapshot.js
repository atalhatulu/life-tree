function cloneNodeWithoutSnapshot(node){
 const {snapshot,...rest}=node??{};
 return structuredClone(rest);
}

function stripForSnapshot(state){
 const snapshot=structuredClone(state);
 const historyLength=snapshot.history?.length??0;
 const priorNodes=(snapshot.lifeTree?.nodes??[]).map(cloneNodeWithoutSnapshot);
 snapshot.history=[];
 // Keep the two checkpoint node lists independent so a caller cannot
 // accidentally modify both through a shared reference.
 snapshot.lifeTree={...(snapshot.lifeTree??{}),nodes:structuredClone(priorNodes)};
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
  // Preserve the full safe-integer RNG counter, not only its low 32 bits.
  rng:rngSnapshot?snapshotRng({rng:rngSnapshot}):null,
  state:compact.state
 };
}

export function restoreDecisionSnapshot(snapshot){
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 if(!isObject(snapshot)||!isObject(snapshot.state)||!isObject(snapshot.state.player))
  throw new Error('Invalid decision snapshot: missing state or player');
 // Metadata is optional for old checkpoints, but explicitly present
 // malformed fields must not be mistaken for valid decision provenance.
 if((Object.hasOwn(snapshot,'version')&&snapshot.version!==1&&snapshot.version!==2)||
    (Object.hasOwn(snapshot,'historyLength')&&
      (!Number.isSafeInteger(snapshot.historyLength)||snapshot.historyLength<0))||
    (Object.hasOwn(snapshot,'eventId')&&
      (typeof snapshot.eventId!=='string'||snapshot.eventId.length===0)))
  throw new Error('Invalid decision snapshot: malformed metadata');
 if(Object.hasOwn(snapshot,'availableChoices')){
  const choices=snapshot.availableChoices;
  if(!Array.isArray(choices)||choices.some(choice=>!isObject(choice)||
       typeof choice.id!=='string'||choice.id.length===0||
       typeof choice.label!=='string')||
     new Set(choices.map(choice=>choice.id)).size!==choices.length)
   throw new Error('Invalid decision snapshot: malformed choices');
 }
 const stateSource=snapshot.state;
 // Schema migration supplies omitted legacy fields, but it must not hide
 // explicitly malformed nested checkpoint collections or crash on them.
 for(const value of [stateSource.flags,stateSource.social,stateSource.lifeGoals,
  stateSource.npcInitiatives,stateSource.actions,stateSource.childMoney,
  stateSource.finance,stateSource.finance?.debts]){
  if(value!==undefined&&!isObject(value))
   throw new Error('Invalid decision snapshot: malformed nested state');
 }
 for(const value of [stateSource.flags?.completedEvents,stateSource.social?.friends,
  stateSource.social?.exPartners,stateSource.social?.exSpouses,
  stateSource.social?.deceasedPartners,stateSource.children,
  stateSource.lifeGoals?.completed,stateSource.lifeGoals?.history,
  stateSource.npcInitiatives?.pending,stateSource.npcInitiatives?.history]){
  if(value!==undefined&&!Array.isArray(value))
   throw new Error('Invalid decision snapshot: malformed nested collection');
 }
 if(Array.isArray(stateSource.flags?.completedEvents)&&
    stateSource.flags.completedEvents.some(id=>typeof id!=='string'||!id.length))
  throw new Error('Invalid decision snapshot: malformed completed events');
 if(!Number.isSafeInteger(stateSource.year)||stateSource.year<0||
    !Number.isSafeInteger(stateSource.player.age)||stateSource.player.age<0||
    (Object.hasOwn(snapshot,'year')&&snapshot.year!==stateSource.year)||
    (Object.hasOwn(snapshot,'age')&&snapshot.age!==stateSource.player.age))
  throw new Error('Invalid decision snapshot: calendar or age mismatch');
 if((Object.hasOwn(stateSource,'lifeTree')&&!isObject(stateSource.lifeTree))||
    (isObject(stateSource.lifeTree)&&Object.hasOwn(stateSource.lifeTree,'nodes')&&
      !Array.isArray(stateSource.lifeTree.nodes))||
    (isObject(stateSource.lifeTree)&&Object.hasOwn(stateSource.lifeTree,'branches')&&
      !Array.isArray(stateSource.lifeTree.branches))||
    (Object.hasOwn(stateSource,'history')&&!Array.isArray(stateSource.history))||
    (Array.isArray(stateSource.lifeTree?.nodes)&&
      !stateSource.lifeTree.nodes.every(isObject))||
    (Array.isArray(stateSource.lifeTree?.branches)&&
      !stateSource.lifeTree.branches.every(isObject))||
    (Object.hasOwn(snapshot,'priorNodes')&&(!Array.isArray(snapshot.priorNodes)||
      !snapshot.priorNodes.every(isObject))))
  throw new Error('Invalid decision snapshot: malformed collections');
 // Restoring a checkpoint must not reintroduce future or out-of-order
 // records that bypass the outer save's history/node chronology checks.
 for(const items of [stateSource.history,stateSource.lifeTree?.nodes,snapshot.priorNodes]){
  if(!Array.isArray(items))continue;
  let previousAge=-1;
  for(const item of items){
   if(!isObject(item)||!Object.hasOwn(item,'age'))continue;
   if(!Number.isSafeInteger(item.age)||item.age<0||item.age<previousAge||
      item.age>stateSource.player.age)
    throw new Error('Invalid decision snapshot: invalid timeline chronology');
   previousAge=item.age;
  }
 }
 // Both copies are written by createDecisionSnapshot. Continuation sampling
 // intentionally compacts embedded nodes to []; keep that legacy behavior,
 // but reject conflicting nonempty duplicates.
 if(Array.isArray(snapshot.priorNodes)&&Array.isArray(stateSource.lifeTree?.nodes)&&
    stateSource.lifeTree.nodes.length>0&&
    JSON.stringify(snapshot.priorNodes)!==JSON.stringify(stateSource.lifeTree.nodes))
  throw new Error('Invalid decision snapshot: conflicting prior nodes');
 const state=structuredClone(stateSource);
 state.lifeTree??={nodes:[],branches:[],nextBranchId:1};
 state.lifeTree.nodes=(snapshot.priorNodes??state.lifeTree.nodes??[]).map(cloneNodeWithoutSnapshot);
 state.lifeTree.branches??=[];
 state.lifeTree.nextBranchId??=1;
 return state;
}

export function snapshotRng(snapshot){
 const rng=snapshot?.rng;
 if(rng==null)return null;
 if(typeof rng!=='object'||Array.isArray(rng)||
    !Number.isInteger(rng.seed)||rng.seed<0||rng.seed>0xffffffff||
    !Number.isSafeInteger(rng.state)||rng.state<0)
  throw new RangeError('Invalid decision RNG snapshot');
 return {seed:rng.seed,state:rng.state};
}
