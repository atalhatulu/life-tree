import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {readFile,writeFile} from 'node:fs/promises';
import {Game} from '../core/game.js';
import {refreshPrimaryStats} from '../life/primary_stats.js';
import {RNG} from '../core/rng.js';
import {serializeGame} from '../core/save_system.js';
import {assertValidState} from '../simulation/invariants.js';
import {setLifestyle,lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {
  affordableCarOptions,affordableHomeOptions,buyCar,buyHome,sellCar,sellHome,moveHousing
} from '../assets/asset_system.js';
import {generateJobOffers} from '../career/job_market.js';
import {switchJob} from '../career/career_system.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const money=(v=0)=>'₺'+Math.round(v).toLocaleString('tr-TR');
const rl=createInterface({input,output});

function arg(name,fallback=null){
 const i=process.argv.indexOf('--'+name);
 return i>=0&&process.argv[i+1]!=null?process.argv[i+1]:fallback;
}
function clear(){process.stdout.write('\x1Bc');}
function line(){console.log('─'.repeat(64));}
async function ask(text){return (await rl.question(text)).trim();}
async function choose(title,items,{allowBack=true}={}){
 console.log('\n'+title);
 items.forEach((x,i)=>console.log('  '+(i+1)+') '+x.label));
 if(allowBack)console.log('  0) Geri');
 while(true){
  const raw=await ask('> ');
  const n=Number(raw);
  if(allowBack&&n===0)return null;
  if(Number.isInteger(n)&&n>=1&&n<=items.length)return items[n-1];
 }
}
function netWorth(s){
 const f=s.finance??{};
 return (f.cash??0)+(f.savings??0)+(s.assets?.home?.price??0)+(s.assets?.car?.price??0)-(f.debt??0);
}
function health(s){return Math.round(s.player.health?.current??70);}
function stress(s){return Math.round(s.healthProfile?.stress??0);}
function mental(s){return Math.round(s.mentalHealth?.strain??0);}
function chapter(age){
 if(age<7)return 'Erken çocukluk';
 if(age<13)return 'Çocukluk';
 if(age<18)return 'Ergenlik';
 if(age<25)return 'Genç yetişkinlik';
 if(age<40)return 'Yetişkinlik';
 if(age<60)return 'Orta yaş';
 if(age<75)return 'Geç yetişkinlik';
 return 'İleri yaş';
}
function printHeader(game){
 const s=game.state,f=s.finance??{},r=s.social?.romance;
 clear();
 console.log('LIFE TREE — TEXT MODE');
 line();
 console.log((s.player.name+' '+s.player.surname).toUpperCase());
 console.log(s.player.age+' yaş • '+s.year+' • '+chapter(s.player.age)+' • '+s.household.economicClass+' sınıf');
 const stats=refreshPrimaryStats(s);
 console.log('Sağlık '+Math.round(stats.health)+'/100  |  Zekâ '+Math.round(stats.intelligence)+'/100  |  Görünüm '+Math.round(stats.appearance)+'/100  |  Mutluluk '+Math.round(stats.happiness)+'/100');
 console.log('Para '+money((f.cash??0)+(f.savings??0))+'  |  Borç '+money(f.debt??0)+'  |  Net '+money(netWorth(s)));
 console.log('İş: '+(s.career?.title??s.player.job??'—')+'  |  Aile: '+(r?.status==='married'?'Evli':r?'İlişki':'Bekâr')+' • '+(s.children?.length??0)+' çocuk');
 console.log('Bu yıl kalan aksiyon: '+(s.actions?.remaining??0)+'/'+(s.actions?.max??3));
 const pressures=[];
 if((s.career?.workplace?.burnout??0)>=60)pressures.push('Tükenmişlik '+Math.round(s.career.workplace.burnout));
 if((s.householdDynamics?.financialPressure??0)>=55)pressures.push('Finansal baskı '+Math.round(s.householdDynamics.financialPressure));
 if((s.social?.romance?.resentment??0)>=55)pressures.push('İlişki kırgınlığı '+Math.round(s.social.romance.resentment));
 if(stress(s)>=65)pressures.push('Stres '+stress(s));
 const chains=(s.consequenceChains??[]).filter(x=>!x.resolved).length;
 if(chains)pressures.push(chains+' devam eden etki');
 if(pressures.length)console.log('Baskılar: '+pressures.join(' • '));
 line();
}
function printRecentHistory(game,count=8){
 const rows=(game.state.history??[]).filter(x=>x.result||x.text).slice(-count);
 if(!rows.length)return;
 console.log('\nSon gelişmeler:');
 for(const x of rows)console.log('  • '+x.age+' yaş — '+(x.result??x.text));
}
async function resolveEvent(game,event){
 const choices=game.eventChoices(event);
 if(!choices.length)return;
 console.log('\n◆ '+event.title);
 console.log(event.majorDecision?'Bu seçim Life Tree üzerinde bir dönüm noktası olabilir.':'Bu yıl bir karar vermen gerekiyor.');
 const selected=await choose('Seçimin:',choices.map(c=>({label:c.label,value:c})),{allowBack:false});
 const result=game.makeChoice(event,selected.value.id);
 console.log('\n→ '+result);
 await ask('\nDevam etmek için Enter...');
}
function makeYearMoment(game){
 const s=game.state,age=s.player.age,rng=new RNG(game.seedText+':text-year-moment:'+s.year);
 if(age<3)return {title:'Aileyle bir gün',text:'Bakımını üstlenen kişilerle zaman geçiriyorsun.',choices:[['family','Ailenle vakit geçir'],['play','Oyuncaklarınla oyna'],['rest','Dinlen']]};
 if(age<7)return rng.pick([
  {title:'Küçük bir keşif',text:'Bugün seni ne çekiyor?',choices:[['play','Oyun kur'],['family','Ailenle vakit geçir'],['learn','Yeni bir şey öğren']]},
  {title:'Evde bir gün',text:'Kendi kendine oyalanıyorsun.',choices:[['draw','Resim yap'],['help-home','Ev işine yardım et'],['rest','Dinlen']]}
 ]);
 if(age<13)return rng.pick([
  {title:'Okuldan sonra',text:'Günün geri kalanını nasıl geçireceksin?',choices:[['friends','Arkadaşlarla oyna'],['study','Ödevlerini bitir'],['game-spend','Oyuna/oyuncağa harca']]},
  {title:'Harçlık kararı',text:'Cebinde biraz harçlık var.',choices:[['child-save','Biriktir'],['snack','Atıştırmalık al'],['book','Kitap/dergi al']]},
  {title:'Hafta sonu',text:'Ailen sana seçim bıraktı.',choices:[['family','Ailece dışarı çık'],['learn','Bir hobiyle uğraş'],['rest','Evde kal']]}
 ]);
 if(age<18)return rng.pick([
  {title:'Okul ve sosyal hayat',text:'Bu hafta neye ağırlık vereceksin?',choices:[['friends','Arkadaşlarla takıl'],['study','Derse ağırlık ver'],['club','Kulüp/hobiye katıl']]},
  {title:'Harçlık kararı',text:'Küçük ama senin olan bir paran var.',choices:[['child-save','Biriktir'],['meal-small','Arkadaşlarla bir şeyler ye'],['clothes-small','Kendine bir şey al']]},
  {title:'Kendine yatırım',text:'Boş vaktini nasıl kullanacaksın?',choices:[['exercise','Spor yap'],['learn','Yeni beceri öğren'],['social','Sosyalleş']]}
 ]);
 const pool=[
  {title:'Hafta sonu planı',text:'Kendine biraz zaman ayıracaksın.',choices:[['cinema','Sinemaya git'],['rest','Evde dinlen'],['social','Birini ara']]},
  ...((s.finance?.cash??0)>=350?[{title:'Küçük bir para kararı',text:'Bu ay elinde biraz harcanabilir para var.',choices:[['adult-save','Biriktir'],['shopping','Kendine bir şey al'],['meal','Dışarıda yemek ye']]}]:[]),
  {title:'Yoğun bir dönem',text:'Enerjini nereye vereceksin?',choices:[...(s.career?.employed?[['work-focus','İşe yüklen']]:[['learn','İş fırsatları için kendini geliştir']]),['exercise','Spora dön'],['rest','Dinlen']]},
  {title:'Sosyal çevre',text:'Bir süredir insanlarla görüşmedin.',choices:[['social','Birini ara'],['family','Aileyi ziyaret et'],['solo','Tek başına kal']]},
  {title:'Kendine yatırım',text:'Biraz zaman ve enerji ayırabilirsin.',choices:[['learn','Yeni beceri öğren'],['exercise','Sağlığına odaklan'],['shopping','Görünüşünü yenile']]}
 ];
 if(s.social?.romance)pool.push({title:'İlişkiye zaman ayır',text:'Partnerinle baş başa kalmak için fırsat var.',choices:[['partner-time','Birlikte vakit geçir'],['social','Uzun konuş'],...(s.career?.employed?[['work-focus','Bu hafta işe odaklan']]:[['learn','Kendini geliştir']])]});
 if((s.children?.length??0)>0)pool.push({title:'Aile zamanı',text:'Evde senden ilgi bekleyenler var.',choices:[['child-time','Çocuklarla ilgilen'],['family','Ailece bir şey yap'],['rest','Biraz yalnız kal']]});
 return rng.pick(pool);
}
function spendChild(s,amount){
 s.childMoney??={wallet:0,saved:0,totalAllowance:0,totalSpent:0,lastAllowanceAge:null};
 if((s.childMoney.wallet??0)<amount)return false;
 s.childMoney.wallet-=amount;s.childMoney.totalSpent=(s.childMoney.totalSpent??0)+amount;return true;
}
async function leisure(game,kind){
 const defs={cinema:{label:'Sinemaya git',costs:[250,550,1100]},meal:{label:'Dışarıda yemek ye',costs:[350,850,1800]},shopping:{label:'Alışveriş yap',costs:[500,1500,4000]}};
 const d=defs[kind],s=game.state;
 const companions=[{id:'alone',label:'Yalnız',type:'alone'}];
 for(const f of s.social?.friends??[])companions.push({id:'friend:'+f.id,label:f.name+' (arkadaş)',type:'friend',person:f});
 if(s.social?.romance)companions.push({id:'partner',label:s.social.romance.name+' (partner)',type:'partner',person:s.social.romance});
 (s.children??[]).forEach((c,i)=>companions.push({id:'child:'+i,label:c.name+' (çocuk)',type:'child',person:c}));
 const companion=await choose('Kiminle?',companions.map(x=>({label:x.label,value:x})));
 if(!companion)return false;
 const tier=await choose('Bütçe',d.costs.map((cost,i)=>({label:['Ekonomik','Standart','Premium'][i]+' • '+money(cost),value:{i,cost}})));
 if(!tier)return false;
 const cost=tier.value.cost;
 if((s.finance?.cash??0)<cost){console.log('Yeterli nakdin yok.');return false;}
 if((s.actions?.remaining??0)<=0){console.log('Aksiyon hakkın kalmadı.');return false;}
 s.finance.cash-=cost;s.finance.activitySpendingAnnual=(s.finance.activitySpendingAnnual??0)+cost;s.actions.remaining--;
 const x=companion.value;
 if(x.type==='partner'){x.person.relationship=clamp((x.person.relationship??60)+3+tier.value.i*2);x.person.relationshipTension=clamp((x.person.relationshipTension??10)-2-tier.value.i);x.person.lastQualityTimeAge=s.player.age;}
 if(x.type==='friend'){x.person.relationship=clamp((x.person.relationship??55)+3+tier.value.i*2);x.person.lastContactAge=s.player.age;}
 if(x.type==='child')x.person.relationship=clamp((x.person.relationship??70)+4+tier.value.i);
 s.healthProfile.stress=clamp((s.healthProfile.stress??20)-(2+tier.value.i));
 if(kind==='shopping')s.player.appearance.attractiveness=clamp((s.player.appearance.attractiveness??50)+tier.value.i);
 const text=d.label+' • '+x.label+' • '+money(cost)+' harcadın.';
 s.history.push({age:s.player.age,kind:'activity',activityId:'leisure:'+kind,text});
 refreshPrimaryStats(s);
 console.log('→ '+text);
 return true;
}
async function resolveYearMoment(game){
 const m=makeYearMoment(game),s=game.state;
 if(!m)return;
 console.log('\n◇ '+m.title+'\n'+m.text);
 const pick=await choose('Ne yapacaksın?',m.choices.map(([id,label])=>({label,value:id})),{allowBack:false});
 const choice=pick.value;let text='';
 s.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 s.childMoney??={wallet:0,saved:0,totalAllowance:0,totalSpent:0,lastAllowanceAge:null};
 if(['play','draw','rest','solo'].includes(choice)){s.healthProfile.stress=clamp(s.healthProfile.stress-3);if(choice==='draw')s.player.personality.curiosity=clamp((s.player.personality.curiosity??50)+1);text='Kendine sakin bir alan açtın.';}
 if(['family','help-home'].includes(choice)){s.player.personality.sociability=clamp((s.player.personality.sociability??50)+1);text='Ailene zaman ayırdın.';}
 if(['learn','study','club'].includes(choice)){s.player.personality.discipline=clamp((s.player.personality.discipline??50)+1);if(s.education&&choice==='study')s.education.studyEffort=(s.education.studyEffort??0)+12;text='Kendini geliştirmeye zaman ayırdın.';}
 if(['friends','social'].includes(choice)){s.player.personality.sociability=clamp((s.player.personality.sociability??50)+1);s.healthProfile.stress=clamp(s.healthProfile.stress-2);text='Sosyal bağlarına vakit ayırdın.';}
 if(choice==='exercise'){s.healthProfile.fitness=clamp((s.healthProfile.fitness??50)+3);s.healthProfile.stress=clamp(s.healthProfile.stress-2);text='Sağlığına zaman ayırdın.';}
 if(choice==='work-focus'){if(s.career?.employed)s.career.performance=clamp((s.career.performance??50)+3);s.healthProfile.stress=clamp(s.healthProfile.stress+2);text='İşine ekstra enerji ayırdın.';}
 if(choice==='child-save'){const moved=Math.round((s.childMoney.wallet??0)*.6);s.childMoney.wallet-=moved;s.childMoney.saved+=moved;text=moved?money(moved)+' biriktirdin.':'Cebinde biriktirecek para yoktu.';}
 const childCosts={snack:120,book:280,'game-spend':450,'meal-small':300,'clothes-small':650};
 if(childCosts[choice])text=spendChild(s,childCosts[choice])?money(childCosts[choice])+' harcadın.':'Harçlığın yetmedi.';
 if(choice==='adult-save'&&s.finance){const moved=Math.min(s.finance.cash??0,Math.max(500,Math.round((s.finance.monthlyIncome??0)*.08)));s.finance.cash-=moved;s.finance.savings=(s.finance.savings??0)+moved;text=money(moved)+' birikime ayırdın.';}
 if(choice==='partner-time'&&s.social?.romance){const r=s.social.romance;r.relationship=clamp((r.relationship??60)+5);r.relationshipTension=clamp((r.relationshipTension??10)-4);r.lastQualityTimeAge=s.player.age;text='Partnerinle kaliteli zaman geçirdin.';}
 if(choice==='child-time'&&(s.children?.length??0)){for(const c of s.children){c.relationship=clamp((c.relationship??70)+3);if(c.parenting)c.parenting.involvement=clamp((c.parenting.involvement??55)+3);}text='Çocuklarına özellikle zaman ayırdın.';}
 if(['cinema','meal','shopping'].includes(choice)){
  const completed=await leisure(game,choice);
  text=completed?'Planladığın aktiviteyi gerçekleştirdin.':'Aktivite tamamlanmadı; harcama veya etkinlik gerçekleşmedi.';
 }
 if(!text)text='Bu yıl küçük ama sana ait bir seçim yaptın.';
 refreshPrimaryStats(s);
 s.history.push({age:s.player.age,kind:'year-moment',choiceId:choice,text});
 console.log('→ '+text);
 await ask('\nDevam etmek için Enter...');
}
async function activitiesMenu(game){
 while(true){
  printHeader(game);
  const activities=game.availableActivities();
  console.log('\nAKTİVİTELER');
  if((game.state.actions?.remaining??0)<=0){console.log('Bu yıl aksiyon hakkın kalmadı.');await ask('\nEnter...');return;}
  const items=[
   {label:'Sinemaya git',value:'leisure:cinema'},
   {label:'Dışarıda yemek ye',value:'leisure:meal'},
   {label:'Alışveriş yap',value:'leisure:shopping'},
   ...activities.map(a=>({label:a.label,value:'activity:'+a.id}))
  ];
  const p=await choose('Bir aktivite seç:',items);
  if(!p)return;
  if(p.value.startsWith('leisure:'))await leisure(game,p.value.split(':')[1]);
  else{
   try{console.log('→ '+game.performActivity(p.value.slice(9)));}
   catch(e){console.log('! '+e.message);}
   await ask('\nEnter...');
  }
 }
}
function personTargets(s){
 const out=[];
 if(s.social?.romance)out.push({key:'partner',type:'partner',label:s.social.romance.name+' (partner)',person:s.social.romance});
 (s.children??[]).forEach((c,i)=>out.push({key:'child:'+i,type:'child',label:c.name+' ('+c.age+' yaş)',person:c}));
 for(const f of s.social?.friends??[])out.push({key:'friend:'+f.id,type:'friend',label:f.name+' '+(f.surname??'')+' (arkadaş)',person:f});
 if(s.parents?.mother?.alive)out.push({key:'mother',type:'family',label:'Anne — '+s.parents.mother.name,person:s.parents.mother});
 if(s.parents?.father?.alive)out.push({key:'father',type:'family',label:'Baba — '+s.parents.father.name,person:s.parents.father});
 return out;
}
function relActions(t){
 if(t.type==='partner')return [{id:'talk',label:'Uzun konuş',cost:0,rel:4,stress:-2},{id:'date',label:'Birlikte dışarı çık',cost:900,rel:6,stress:-3},{id:'gift',label:'Hediye al',cost:1800,rel:7,stress:0},{id:'trip',label:'Kısa kaçamak yap',cost:6500,rel:10,stress:-6}];
 if(t.type==='child')return [{id:'time',label:'Birlikte vakit geçir',cost:0,rel:6,stress:-2},{id:'homework',label:'Derslerine yardım et',cost:0,rel:4,stress:1},{id:'allowance',label:'Harçlık ver',cost:(t.person.age??0)>=13?1000:500,rel:4,stress:0},{id:'course',label:'Kursa yazdır',cost:3500,rel:5,stress:0}].filter(a=>a.id!=='course'||(t.person.age??0)<18);
 if(t.type==='friend')return [{id:'call',label:'Ara ve sohbet et',cost:0,rel:4,stress:-2},{id:'meet',label:'Buluş',cost:650,rel:6,stress:-3},{id:'gift',label:'Küçük hediye al',cost:1200,rel:5,stress:0}];
 return [{id:'call',label:'Ara ve konuş',cost:0,rel:4,stress:-2},{id:'visit',label:'Ziyaret et',cost:350,rel:6,stress:-3},{id:'help',label:'Bir işine yardım et',cost:0,rel:7,stress:1}];
}
function relationValue(s,t){return t.type==='family'?(s.player.relationships?.[t.person.id]??t.person.relationship??60):(t.person.relationship??60);}
async function relationshipsMenu(game){
 while(true){
  printHeader(game);const s=game.state;
  console.log('\nİLİŞKİLER');
  const targets=personTargets(s);
  if(!targets.length){console.log('Yakın etkileşim hedefi yok.');await ask('\nEnter...');return;}
  const selected=await choose('Kişi seç:',targets.map(t=>({label:t.label+' • ilişki '+Math.round(relationValue(s,t))+'/100',value:t})));
  if(!selected)return;
  const t=selected.value;
  console.log('\n'+t.label);
  if(t.type==='partner')console.log('Güven '+Math.round(t.person.trust??0)+' • Yakınlık '+Math.round(t.person.intimacy??0)+' • Kırgınlık '+Math.round(t.person.resentment??0));
  if(t.type==='child'&&t.person.development)console.log('Özgüven '+Math.round(t.person.development.confidence)+' • Bağımsızlık '+Math.round(t.person.development.independence)+' • Akademik '+Math.round(t.person.development.academicDrive));
  if(t.person.life)console.log('Kendi hayatı: '+(t.person.job??t.person.life.relationshipStatus??'—')+' • yaşam memnuniyeti '+Math.round(t.person.life.lifeSatisfaction??0));
  const action=await choose('Etkileşim:',relActions(t).map(a=>({label:a.label+(a.cost?' • '+money(a.cost):' • ücretsiz'),value:a})));
  if(!action)continue;
  const a=action.value;
  if((s.actions?.remaining??0)<=0){console.log('Aksiyon hakkın kalmadı.');await ask('\nEnter...');continue;}
  if(a.cost&&(s.finance?.cash??0)<a.cost){console.log('Yeterli nakdin yok.');await ask('\nEnter...');continue;}
  if(a.cost){s.finance.cash-=a.cost;s.finance.activitySpendingAnnual=(s.finance.activitySpendingAnnual??0)+a.cost;}
  if(t.type==='family'){s.player.relationships??={};s.player.relationships[t.person.id]=clamp(relationValue(s,t)+a.rel);}
  else t.person.relationship=clamp((t.person.relationship??60)+a.rel);
  s.healthProfile.stress=clamp((s.healthProfile?.stress??20)+a.stress);
  if(t.type==='partner'){t.person.relationshipTension=clamp((t.person.relationshipTension??10)-(a.id==='talk'?5:a.id==='trip'?6:3));if(['date','trip'].includes(a.id))t.person.lastQualityTimeAge=s.player.age;}
  if(t.type==='child'){t.person.parenting??={involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0};t.person.parenting.involvement=clamp(t.person.parenting.involvement+(a.id==='time'?5:3));if(a.id==='homework')t.person.personality.discipline=clamp((t.person.personality?.discipline??50)+2);if(a.id==='course')t.person.personality.curiosity=clamp((t.person.personality?.curiosity??50)+3);}
  if(t.type==='friend')t.person.lastContactAge=s.player.age;
  s.actions.remaining--;
  const text=t.label+' ile '+a.label.toLocaleLowerCase('tr-TR')+'.'+(a.cost?' '+money(a.cost)+' harcadın.':'');
  s.history.push({age:s.player.age,kind:'relationship-action',personId:t.person.id,actionId:a.id,text});
  console.log('→ '+text);await ask('\nEnter...');
 }
}
async function careerMenu(game){
 while(true){
  printHeader(game);const s=game.state,c=s.career;
  console.log('\nKARİYER');
  if(!c?.employed){console.log('Aktif iş: yok');await ask('\nEnter...');return;}
  console.log(c.title+' • '+(c.levelTitle??'—')+' • '+(c.sector??'—')+' • '+money(c.monthlyIncome)+'/ay');
  console.log('Performans '+Math.round(c.performance??0)+' • Memnuniyet '+Math.round(c.satisfaction??0)+' • Network '+Math.round(c.network??0));
  if(c.workplace)console.log('Patron '+Math.round(c.workplace.bossQuality)+' • Ekip '+Math.round(c.workplace.teamCohesion)+' • İş yükü '+Math.round(c.workplace.workload)+' • Burnout '+Math.round(c.workplace.burnout));
  const p=await choose('Ne yapmak istiyorsun?',[
   {label:'Network yap',value:'network'},
   {label:'Zam iste',value:'raise'},
   {label:'İş fırsatlarına bak',value:'offers'}
  ]);
  if(!p)return;
  if(p.value==='network'){
   if(s.actions.remaining<=0){console.log('Aksiyon hakkın yok.');await ask('\nEnter...');continue;}
   s.actions.remaining--;c.network=clamp((c.network??50)+6);c.performance=clamp((c.performance??50)+1);s.healthProfile.stress=clamp((s.healthProfile?.stress??20)+1);
   console.log('→ Profesyonel çevreni genişlettin.');
  }
  if(p.value==='raise'){
   if(s.actions.remaining<=0){console.log('Aksiyon hakkın yok.');await ask('\nEnter...');continue;}
   s.actions.remaining--;const rng=new RNG(game.seedText+':text-raise:'+s.year);const chance=clamp(28+(c.performance??50)*.45+(c.network??50)*.2+(c.companyFit??50)*.12,10,88);
   if(rng.int(1,100)<=chance){const pct=rng.int(5,12);c.monthlyIncome=Math.round(c.monthlyIncome*(1+pct/100));s.player.monthlyIncome=c.monthlyIncome;console.log('→ Zam kabul edildi: %'+pct);}
   else console.log('→ Zam talebin kabul edilmedi.');
  }
  if(p.value==='offers'){
   s.pendingCareerOffers=generateJobOffers(s,new RNG(game.seedText+':text-offers:'+s.year),3,{mode:'career-switch'});
   if(!s.pendingCareerOffers.length)console.log('Uygun teklif çıkmadı.');
   else{
    const off=await choose('Teklifler:',s.pendingCareerOffers.map(o=>({label:o.title+' • '+money(o.salary)+'/ay • '+o.cityName+' • '+o.sector,value:o})));
    if(off){
     if(s.actions.remaining<=0)console.log('Aksiyon hakkın yok.');
     else{s.actions.remaining--;const r=switchJob(s,off.value);console.log('→ '+r.job.title+' olarak yeni işe başladın.');}
    }
   }
  }
  await ask('\nEnter...');
 }
}
async function assetsMenu(game){
 while(true){
  printHeader(game);const s=game.state,f=s.finance??{},a=s.assets??{};
  console.log('\nVARLIKLAR & YAŞAM');
  console.log('Nakit '+money(f.cash)+' • Birikim '+money(f.savings)+' • Borç '+money(f.debt)+' • Net '+money(netWorth(s)));
  console.log('Ev: '+(a.home?.label??'Yok')+' • Araç: '+(a.car?.label??'Yok'));
  console.log('Yaşam gideri: '+money(lifestyleMonthlyCost(s))+'/ay');
  if(s.player.age<18)console.log('Harçlık cüzdanı '+money(s.childMoney?.wallet??0)+' • Birikim '+money(s.childMoney?.saved??0));
  const p=await choose('İşlem:',[
   {label:'Yaşam tarzı değiştir',value:'lifestyle'},
   {label:'Konut düzenini değiştir',value:'housing'},
   {label:a.car?'Arabayı sat':'Araba satın al',value:'car'},
   {label:a.home?'Evi sat':'Ev satın al',value:'home'}
  ]);
  if(!p)return;
  try{
   if(p.value==='lifestyle'){
    const food=await choose('Yemek',[['frugal','Ucuz/düzensiz'],['standard','Standart'],['healthy','Sağlıklı'],['premium','Premium']].map(([value,label])=>({label,value})));if(!food)continue;
    const clothing=await choose('Kıyafet',[['basic','Temel'],['standard','Özenli'],['premium','Marka/premium']].map(([value,label])=>({label,value})));if(!clothing)continue;
    const transport=await choose('Ulaşım',[['public','Toplu taşıma'],['car','Araba ağırlıklı']].map(([value,label])=>({label,value})));if(!transport)continue;
    setLifestyle(s,{food:food.value,clothing:clothing.value,transport:transport.value});console.log('→ Yaşam tarzı güncellendi.');
   }
   if(p.value==='housing'){
    if(a.home){console.log('Sahip olduğun ev varken doğrudan kiralık düzene geçemezsin.');}
    else{
     const h=await choose('Konut',[['family','Aile evi'],['shared','Paylaşımlı ev'],['studio','Stüdyo'],['apartment','Daire']].map(([value,label])=>({label,value})));
     if(h){const r=moveHousing(s,h.value);console.log('→ Taşındın. Masraf '+money(r.cost));}
    }
   }
   if(p.value==='car'){
    if(a.car){const r=sellCar(s);console.log('→ Arabayı sattın. Net '+money(r.net));}
    else{
     const opts=affordableCarOptions(s);
     if(!opts.length)console.log('Karşılayabileceğin araç yok.');
     else{const x=await choose('Araçlar:',opts.map(o=>({label:o.label+' • '+money(o.price),value:o})));if(x){buyCar(s,x.value.id);console.log('→ '+x.value.label+' satın aldın.');}}
    }
   }
   if(p.value==='home'){
    if(a.home){const r=sellHome(s);console.log('→ Evi sattın. Net '+money(r.net));}
    else{
     const opts=affordableHomeOptions(s);
     if(!opts.length)console.log('Karşılayabileceğin ev yok.');
     else{const x=await choose('Evler:',opts.map(o=>({label:o.label+' • '+money(o.price),value:o})));if(x){buyHome(s,x.value.id);console.log('→ '+x.value.label+' satın aldın.');}}
    }
   }
  }catch(e){console.log('! '+e.message);}
  await ask('\nEnter...');
 }
}
async function treeMenu(game){
 printHeader(game);const s=game.state;
 console.log('\nLIFE TREE');
 const nodes=s.lifeTree?.nodes??[];
 if(!nodes.length)console.log('Henüz büyük bir dönüm noktası yok.');
 else nodes.forEach((n,i)=>console.log('  '+(i+1)+'. '+n.age+' yaş — '+n.title+' → '+n.label));
 const mem=s.lifeMemory;
 if(mem){
  console.log('\nHayat İzleri: dayanıklılık '+Math.round(mem.resilience??50)+'/100 • yük '+Math.round(mem.scarLoad??0)+'/100');
  for(const m of (mem.memories??[]).slice(-8))console.log('  • '+m.age+' yaş — '+m.label);
 }
 const chains=(s.consequenceChains??[]).filter(x=>!x.resolved);
 if(chains.length){
  console.log('\nDevam eden etkiler:');
  for(const x of chains)console.log('  • '+x.type+' • '+x.step+'. yıl');
 }
 await ask('\nEnter...');
}
async function timelineMenu(game){
 printHeader(game);
 console.log('\nHAYAT HİKÂYESİ');
 let last=null;
 const rows=(game.state.history??[]).filter(x=>x.result||x.text).sort((a,b)=>a.age-b.age);
 for(const x of rows){
  const ch=chapter(x.age);
  if(ch!==last){console.log('\n['+ch.toUpperCase()+']');last=ch;}
  console.log('  '+String(x.age).padStart(2,' ')+' • '+(x.result??x.text));
 }
 await ask('\nEnter...');
}
async function ageOneYear(game){
 const before=game.state.history.length;
 const event=game.ageOneYear();
 const newRows=game.state.history.slice(before).filter(x=>x.result||x.text);
 printHeader(game);
 if(newRows.length){
  console.log('\nBU YIL');
  for(const x of newRows)console.log('  • '+(x.result??x.text));
 }
 if(!game.state.player.alive)return;
 if(event)await resolveEvent(game,event);
 else await resolveYearMoment(game);
 assertValidState(game.state);
}
function deathSummary(game){
 const s=game.state,d=s.deathSummary??s.death??{};
 clear();console.log('LIFE TREE — HAYAT SONA ERDİ');line();
 console.log(s.player.name+' '+s.player.surname+' • '+s.player.age+' yaş');
 console.log('Neden: '+(d.cause??'Bilinmeyen'));
 console.log('Kariyer: '+(s.career?.title??s.player.job??'—'));
 console.log('Çocuk: '+(s.children?.length??0)+' • Torun: '+(s.grandchildren??0));
 console.log('Net değer: '+money(netWorth(s)));
 console.log('Life Tree kararları: '+(s.lifeTree?.nodes?.length??0));
 line();
}
const loadPath=arg('load',null);
const savePath=arg('save','life-tree-save.json');
let game;
if(loadPath){game=Game.fromSave(await readFile(loadPath,'utf8'));}
else{
 const seed=(await ask('Seed (boş = rastgele): '))||String(Date.now());
 game=new Game(seed);
}
while(game.state.player.alive){
 printHeader(game);printRecentHistory(game,5);
 console.log('\nANA MENÜ');
 console.log('  1) +1 YAŞ');
 console.log('  2) İlişkiler');
 console.log('  3) Aktiviteler');
 console.log('  4) Kariyer');
 console.log('  5) Varlıklar & Yaşam');
 console.log('  6) Life Tree');
 console.log('  7) Hayat Hikâyesi');
 console.log('  8) Kaydet');
 console.log('  q) Çık');
 const p=(await ask('> ')).toLowerCase();
 if(p==='1')await ageOneYear(game);
 else if(p==='2')await relationshipsMenu(game);
 else if(p==='3')await activitiesMenu(game);
 else if(p==='4')await careerMenu(game);
 else if(p==='5')await assetsMenu(game);
 else if(p==='6')await treeMenu(game);
 else if(p==='7')await timelineMenu(game);
 else if(p==='8'){await writeFile(savePath,serializeGame(game),'utf8');console.log('Kaydedildi: '+savePath);await ask('\nEnter...');}
 else if(p==='q')break;
}
if(!game.state.player.alive){deathSummary(game);await ask('\nEnter...');}
await writeFile(savePath,serializeGame(game),'utf8');
await rl.close();
