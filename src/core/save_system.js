import {ensureStateSchema,STATE_SCHEMA_VERSION} from './state_schema.js';
import {restoreDecisionSnapshot,snapshotRng} from '../timeline/snapshot.js';

export const SAVE_VERSION=2;

function clone(value){return structuredClone(value);}

// Only IDs allocated by this game's branch allocator affect the next number.
// Custom IDs in older saves are left untouched for backward compatibility.
function allocatedBranchNumber(id){
 if(typeof id!=='string'||!/^branch-[1-9]\d*$/.test(id))return null;
 const value=Number(id.slice(7));
 return Number.isSafeInteger(value)?value:null;
}

function migrateState(state){
 const hasCounter=state?.lifeTree&&Object.hasOwn(state.lifeTree,'nextBranchId');
 const migrated=ensureStateSchema(state);
 if(!hasCounter){
  let maxId=0;
  for(const branch of migrated.lifeTree.branches){
   const value=allocatedBranchNumber(branch?.id);
   if(value!==null&&value>maxId)maxId=value;
  }
  if(maxId>0&&maxId<Number.MAX_SAFE_INTEGER)
   migrated.lifeTree.nextBranchId=maxId+1;
 }
 return migrated;
}

function migrateV1(payload){
 const next=clone(payload);
 next.version=2;
 next.state=migrateState(next.state);
 next.migratedFromVersion=1;
 return next;
}

export function migrateSavePayload(payload){
 if(!payload||typeof payload!=='object')return payload;
 if(payload.version===1)return migrateV1(payload);
 if(payload.version===SAVE_VERSION){
  const next=clone(payload);
  next.state=migrateState(next.state);
  return next;
 }
 return clone(payload);
}

export function createSavePayload(game){
 ensureStateSchema(game.state);
 return {
  version:SAVE_VERSION,
  schemaVersion:STATE_SCHEMA_VERSION,
  savedAtYear:game.state.year,
  savedAtAge:game.state.player.age,
  seedText:game.seedText,
  rng:{
   seed:game.rng.seed,
   state:game.rng.state
  },
  activeEventId:game.activeEventId??null,
  state:clone(game.state)
 };
}

