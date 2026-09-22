import {ensureStateSchema,STATE_SCHEMA_VERSION} from './state_schema.js';

export const SAVE_VERSION=2;

function clone(value){return structuredClone(value);}

function migrateV1(payload){
 const next=clone(payload);
 next.version=2;
 next.state=ensureStateSchema(next.state);
 next.migratedFromVersion=1;
 return next;
}

export function migrateSavePayload(payload){
 if(!payload||typeof payload!=='object')return payload;
 if(payload.version===1)return migrateV1(payload);
 if(payload.version===SAVE_VERSION){
  const next=clone(payload);
  next.state=ensureStateSchema(next.state);
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

export function validateSavePayload(payload){
 const errors=[];
 if(!payload||typeof payload!=='object')return ['save payload must be an object'];
 if(payload.version!==SAVE_VERSION)errors.push('unsupported save version: '+payload.version);
 if(typeof payload.seedText!=='string'||!payload.seedText.length)errors.push('missing seedText');
 if(!payload.rng||!Number.isInteger(payload.rng.seed)||!Number.isInteger(payload.rng.state))errors.push('invalid rng snapshot');
 if(!payload.state?.player)errors.push('missing player state');
 if(!Number.isInteger(payload.state?.year))errors.push('invalid world year');
 if(!Array.isArray(payload.state?.history))errors.push('missing history');
 if(!Array.isArray(payload.state?.lifeTree?.nodes))errors.push('missing life tree');
 return errors;
}

export function serializeGame(game,pretty=true){
 return JSON.stringify(createSavePayload(game),null,pretty?2:0);
}

export function parseSave(text){
 const raw=typeof text==='string'?JSON.parse(text):clone(text);
 const payload=migrateSavePayload(raw);
 const errors=validateSavePayload(payload);
 if(errors.length)throw new Error('Invalid save: '+errors.join('; '));
 return payload;
}
