// Deterministic, moderately long integration smoke test for midlife choices.
// Unlike the short three-life smoke, this reaches the first parent-care window.
import assert from 'node:assert/strict';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';

const lives=10,toAge=40,policy='random';
for(let index=0;index<lives;index++){
 const game=new Game(`batch-${policy}-${index}`);
 try{
  autoplay(game,{toAge,policy});
  assert.deepEqual(validateState(game.state),[]);
 }catch(error){
  throw new Error(`Midlife smoke failed for ${game.seedText} at age ${game.state.player.age}: ${error.message}`,{cause:error});
 }
}
console.log(`Midlife smoke: ${lives}/${lives} lives, to age ${toAge}, ${policy} policy, no invalid states`);