// Check explicitly present collection fields before schema migration can hide
// malformed input by creating defaults, or crash while accessing nested data.
function validateSaveShape(payload){
 const errors=[];
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 if(!isObject(payload))return ['save payload must be an object'];
 if(!isObject(payload.state))return ['missing or invalid state object'];
 const state=payload.state;
 if(!isObject(state.player))errors.push('missing or invalid player state');
 // The annual clock dereferences every founder and sibling. A save with a
 // missing relative can load but fail at the next birthday, losing progress.
 if(!isObject(state.parents)||!isObject(state.grandparents)||
    !isObject(state.grandparents?.maternal)||!isObject(state.grandparents?.paternal)||
    !Array.isArray(state.siblings))
  errors.push('invalid family structure');
 const relatives=[
  state.parents?.mother,state.parents?.father,
  state.grandparents?.maternal?.grandmother,state.grandparents?.maternal?.grandfather,
  state.grandparents?.paternal?.grandmother,state.grandparents?.paternal?.grandfather,
  ...(Array.isArray(state.siblings)?state.siblings:[])
 ];
 // Family identities are referenced by relationship maps and family events.
 // A duplicate or absent ID can silently redirect a relationship to someone
 // else even when the rest of the family structure is well-formed.
 const familyIds=new Set();
 for(const relative of [state.player,...relatives]){
  if(!isObject(relative)){
   errors.push('invalid family member');continue;
  }
  if(typeof relative.id!=='string'||relative.id.length===0||familyIds.has(relative.id))
   errors.push('invalid or duplicate family member ID');
  else familyIds.add(relative.id);
  // Dead legacy relatives may have no age; living people are incremented.
  if(relative!==state.player&&relative.alive!==false&&
     (!Number.isSafeInteger(relative.age)||relative.age<0))
   errors.push('invalid living family member age');
 }
 // Optional legacy containers may be absent, but if present they must be
 // objects. In particular, a primitive finance.debts crashes schema migration
 // before the caller can receive a useful Invalid save error.
 for(const [label,value] of [
  ['life tree',state.lifeTree],['flags',state.flags],['social',state.social],
  ['life goals',state.lifeGoals],['NPC initiatives',state.npcInitiatives]
 ])if(value!==undefined&&!isObject(value))errors.push('invalid '+label+' object');
 for(const [label,value] of [
  ['finance',state.finance],['finance debts',state.finance?.debts],
  ['actions',state.actions],['child money',state.childMoney],
  ['primary stats',state.primaryStats],['health profile',state.healthProfile],
  ['health risk exposure',state.healthProfile?.riskExposure],
  ['world',state.world],['world economy',state.world?.economy],
  ['mental health',state.mentalHealth],['player health',state.player?.health]
 ])if(value!=null&&!isObject(value))errors.push('invalid '+label+' object');
 for(const [label,value] of [
  ['history',state.history],['life tree nodes',state.lifeTree?.nodes],
  ['life tree branches',state.lifeTree?.branches],
  ['completed events',state.flags?.completedEvents],
  ['friends',state.social?.friends],['children',state.children],
  ['life goals completed',state.lifeGoals?.completed],
  ['life goals history',state.lifeGoals?.history],
  ['NPC initiatives pending',state.npcInitiatives?.pending],
  ['NPC initiatives history',state.npcInitiatives?.history]
 ])if(value!==undefined&&!Array.isArray(value))errors.push('invalid '+label+' array');
 for(const [label,value] of [
  ['world shock history',state.world?.shockHistory],
  ['health conditions',state.healthProfile?.conditions],
  ['mental episodes',state.mentalHealth?.episodes]
 ])if(value!=null&&!Array.isArray(value))errors.push('invalid '+label+' array');
 // Check array entries as well as containers: a null node or non-string
 // completed ID can otherwise survive migration and break later traversal.
 for(const [label,items] of [
  ['history',state.history],['life tree nodes',state.lifeTree?.nodes],
  ['life tree branches',state.lifeTree?.branches]
 ])if(Array.isArray(items)&&items.some(item=>!isObject(item)))
  errors.push('invalid '+label+' entry');
 // Legacy entries can omit ages. Explicit ages must be within the saved
 // lifetime and must never travel backwards through an append-only timeline.
 const currentAge=state.player?.age;
 if(Number.isSafeInteger(currentAge)&&currentAge>=0){
  for(const [label,items] of [
   ['history',state.history],['life tree node',state.lifeTree?.nodes]
  ])if(Array.isArray(items)){
   let previousAge=-1;
   for(const item of items){
    if(!isObject(item)||!Object.hasOwn(item,'age'))continue;
    if(!Number.isSafeInteger(item.age)||item.age<0||item.age>currentAge){
     errors.push('invalid '+label+' age');break;
    }
    if(item.age<previousAge){
     errors.push('out-of-order '+label+' age');break;
    }
    previousAge=item.age;
   }
  }
 }
 // Friends are aged and updated during the annual social pass. Reject
 // malformed living records before they can cause a partial birthday tick.
 // Older deceased entries may have incomplete age and relationship fields.
 if(Array.isArray(state.social?.friends)){
  const friendIds=new Set();
  for(const friend of state.social.friends){
   if(!isObject(friend)){
    errors.push('invalid friend entry');continue;
   }
   if(typeof friend.id!=='string'||!friend.id||friendIds.has(friend.id))
    errors.push('invalid or duplicate friend ID');
   else friendIds.add(friend.id);
   if(friend.alive!==false){
    if(!Number.isSafeInteger(friend.age)||friend.age<0||
       !Number.isFinite(friend.relationship)||friend.relationship<0||friend.relationship>100)
     errors.push('invalid living friend age or relationship');
    if(friend.yearsKnown!=null&&(!Number.isSafeInteger(friend.yearsKnown)||friend.yearsKnown<0))
     errors.push('invalid friend yearsKnown');
    if(friend.lastContactAge!=null&&(!Number.isSafeInteger(friend.lastContactAge)||
       friend.lastContactAge<0||friend.lastContactAge>state.player?.age))
     errors.push('invalid friend contact age');
   }
  }
 }
 // Children are addressed by ID in parenting decisions and are aged each
 // year. Validate their references and chronology before a save is restored.
 // Deceased legacy descendants may omit an age because they are not aged.
 // Do not enforce a player/child age gap here: legacy saved fixtures can
 // contain descendants with independently initialized timeline ages.
 if(Array.isArray(state.children)){
  const childIds=new Set();
  for(const child of state.children){
   if(!isObject(child)){
    errors.push('invalid child entry');continue;
   }
   if(typeof child.id!=='string'||!child.id.length||childIds.has(child.id))
    errors.push('invalid or duplicate child ID');
   else childIds.add(child.id);
   if(child.age===undefined&&child.alive===false)continue;
   if(!Number.isSafeInteger(child.age)||child.age<0)
    errors.push('invalid child age');
  }
 }
 // A saved major decision must be restorable and describe the same event,
 // chosen option and moment as its containing Life Tree node. Without this
 // check a corrupted save loads successfully but fails on a later branch.
 if(Array.isArray(state.lifeTree?.nodes))for(const node of state.lifeTree.nodes){
  if(!isObject(node)||node.snapshot==null)continue;
  const snap=node.snapshot;
  if(!isObject(snap)||
     (Object.hasOwn(snap,'eventId')&&snap.eventId!==node.eventId)||
     (Object.hasOwn(snap,'age')&&Object.hasOwn(node,'age')&&snap.age!==node.age)||
     (isObject(snap.state?.player)&&Object.hasOwn(node,'age')&&
       snap.state.player.age!==node.age)||
     (Array.isArray(snap.availableChoices)&&
       !snap.availableChoices.some(choice=>choice?.id===node.choiceId))){
   errors.push('invalid life tree decision provenance');continue;
  }
  try{restoreDecisionSnapshot(snap);snapshotRng(snap);}
  catch{errors.push('invalid life tree decision snapshot');}
 }
 // Branch IDs are referenced by currentBranchId and used to allocate future
 // branches. Duplicate/malformed IDs and dangling node indexes are unsafe.
 const tree=state.lifeTree;
 if(isObject(tree)){
  if(Object.hasOwn(tree,'nextBranchId')&&
     (!Number.isSafeInteger(tree.nextBranchId)||tree.nextBranchId<1))
   errors.push('invalid life tree branch counter');
  if(Array.isArray(tree.branches)){
   const ids=new Set();
   for(const branch of tree.branches){
    if(!isObject(branch))continue; // Covered by entry-shape validation.
    if(typeof branch.id!=='string'||branch.id.length===0||ids.has(branch.id))
     errors.push('invalid or duplicate life tree branch ID');
    else ids.add(branch.id);
    if(Object.hasOwn(branch,'parentNodeIndex')&&
       (!Number.isSafeInteger(branch.parentNodeIndex)||branch.parentNodeIndex<0||
        !Array.isArray(tree.nodes)||branch.parentNodeIndex>=tree.nodes.length))
     errors.push('invalid life tree branch parent index');
    // Optional for legacy branches. Only the active branch must match the
    // current node choice: a later fork can overwrite an ancestor choice.
    const parent=Number.isSafeInteger(branch.parentNodeIndex)&&
      branch.parentNodeIndex>=0?tree.nodes?.[branch.parentNodeIndex]:null;
    if((Object.hasOwn(branch,'eventId')&&
        (typeof branch.eventId!=='string'||!branch.eventId.length||
         (isObject(parent)&&parent.eventId!=null&&branch.eventId!==parent.eventId)))||
       (Object.hasOwn(branch,'originalChoiceId')&&
        (typeof branch.originalChoiceId!=='string'||!branch.originalChoiceId.length))||
       (Object.hasOwn(branch,'alternateChoiceId')&&
        (typeof branch.alternateChoiceId!=='string'||!branch.alternateChoiceId.length||
         (branch.id===tree.currentBranchId&&isObject(parent)&&
          parent.choiceId!=null&&branch.alternateChoiceId!==parent.choiceId)))||
       (typeof branch.originalChoiceId==='string'&&
        branch.originalChoiceId===branch.alternateChoiceId)||
       (Object.hasOwn(branch,'createdAtAge')&&
        (!Number.isSafeInteger(branch.createdAtAge)||branch.createdAtAge<0)))
     errors.push('invalid life tree branch provenance');
   }
   // A stale counter can load successfully yet fail at the next fork.
   // Enforce it on explicit counters; missing legacy counters are inferred
   // during migration, preserving old save compatibility.
   if(Object.hasOwn(tree,'nextBranchId')&&Number.isSafeInteger(tree.nextBranchId)){
    for(const id of ids){
     const allocated=allocatedBranchNumber(id);
     if(allocated!==null&&allocated>=tree.nextBranchId){
      errors.push('stale life tree branch counter');break;
     }
    }
   }
   if(tree.currentBranchId!=null&&
      (typeof tree.currentBranchId!=='string'||!ids.has(tree.currentBranchId)))
    errors.push('invalid current life tree branch ID');
  }
 }
 if(Array.isArray(state.flags?.completedEvents)&&
    state.flags.completedEvents.some(id=>typeof id!=='string'||id.length===0))
  errors.push('invalid completed event ID');
 if(payload.activeEventId!=null&&
    (typeof payload.activeEventId!=='string'||payload.activeEventId.length===0))
  errors.push('invalid active event ID');
 return errors;
}

