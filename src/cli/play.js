import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {Game} from '../core/game.js';
import {printHeader,printNewHistory,printEvent,printActivities} from './presenter.js';
import {assertValidState} from '../simulation/invariants.js';

const rl=createInterface({input,output});
const seed=(await rl.question('Seed (boş bırak = rastgele): ')).trim()||String(Date.now());
const game=new Game(seed);
let historyIndex=0;

console.log('\nLife Tree CLI başladı. Seed: '+seed);

while(game.state.player.age<18){
 printHeader(game);
 const answer=(await rl.question('\n+1 yaş için Enter, çıkmak için q: ')).trim().toLowerCase();
 if(answer==='q') break;

 const event=game.ageOneYear();
 historyIndex=printNewHistory(game,historyIndex);

 if(event){
  const choices=printEvent(game,event);
  let pick=-1;
  while(pick<0||pick>=choices.length){
   pick=Number(await rl.question('Seçim: '))-1;
  }
  console.log('\n→ '+game.makeChoice(event,choices[pick].id));
  historyIndex=game.state.history.length;
 }

 while(game.state.actions.remaining>0&&game.availableActivities().length){
  const activities=printActivities(game);
  const pick=Number(await rl.question('Aktivite: '));
  if(!pick) break;
  if(pick>=1&&pick<=activities.length){
   try{console.log('→ '+game.performActivity(activities[pick-1].id));}
   catch(error){console.log('! '+error.message);}
  }
 }
 assertValidState(game.state);
}

printHeader(game);
console.log('\nLife Tree düğümleri:');
for(const node of game.state.lifeTree.nodes){
 console.log('• '+node.age+' yaş — '+node.title+': '+node.label);
}
await rl.close();
