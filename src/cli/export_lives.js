import fs from 'node:fs';
import path from 'node:path';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}

function safeText(value){
 if(value==null)return '';
 if(typeof value==='string')return value;
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(typeof value==='object'){
  if(typeof value.text==='string')return value.text;
  try{return JSON.stringify(value);}
  catch{return '[unserializable]';}
 }
 return String(value);
}

function money(value){return '₺'+Math.round(value??0).toLocaleString('tr-TR');}

function historyLine(item){
 const parts=[];
 if(item.eventId)parts.push('event='+item.eventId);
 if(item.choiceId)parts.push('choice='+item.choiceId);
 if(item.activityId)parts.push('activity='+item.activityId);
 if(item.hobbyId)parts.push('hobby='+item.hobbyId);
 if(item.targetId)parts.push('target='+item.targetId);
 const body=safeText(item.text??item.result);
 return '**'+(item.age??'?')+' yaş** · '+(item.kind??'event')+
  (parts.length?' · '+parts.join(' · '):'')+
  (body?' · '+body:'');
}

function lifeMarkdown(game,index){
 const s=game.state;
 const finance=s.finance??{};
 const durable=finance.durableGoods??{};
 const spending=finance.spendingTotals??{};
 const death=s.player.alive?'Hayatta':(s.death?.cause??'Bilinmiyor');
 const durableLines=Object.keys(durable).length
  ?Object.values(durable).map(x=>'- '+x.label+' · '+money(x.price)+' · yaş '+x.purchasedAtAge+' · nesil '+x.generation)
  :['- Yok'];
 const spendingLines=Object.keys(spending).length
  ?Object.entries(spending).map(([k,v])=>'- '+k+': '+money(v))
  :['- Kayıt yok'];
 const spendingHistoryLines=finance.spendingHistory?.length
  ?finance.spendingHistory.map(x=>'- '+x.age+' yaş · '+x.category+' · '+money(x.amount)+' · '+x.label)
  :['- Kayıt yok'];
 const historyLines=s.history?.length?s.history.map(x=>historyLine(x)):['- Kayıt yok'];
 const lines=[
  '# Life '+String(index+1).padStart(4,'0'),
  '',
  '- Seed: '+game.seedText,
  '- Cinsiyet: '+(s.player.sex??'unknown'),
  '- Doğum şehri: '+(s.origin?.cityName??'unknown'),
  '- Son şehir: '+(s.location?.cityName??s.origin?.cityName??'unknown'),
  '- Son yaş: '+s.player.age,
  '- Durum / ölüm nedeni: '+death,
  '- Sağlık: '+Number(s.player.health?.current??0).toFixed(1),
  '- Fitness: '+Number(s.healthProfile?.fitness??0).toFixed(1),
  '- Kronik durum sayısı: '+(s.healthProfile?.conditions?.length??0),
  '- Meslek: '+(s.career?.jobTitle??s.career?.jobId??'none'),
  '- Emekli: '+(s.retirement?.retired?'evet':'hayır'),
  '- İlişki: '+(s.social?.romance?.status??'none'),
  '- Çocuk: '+(s.children?.length??0),
  '- Ev: '+(s.assets?.home?.label??'yok'),
  '- Araba: '+(s.assets?.car?.label??'yok'),
  '- Nakit: '+money(finance.cash),
  '- Birikim: '+money(finance.savings),
  '- Borç: '+money(finance.debt),
  '',
  '## Dayanıklı tüketim','',...durableLines,'',
  '## Harcama toplamları','',...spendingLines,'',
  '## Harcama geçmişi','',...spendingHistoryLines,'',
  '## Yaşam çizelgesi','',...historyLines,''
 ];
 return lines.join('\n');
}

const lives=Math.max(1,Number(arg('lives','1000')));
const toAge=Math.max(1,Number(arg('to-age','100')));
const policy=arg('policy','random');
const seedPrefix=arg('seed-prefix','ci-audit');
const outDir=path.resolve(arg('out','artifacts/1000-lives'));

fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(path.join(outDir,'lives'),{recursive:true});

const manifest=[];
const invalid=[];

for(let i=0;i<lives;i++){
 const game=new Game(seedPrefix+'-'+policy+'-'+i);
 try{
  autoplay(game,{toAge,policy});
  const violations=validateState(game.state);
  if(violations.length)throw new Error(violations.join('; '));
  const file='life-'+String(i+1).padStart(4,'0')+'.md';
  fs.writeFileSync(path.join(outDir,'lives',file),lifeMarkdown(game,i),'utf8');
  manifest.push({
   index:i+1,seed:game.seedText,file:'lives/'+file,
   sex:game.state.player.sex??null,birthCity:game.state.origin?.cityName??null,
   finalCity:game.state.location?.cityName??null,age:game.state.player.age,
   alive:game.state.player.alive,deathCause:game.state.death?.cause??null,
   cash:game.state.finance?.cash??0,savings:game.state.finance?.savings??0,debt:game.state.finance?.debt??0,
   durableGoods:Object.keys(game.state.finance?.durableGoods??{}),
   spendingTotals:game.state.finance?.spendingTotals??{}
  });
 }catch(error){invalid.push({index:i+1,seed:game.seedText,error:error.message});}
}

fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({config:{lives,toAge,policy,seedPrefix},valid:manifest.length,invalid,characters:manifest},null,2),'utf8');

const ages=manifest.map(x=>x.age);
const avgAge=ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0;
const objectObjectCount=fs.readdirSync(path.join(outDir,'lives')).reduce((sum,file)=>{
 const txt=fs.readFileSync(path.join(outDir,'lives',file),'utf8');
 return sum+(txt.match(/\[object Object\]/g)?.length??0);
},0);

const readme=[
 '# Life Tree — 1000 Life Export','',
 '- Valid: '+manifest.length+'/'+lives,
 '- Invalid: '+invalid.length,
 '- Ortalama son yaş: '+avgAge.toFixed(1),
 '- [object Object] occurrence: '+objectObjectCount,
 '- Policy: '+policy,
 '- Seed prefix: '+seedPrefix,'',
 'Her karakter lives/life-XXXX.md altında ayrı dosyadır.',
 'Toplu filtreleme için manifest.json kullanılabilir.',''
].join('\n');
fs.writeFileSync(path.join(outDir,'README.md'),readme,'utf8');

console.log(JSON.stringify({outDir,valid:manifest.length,invalid:invalid.length,objectObjectCount},null,2));
if(invalid.length)process.exitCode=1;