export function validateSavePayload(payload){
 const errors=validateSaveShape(payload);
 if(errors.length&&(!payload||typeof payload!=='object'||!payload.state||Array.isArray(payload.state)))return errors;
 if(payload.version!==SAVE_VERSION)errors.push('unsupported save version: '+payload.version);
 if(typeof payload.seedText!=='string'||!payload.seedText.length)errors.push('missing seedText');
 const rng=payload.rng;
 if(!rng||typeof rng!=='object'||Array.isArray(rng)||
    !Number.isInteger(rng.seed)||rng.seed<0||rng.seed>0xffffffff||
    !Number.isSafeInteger(rng.state)||rng.state<0)errors.push('invalid rng snapshot');
 const state=payload.state;
 if(!Number.isSafeInteger(state.year)||state.year<0)errors.push('invalid world year');
 if(!Number.isSafeInteger(state.player?.age)||state.player.age<0)errors.push('invalid player age');
 if(!Array.isArray(state.history))errors.push('missing history');
 if(!Array.isArray(state.lifeTree?.nodes))errors.push('missing life tree');
 if(Object.hasOwn(payload,'savedAtYear')&&
    (!Number.isSafeInteger(payload.savedAtYear)||payload.savedAtYear<0||payload.savedAtYear!==state.year))
  errors.push('savedAtYear does not match world year');
 if(Object.hasOwn(payload,'savedAtAge')&&
    (!Number.isSafeInteger(payload.savedAtAge)||payload.savedAtAge<0||payload.savedAtAge!==state.player?.age))
  errors.push('savedAtAge does not match player age');
 return errors;
}

