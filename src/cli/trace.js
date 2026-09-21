import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {buildLifeRecap} from '../life/life_recap.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

const seed=arg('seed','trace-life');
const policy=arg('policy','random');
const toAge=Math.max(1,Number(arg('to-age','100')));
const json=process.argv.includes('--json');

const game=new Game(seed);
autoplay(game,{toAge,policy});

if(json){
 console.log(JSON.stringify({
  seed,
  policy,
  targetAge:toAge,
  state:game.state,
  recap:game.state.deathSummary?.recap??buildLifeRecap(game.state)
 },null,2));
 process.exit(0);
}

console.log('Life Tree trace');
console.log('Seed: '+seed+' | Policy: '+policy+' | Target: '+toAge);
console.log('Final: '+game.state.player.name+' '+game.state.player.surname+
 ' | '+game.state.player.age+' yaş | '+(game.state.player.alive?'hayatta':'öldü'));

let lastAge=null;
for(const item of game.state.history){
 if(item.age!==lastAge){
  lastAge=item.age;
  console.log('\n['+lastAge+' yaş]');
 }
 console.log(' - '+(item.result??item.text??item.eventId??'olay'));
}

if(game.state.lifeTree.nodes.length){
 console.log('\nLife Tree dönüm noktaları:');
 for(const node of game.state.lifeTree.nodes){
  console.log(' * '+node.age+' yaş — '+node.title+' -> '+node.label);
 }
}

const recap=game.state.deathSummary?.recap??buildLifeRecap(game.state);
console.log('\nÖzet:');
console.log(' Eğitim: '+(recap.education.university??recap.education.highSchoolPath??'—'));
console.log(' Kariyer geçmişi: '+(recap.work.history.map(x=>x.title).join(' -> ')||'—'));
console.log(' Çocuk: '+recap.family.children.length+' | Torun: '+recap.family.grandchildren);
console.log(' Yakın kayıp: '+recap.family.losses.length+' | Arkadaş kaybı: '+recap.family.deceasedFriends.length);
console.log(' Birikim: ₺'+recap.finances.cash.toLocaleString('tr-TR')+' | Borç: ₺'+recap.finances.debt.toLocaleString('tr-TR'));
console.log(' Büyük karar: '+recap.decisions.length);
