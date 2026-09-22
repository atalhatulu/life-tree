import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';
import {physicalCapacity} from '../health/physical_capacity.js';
import {geneticSummary} from '../health/genetic_system.js';
import {spendingSummary} from '../finance/life_spending_system.js';

function arg(name,fallback){
 const i=process.argv.indexOf('--'+name);
 return i>=0&&process.argv[i+1]!=null?process.argv[i+1]:fallback;
}
function money(v){return '₺'+Math.round(v??0).toLocaleString('tr-TR');}
function text(v){return v==null||v===''?'—':String(v);}
function csv(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function inc(obj,key,by=1){obj[key]=(obj[key]??0)+by;}
function safeHistoryLine(item){
 const parts=[
  item.eventId&&('event='+item.eventId),
  item.choiceId&&('choice='+item.choiceId),
  item.activityId&&('activity='+item.activityId),
  item.hobbyId&&('hobby='+item.hobbyId),
  item.text,
  item.result
 ].filter(Boolean);
 return '- **'+text(item.age)+' yaş** · '+text(item.kind)+' · '+(parts.length?parts.join(' · '):'kayıt');
}
function partnerHistory(state){
 return [
  ...(state.social?.exPartners??[]),
  ...(state.social?.exSpouses??[]),
  ...(state.social?.deceasedPartners??[]),
  ...(state.social?.romance?[state.social.romance]:[])
 ];
}
function lifeMarkdown(game,index){
 const s=game.state;
 const finance=s.finance??{};
 const spending=spendingSummary(s);
 const genetics=geneticSummary(s.player);
 const conditions=s.healthProfile?.conditions??[];
 const partners=partnerHistory(s);
 const children=s.children??[];
 const durable=Object.values(finance.durableGoods??{});
 const cash=finance.cash??0,savings=finance.savings??0,debt=finance.debt??0;
 const home=s.assets?.home?.price??0,car=s.assets?.car?.price??0;
 const netWorth=cash+savings+home+car-debt;
 const lines=[
  '# Life '+String(index).padStart(4,'0'),
  '',
  '- **Seed:** '+game.seedText,
  '- **Cinsiyet:** '+text(s.player.sex),
  '- **Doğum yeri:** '+text(s.origin?.cityName),
  '- **Son şehir:** '+text(s.location?.cityName??s.origin?.cityName),
  '- **Çocukluk sınıfı:** '+text(s.player.background?.childhoodClass??s.household?.economicClass),
  '- **Son yaş:** '+text(s.player.age),
  '- **Durum:** '+(s.player.alive?'Hayatta':'Öldü'),
  '- **Ölüm nedeni:** '+text(s.death?.cause),
  '',
  '## Sağlık',
  '',
  '- Health: '+Number(s.player.health?.current??0).toFixed(1),
  '- Fitness: '+Number(s.healthProfile?.fitness??0).toFixed(1),
  '- Physical capacity: '+Number(physicalCapacity(s)).toFixed(1),
  '- Stress: '+Number(s.healthProfile?.stress??0).toFixed(1),
  '- Constitution: '+Number(s.player.health?.constitution??0).toFixed(1),
  '- Hastalık sayısı: '+conditions.length,
  ...(conditions.length?conditions.map(c=>'- '+text(c.label??c.id)+' · evre '+text(c.progression?.stage)+' · tanı yaşı '+text(c.diagnosedAtAge)+' · tedavi '+(c.treated?'evet':'hayır')):['- Hastalık kaydı yok']),
  '',
  '## Genetik',
  '',
  '- Etkilenen kalıtsal durumlar: '+(genetics.affected?.join(', ')||'yok'),
  '- Taşıyıcılıklar: '+(genetics.carriers?.join(', ')||'yok'),
  '- Poligenik riskler: '+Object.entries(genetics.polygenic??{}).map(([k,v])=>k+'='+v).join(', '),
  '',
  '## Eğitim ve kariyer',
  '',
  '- Lise yolu: '+text(s.education?.pathLabel??s.education?.path),
  '- Üniversite: '+text(s.higherEducation?.universityName),
  '- Program: '+text(s.higherEducation?.programTitle),
  '- Mezuniyet: '+(s.higherEducation?.completed?'evet':'hayır'),
  '- Son meslek: '+text(s.career?.title),
  '- Kariyer ailesi: '+text(s.career?.family),
  '- Toplam deneyim: '+text(s.careerProfile?.totalExperience??s.career?.totalYears)+' yıl',
  '- Emekli: '+(s.retirement?.retired?'evet':'hayır'),
  '- Emeklilik yaşı: '+text(s.retirement?.retiredAtAge),
  '',
  '## İlişkiler ve aile',
  '',
  '- İlişki sayısı: '+partners.length,
  '- Aktif ilişki: '+text(s.social?.romance?.status),
  '- Evlilik geçmişi: '+((s.social?.exSpouses?.length??0)>0||partners.some(p=>p.status==='married')?'evet':'hayır'),
  '- Çocuk sayısı: '+children.length,
  '- Arkadaş sayısı: '+(s.social?.friends?.length??0),
  ...(children.length?children.map((c,i)=>'- Çocuk '+(i+1)+': '+text(c.name)+' · '+text(c.sex)+' · '+text(c.age)+' yaş · '+text(c.adultLife?.jobTitle??c.educationPlan)):[]),
  '',
  '## Finans',
  '',
  '- Nakit: '+money(cash),
  '- Birikim: '+money(savings),
  '- Borç: '+money(debt),
  '- Net değer: '+money(netWorth),
  '- Ev: '+(s.assets?.home?text(s.assets.home.label)+' · '+money(s.assets.home.price):'yok'),
  '- Araba: '+(s.assets?.car?text(s.assets.car.label)+' · '+money(s.assets.car.price):'yok'),
  '- Ömür boyu kayıtlı harcama: '+money(spending.total),
  '- Harcama kategorileri: '+(Object.entries(spending.byCategory).map(([k,v])=>k+'='+money(v)).join(' · ')||'yok'),
  '',
  '## Dayanıklı tüketim',
  '',
  ...(durable.length?durable.map(item=>'- '+text(item.label)+' · nesil '+text(item.generation)+' · son alım '+text(item.purchasedAtAge)+' yaş · '+money(item.price)):['- Kayıtlı dayanıklı tüketim ürünü yok']),
  '',
  '## Yaşam çizelgesi',
  '',
  ...((s.history??[]).length?(s.history??[]).map(safeHistoryLine):['- Geçmiş kaydı yok']),
  ''
 ];
 return {markdown:lines.join('\n'),netWorth,spending,conditions,partners,children,durable};
}

const lives=Math.max(1,Number(arg('lives','1000')));
const toAge=Math.max(1,Number(arg('to-age','100')));
const policy=arg('policy','random');
const seedPrefix=arg('seed-prefix','ci-audit');
const out=arg('out','artifacts/life-tree-1000-lives');
mkdirSync(out,{recursive:true});

const rows=[['index','seed','age','alive','deathCause','sex','birthCity','finalCity','health','fitness','conditions','career','retired','partners','children','cash','savings','debt','netWorth','lifetimeSpending'].map(csv).join(',')];
const telemetry={
 config:{lives,toAge,policy,seedPrefix},
 valid:0,invalid:0,
 spendingByCategory:{},
 lifetimeSpending:[],
 durablePurchases:{},
 durableReplacements:{},
 finalDurableOwnership:{},
 errors:[]
};

for(let i=0;i<lives;i++){
 const game=new Game(seedPrefix+'-'+policy+'-'+i);
 try{
  autoplay(game,{toAge,policy});
  const violations=validateState(game.state);
  if(violations.length)throw new Error(violations.join('; '));
  const index=i+1;
  const info=lifeMarkdown(game,index);
  const filename='life-'+String(index).padStart(4,'0')+'.md';
  writeFileSync(join(out,filename),info.markdown,'utf8');
  telemetry.valid++;
  telemetry.lifetimeSpending.push(info.spending.total);
  for(const [category,amount] of Object.entries(info.spending.byCategory))inc(telemetry.spendingByCategory,category,amount);
  for(const entry of game.state.finance?.spendingHistory??[]){
   if(entry.source!=='durable-goods')continue;
   const id=entry.metadata?.itemId??'unknown';
   inc(telemetry.durablePurchases,id);
   if(entry.metadata?.replacement)inc(telemetry.durableReplacements,id);
  }
  for(const id of Object.keys(game.state.finance?.durableGoods??{}))inc(telemetry.finalDurableOwnership,id);
  const s=game.state,f=s.finance??{};
  const cash=f.cash??0,savings=f.savings??0,debt=f.debt??0;
  const netWorth=cash+savings+(s.assets?.home?.price??0)+(s.assets?.car?.price??0)-debt;
  rows.push([
   index,game.seedText,s.player.age,s.player.alive,s.death?.cause??'',s.player.sex??'',
   s.origin?.cityName??'',s.location?.cityName??s.origin?.cityName??'',
   Number(s.player.health?.current??0).toFixed(1),Number(s.healthProfile?.fitness??0).toFixed(1),
   (s.healthProfile?.conditions??[]).length,s.career?.title??'',Boolean(s.retirement?.retired),
   info.partners.length,info.children.length,cash,savings,debt,netWorth,info.spending.total
  ].map(csv).join(','));
 }catch(error){
  telemetry.invalid++;
  telemetry.errors.push({seed:game.seedText,error:error.message});
 }
}

const sorted=[...telemetry.lifetimeSpending].sort((a,b)=>a-b);
const q=p=>{
 if(!sorted.length)return 0;
 const pos=(sorted.length-1)*p,base=Math.floor(pos),rest=pos-base;
 return Math.round(sorted[base]+(sorted[base+1]!=null?rest*(sorted[base+1]-sorted[base]):0));
};
telemetry.lifetimeSpendingSummary={
 min:sorted[0]??0,p10:q(.1),p25:q(.25),median:q(.5),p75:q(.75),p90:q(.9),max:sorted.at(-1)??0,
 mean:sorted.length?Math.round(sorted.reduce((a,b)=>a+b,0)/sorted.length):0
};
telemetry.spendingByCategoryPerLife=Object.fromEntries(
 Object.entries(telemetry.spendingByCategory).map(([k,v])=>[k,Math.round(v/Math.max(1,telemetry.valid))])
);

writeFileSync(join(out,'index.csv'),rows.join('\n'),'utf8');
writeFileSync(join(out,'spending-telemetry.json'),JSON.stringify(telemetry,null,2),'utf8');
writeFileSync(join(out,'README.md'),[
 '# Life Tree — 1000 Life Inspection Pack',
 '',
 'Bu paket '+telemetry.valid+' geçerli yaşam içerir.',
 '',
 '- Her `life-XXXX.md` dosyası tek bir karakterin final durumunu ve kronolojik yaşam çizelgesini içerir.',
 '- `index.csv` tüm karakterleri tek tabloda karşılaştırmak içindir.',
 '- `spending-telemetry.json` harcama kategorilerini ve dayanıklı tüketim telemetrisini içerir.',
 '- Seed seti: `'+seedPrefix+'` / policy: `'+policy+'` / hedef yaş: '+toAge+'.',
 ''
].join('\n'),'utf8');

console.log(JSON.stringify({
 out,valid:telemetry.valid,invalid:telemetry.invalid,
 lifetimeSpending:telemetry.lifetimeSpendingSummary,
 spendingByCategoryPerLife:telemetry.spendingByCategoryPerLife,
 durablePurchases:telemetry.durablePurchases,
 durableReplacements:telemetry.durableReplacements
},null,2));
if(telemetry.invalid>0)process.exitCode=1;