export function serializeGame(game,pretty=true){
 return JSON.stringify(createSavePayload(game),null,pretty?2:0);
}

export function parseSave(text){
 const raw=typeof text==='string'?JSON.parse(text):clone(text);
 const shapeErrors=validateSaveShape(raw);
 if(shapeErrors.length)throw new Error('Invalid save: '+shapeErrors.join('; '));
 const payload=migrateSavePayload(raw);
 const errors=validateSavePayload(payload);
 if(errors.length)throw new Error('Invalid save: '+errors.join('; '));
 return payload;
}

// Explicit, conservative repair for a small set of OPTIONAL legacy
// containers. Replacing a malformed container discards its contents, so this
// is never invoked by normal loading and always returns an audit trail.
// Core timeline, family identities, RNG and required fields are never guessed.
export function repairSavePayload(input){
 const raw=typeof input==='string'?JSON.parse(input):clone(input);
 const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 if(!isObject(raw)||!isObject(raw.state)||
    (raw.version!==1&&raw.version!==SAVE_VERSION))
  throw new Error('Invalid save: unsupported repair input');
 const repairs=[];
 const fix=(parent,key,expected,replacement,path)=>{
  if(!isObject(parent)||!Object.hasOwn(parent,key))return;
  const value=parent[key];
  if(expected(value))return;
  parent[key]=replacement();
  repairs.push(path);
 };
 const state=raw.state;
 fix(state.world,'shockHistory',Array.isArray,()=>[],'world.shockHistory');
 fix(state.healthProfile,'conditions',Array.isArray,()=>[],'healthProfile.conditions');
 fix(state.healthProfile,'riskExposure',isObject,()=>({}),'healthProfile.riskExposure');
 fix(state.mentalHealth,'episodes',Array.isArray,()=>[],'mentalHealth.episodes');
 fix(state.finance,'debts',isObject,()=>({}),'finance.debts');
 // Re-run the entire strict load path. Repairs are not accepted if any
 // unrelated corruption remains; the input object itself is never changed.
 const payload=parseSave(raw);
 return {payload,repairs};
}
