import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {readFile,writeFile} from 'node:fs/promises';
import {Game} from '../core/game.js';
import {printHeader,printNewHistory,printEvent,printActivities,printLifeGoals} from './presenter.js';
import {assertValidState} from '../simulation/invariants.js';
import {serializeGame} from '../core/save_system.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const targetAge=Math.max(1,Number(arg('to-age','100')));
const loadPath=arg('load',null);
const savePath=arg('save',null);
const rl=createInterface({input,output});

let game;
if(loadPath){
 const raw=await readFile(loadPath,'utf8');
 game=Game.fromSave(raw);
 console.log('\nSave yüklendi: '+loadPath);
}else{
 const seed=(await rl.question('Seed (boş bırak = rastgele): ')).trim()||String(Date.now());
 game=new Game(seed);
}
let historyIndex=game.state.history.length;

console.log('\nLife Tree CLI başladı. Seed: '+game.seedText+' | Hedef yaş: '+targetAge);

while(game.state.player.age<targetAge&&game.state.player.alive){
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

 if(game.state.player.age>=18&&!game.state.lifeGoals?.active&&!(game.state.lifeGoals?.completed?.length)&&!(game.state.lifeGoals?.history?.length)){
  const goals=printLifeGoals(game);
  const pick=Number(await rl.question('Hedef: '));
  if(pick>=1&&pick<=goals.length){
   const goal=game.setLifeGoal(goals[pick-1].id);
   console.log('→ Hedef seçildi: '+goal.label);
  }
 }

 while(game.state.actions.remaining>0&&(game.availableActivities().length||game.availableLifeActions().length)){
  const activities=printActivities(game);
  const pick=Number(await rl.question('Aktivite: '));
  if(!pick) break;
  if(pick>=1&&pick<=activities.length){
   try{
    const action=activities[pick-1];
    console.log('→ '+(action.kind==='life-action'?game.performLifeAction(action.id):game.performActivity(action.id)));
   }catch(error){console.log('! '+error.message);}
  }
 }

 assertValidState(game.state);
 if(savePath){
  await writeFile(savePath,serializeGame(game),'utf8');
  console.log('✓ Autosave: '+savePath);
 }
}

printHeader(game);
console.log('\nLife Tree düğümleri:');
for(const node of game.state.lifeTree.nodes){
 console.log('• '+node.age+' yaş — '+node.title+': '+node.label);
}
if(game.state.deathSummary){
 const d=game.state.deathSummary;
 const recap=d.recap;
 console.log('\nÖlüm özeti:');
 console.log(d.name+' — '+d.age+' yaş | '+d.birthYear+'-'+d.deathYear+' | Neden: '+d.cause);
 console.log('Eğitim: '+d.education+' | Kariyer: '+d.career+(d.retired?' | Emekli':''));
 console.log('Aile: '+d.children+' çocuk • '+d.grandchildren+' torun • '+d.marriages+' evlilik');
 console.log('Kayıplar: '+d.familyLosses+' yakın aile • '+d.friendLosses+' arkadaş');
 console.log('Varlıklar: '+(d.homeOwned?'ev sahibi':'ev yok')+' • '+(d.carOwned?'araba sahibi':'araba yok'));
 console.log('Miras aldığın toplam: ₺'+d.inheritanceReceived.toLocaleString('tr-TR'));
 console.log('Net tereke: ₺'+d.estateNet.toLocaleString('tr-TR')+' | Plan: '+d.estatePlan);
 console.log('Life Tree: '+d.majorDecisions+' büyük karar');
 if(recap?.decisions?.length){
  console.log('Dönüm noktaları:');
  for(const node of recap.decisions)console.log('  - '+node.age+' yaş: '+node.title+' → '+node.choice);
 }
 if(d.heirs?.length)console.log('Mirasçılar: '+d.heirs.map(h=>h.name+' ₺'+h.amount.toLocaleString('tr-TR')).join(' • '));
}
if(savePath){
 await writeFile(savePath,serializeGame(game),'utf8');
}
await rl.close();
