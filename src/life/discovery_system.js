export const DISCOVERY_VERSION=1;
export const DISCOVERY_STORAGE_KEY='life-tree.discovery.v1';

export function emptyDiscovery(){
 return {
  version:DISCOVERY_VERSION,
  livedChoices:{},
  simulatedChoices:{},
  endings:{},
  livesCompleted:0,
  updatedAt:null
 };
}

export function normalizeDiscovery(value){
 const d=value&&typeof value==='object'?structuredClone(value):emptyDiscovery();
 d.version=DISCOVERY_VERSION;
 d.livedChoices??={};
 d.simulatedChoices??={};
 d.endings??={};
 d.livesCompleted??=0;
 d.updatedAt??=null;
 return d;
}

export function choiceKey(eventId,choiceId){
 return String(eventId)+'::'+String(choiceId);
}

export function recordLivedChoice(discovery,node,{seedText=null}={}){
 const d=normalizeDiscovery(discovery);
 const key=choiceKey(node.eventId,node.choiceId);
 const prior=d.livedChoices[key]??{};
 d.livedChoices[key]={
  eventId:node.eventId,
  choiceId:node.choiceId,
  label:node.label,
  title:node.title,
  firstAge:prior.firstAge??node.age,
  lastAge:node.age,
  timesLived:(prior.timesLived??0)+1,
  lastSeed:seedText??prior.lastSeed??null
 };
 delete d.simulatedChoices[key];
 d.updatedAt=new Date().toISOString();
 return d;
}

export function recordSimulatedChoice(discovery,node,result){
 const d=normalizeDiscovery(discovery);
 const key=choiceKey(node.eventId,result.choiceId);
 if(d.livedChoices[key])return d;
 const prior=d.simulatedChoices[key]??{};
 d.simulatedChoices[key]={
  eventId:node.eventId,
  choiceId:result.choiceId,
  label:result.label,
  title:node.title,
  firstAge:prior.firstAge??node.age,
  lastAge:node.age,
  simulations:(prior.simulations??0)+result.completedSamples,
  lastResult:structuredClone(result)
 };
 d.updatedAt=new Date().toISOString();
 return d;
}

export function recordEnding(discovery,finale,{seedText=null}={}){
 const d=normalizeDiscovery(discovery);
 const id=finale?.ending?.id;
 if(!id)return d;
 const prior=d.endings[id]??{};
 d.endings[id]={
  id,
  title:finale.ending.title,
  description:finale.ending.description,
  timesReached:(prior.timesReached??0)+1,
  firstAge:prior.firstAge??finale.lifespan.age,
  lastAge:finale.lifespan.age,
  lastSeed:seedText??prior.lastSeed??null
 };
 d.updatedAt=new Date().toISOString();
 return d;
}

export function recordCompletedLife(discovery,state,{seedText=null}={}){
 let d=normalizeDiscovery(discovery);
 for(const node of state.lifeTree?.nodes??[])d=recordLivedChoice(d,node,{seedText});
 if(state.lifeTree?.finale)d=recordEnding(d,state.lifeTree.finale,{seedText});
 d.livesCompleted=(d.livesCompleted??0)+1;
 d.updatedAt=new Date().toISOString();
 return d;
}

export function discoveryStatus(discovery,eventId,choiceId){
 const d=normalizeDiscovery(discovery);
 const key=choiceKey(eventId,choiceId);
 if(d.livedChoices[key])return 'lived';
 if(d.simulatedChoices[key])return 'simulated';
 return 'unknown';
}

export function discoveryStats(discovery){
 const d=normalizeDiscovery(discovery);
 return {
  livesCompleted:d.livesCompleted,
  livedChoices:Object.keys(d.livedChoices).length,
  simulatedChoices:Object.keys(d.simulatedChoices).length,
  endings:Object.keys(d.endings).length
 };
}

export function loadDiscovery(storage=globalThis.localStorage){
 if(!storage)return emptyDiscovery();
 try{
  const raw=storage.getItem(DISCOVERY_STORAGE_KEY);
  return raw?normalizeDiscovery(JSON.parse(raw)):emptyDiscovery();
 }catch{
  return emptyDiscovery();
 }
}

export function saveDiscovery(discovery,storage=globalThis.localStorage){
 const d=normalizeDiscovery(discovery);
 if(storage)storage.setItem(DISCOVERY_STORAGE_KEY,JSON.stringify(d));
 return d;
}
