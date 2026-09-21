export const SAVE_VERSION=1;

function clone(value){return structuredClone(value);}

export function createSavePayload(game){
 return {
  version:SAVE_VERSION,
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
 const payload=typeof text==='string'?JSON.parse(text):clone(text);
 const errors=validateSavePayload(payload);
 if(errors.length)throw new Error('Invalid save: '+errors.join('; '));
 return payload;
}
