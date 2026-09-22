import { Game } from '../core/game.js';
import { autoplay, humanLikeChoice, activityOrder } from '../simulation/autoplay.js';
import { RNG } from '../core/rng.js';
import { setLifestyle, lifestyleMonthlyCost } from '../lifestyle/lifestyle_system.js';

let game;
let pendingEvent = null;
let activityMessage = '';
let autoLifeRunning = false;
let autoLifeToken = 0;
let autoLifeRng = null;
let yearMoment = null;
let leisurePicker = null;
const sleep = (ms) => new Promise(resolve=>setTimeout(resolve,ms));

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function getHealth(player) { return clamp(Math.round(player.health?.current ?? 70)); }
function getStress() { return clamp(Math.round(game.state.healthProfile?.stress ?? 0)); }
function getMental() { return clamp(Math.round(game.state.mentalHealth?.strain ?? 0)); }
function money(value=0){ return '₺'+Math.round(value).toLocaleString('tr-TR'); }
function netWorth(){
  const f=game.state.finance??{};
  return (f.cash??0)+(f.savings??0)+(game.state.assets?.home?.price??0)+(game.state.assets?.car?.price??0)-(f.debt??0);
}


function spendCash(amount){
  const f=game.state.finance;
  if(!f)return false;
  const cost=Math.max(0,Math.round(amount));
  if((f.cash??0)<cost)return false;
  f.cash-=cost;
  f.activitySpendingAnnual=(f.activitySpendingAnnual??0)+cost;
  return true;
}
function livingCompanions(){
  const out=[{id:'alone',label:'Yalnız',type:'alone'}];
  for(const f of game.state.social?.friends??[]) out.push({id:'friend:'+f.id,label:f.name+' (arkadaş)',type:'friend',person:f});
  const r=game.state.social?.romance;
  if(r)out.push({id:'partner',label:(r.name??'Partner')+' (partner)',type:'partner',person:r});
  for(const [i,c] of (game.state.children??[]).entries())out.push({id:'child:'+i,label:(c.name??('Çocuk '+(i+1))),type:'child',person:c});
  return out;
}
const LEISURE={
 cinema:{label:'Sinemaya git',costs:[250,550,1100]},
 meal:{label:'Dışarıda yemek ye',costs:[350,850,1800]},
 shopping:{label:'Alışveriş yap',costs:[500,1500,4000]}
};
function applyLeisure(kind,companionId,tier){
  if(game.state.actions.remaining<=0){activityMessage='Bu yıl aksiyon hakkın kalmadı.';return;}
  const def=LEISURE[kind], cost=def.costs[tier];
  if(!spendCash(cost)){activityMessage='Bu seçim için yeterli nakdin yok.';return;}
  const companion=livingCompanions().find(x=>x.id===companionId)??livingCompanions()[0];
  if(companion.type==='partner'){
    companion.person.relationship=clamp((companion.person.relationship??60)+3+tier*2);
    companion.person.relationshipTension=clamp((companion.person.relationshipTension??10)-2-tier);
  }else if(companion.type==='friend'){
    companion.person.relationship=clamp((companion.person.relationship??55)+3+tier*2);
    companion.person.lastContactAge=game.state.player.age;
  }else if(companion.type==='child'){
    companion.person.relationship=clamp((companion.person.relationship??60)+4+tier);
  }
  game.state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  game.state.healthProfile.stress=clamp(game.state.healthProfile.stress-(2+tier));
  if(kind==='shopping'){
    game.state.player.appearance.attractiveness=clamp((game.state.player.appearance.attractiveness??50)+tier);
  }
  game.state.actions.remaining--;
  const text=def.label+' • '+companion.label+' • '+money(cost)+' harcadın.';
  game.state.history.push({age:game.state.player.age,kind:'activity',activityId:'leisure:'+kind,text});
  activityMessage=text;leisurePicker=null;
}
function makeYearMoment(){
  if(!game.state.player.alive)return null;
  const age=game.state.player.age;
  const rng=new RNG(game.seedText+':year-moment:'+game.state.year);
  if(age<7)return {title:'Küçük bir yıl',text:'Boş zamanında neye yöneldin?',choices:[
    {id:'play',label:'Oyun oyna'},{id:'family',label:'Ailenle vakit geçir'},{id:'learn',label:'Bir şey öğren'}
  ]};
  if(age<18)return {title:'Bu yıl neye ağırlık verdin?',text:'Okul dışında zamanını nasıl geçirdin?',choices:[
    {id:'friends',label:'Arkadaşlarla takıl'},{id:'study',label:'Derse ağırlık ver'},{id:'save',label:'Harçlığı biriktir'}
  ]};
  return rng.pick([
    {title:'Hafta sonu planı',text:'Kendine biraz zaman ayıracaksın.',choices:[{id:'cinema',label:'Sinemaya git'},{id:'rest',label:'Evde dinlen'},{id:'social',label:'Birini ara'}]},
    {title:'Küçük bir para kararı',text:'Bu ay elinde biraz serbest para kaldı.',choices:[{id:'save',label:'Biriktir'},{id:'shopping',label:'Kendine bir şey al'},{id:'meal',label:'Dışarıda yemek ye'}]}
  ]);
}
function applyYearMoment(choice){
  const s=game.state;
  s.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  let text='';
  if(choice==='play'||choice==='rest'){s.healthProfile.stress=clamp(s.healthProfile.stress-3);text='Kendine zaman ayırdın.';}
  if(choice==='family'){s.player.personality.sociability=clamp((s.player.personality.sociability??50)+1);text='Ailenle vakit geçirdin.';}
  if(choice==='learn'||choice==='study'){s.player.personality.discipline=clamp((s.player.personality.discipline??50)+1);text='Kendini geliştirmeye zaman ayırdın.';}
  if(choice==='friends'||choice==='social'){s.player.personality.sociability=clamp((s.player.personality.sociability??50)+1);text='Sosyal bağlarına vakit ayırdın.';}
  if(choice==='save'){if(s.finance)s.finance.cash=(s.finance.cash??0)+Math.round((s.familySupportMonthly??s.finance.familySupportMonthly??0)*.15);text='Harcamayıp kenara koymayı seçtin.';}
  if(['cinema','shopping','meal'].includes(choice)){leisurePicker=choice;text='Bir aktivite planladın.';switchScreen('activitiesScreen');}
  s.history.push({age:s.player.age,kind:'year-moment',text});
  yearMoment=null;render();
}

function updateBar(id, value) {
  $(`#${id}Bar`).style.width = `${value}%`;
  $(`#${id}Value`).textContent = value;
}

function relationScore(person) { return game.state.player.relationships?.[person.id] ?? person.relationship ?? null; }
function interestText(person) {
  const items = Object.entries(person.interests ?? {}).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return items.length ? items.map(([name]) => name).join(', ') : 'belirgin hobi yok';
}

function personCard(person, relation) {
  const rel = relationScore(person);
  const education = person.education?.level ?? 0;
  return `
    <article class="person-card">
      <div class="card-row">
        <div><h3>${relation}: ${person.name} ${person.surname}</h3><p>${person.age} yaş • ${person.job ?? 'Öğrenci/Çocuk'} • Eğitim ${education}/5</p></div>
        ${rel == null ? '' : `<span class="relationship-pill">${rel}/100</span>`}
      </div>
      <p>Boy ${person.appearance.heightCm} cm • Sağlık ${person.health.current}/100 • Görünüş ${person.appearance.attractiveness}/100</p>
      <p>İlgiler: ${interestText(person)}</p>
      ${person.background?.parentingStyle ? `<p>Ebeveynlik tarzı: ${person.background.parentingStyle.replace('_',' ')}</p>` : ''}
    </article>`;
}

function siblingLabel(person, index) {
  if (person.age > game.state.player.age) return person.sex === 'male' ? 'Abi' : 'Abla';
  return `Kardeş ${index + 1}`;
}

function renderRelationships() {
  const { parents, siblings, grandparents, social } = game.state;
  const family = [
    personCard(parents.mother, 'Anne'),
    personCard(parents.father, 'Baba'),
    ...siblings.map((person, index) => personCard(person, siblingLabel(person,index))),
    personCard(grandparents.maternal.grandmother, 'Anneanne'),
    personCard(grandparents.maternal.grandfather, 'Anne tarafından dede'),
    personCard(grandparents.paternal.grandmother, 'Babaanne'),
    personCard(grandparents.paternal.grandfather, 'Baba tarafından dede')
  ];
  const romance= social.romance
    ? `<div class="section-divider">Partner</div><article class="summary-card"><h3>${social.romance.name??'Partner'}</h3><p>Durum: <strong>${social.romance.status??'dating'}</strong> • İlişki: <strong>${Math.round(social.romance.relationship??0)}/100</strong></p><p>Birlikte: ${social.romance.yearsTogether??0} yıl • Gerilim: ${Math.round(social.romance.relationshipTension??0)}/100</p></article>`
    : '<div class="section-divider">Partner</div><div class="empty-state compact">Aktif partner yok.</div>';
  const kids=(game.state.children??[]).length
    ? `<div class="section-divider">Çocuklar</div>${game.state.children.map((child,i)=>`<article class="summary-card"><h3>${child.name??('Çocuk '+(i+1))}</h3><p>${child.age??0} yaş • ${child.educationPlan??child.education?.plan??'eğitim planı oluşuyor'}</p></article>`).join('')}`
    : '';
  const friends = social.friends.length
    ? `<div class="section-divider">Arkadaşlar</div>${social.friends.map(f=>personCard(f,'Arkadaş')).join('')}`
    : '<div class="section-divider">Arkadaşlar</div><div class="empty-state compact">Henüz yakın bir arkadaşın yok.</div>';
  $('#relationships').innerHTML = family.join('') + romance + kids + friends;
}

function renderActivities() {
  const interests=Object.entries(game.state.player.interests).sort((a,b)=>b[1]-a[1])
    .map(([name,score])=>`<div class="meter-row"><span>${name}</span><div class="mini-bar"><i style="width:${score}%"></i></div><b>${score}</b></div>`).join('');
  const actions=game.availableActivities();
  const leisureButtons=Object.entries(LEISURE).map(([id,x])=>`<button class="activity-button leisure-button" data-leisure="${id}">${x.label}</button>`).join('');
  let picker='';
  if(leisurePicker){
    const def=LEISURE[leisurePicker];
    picker=`<article class="summary-card picker-card"><h3>${def.label}</h3><p>Kiminle?</p>
      <div class="choice-list">${livingCompanions().slice(0,8).map(c=>`<button class="choice-button companion-choice" data-companion="${c.id}">${c.label}</button>`).join('')}</div>
      <p class="muted">Bir kişi seçince bütçe seçenekleri açılır.</p><div id="budgetChoices"></div></article>`;
  }
  $('#activities').innerHTML=`
    ${picker}
    <article class="summary-card"><div class="card-row"><h3>Serbest zaman</h3><span class="relationship-pill">${game.state.actions.remaining}/${game.state.actions.max}</span></div>
      <div class="activity-grid">${leisureButtons}</div></article>
    <article class="summary-card"><h3>Diğer aktiviteler</h3><div class="activity-grid">
      ${actions.map(x=>`<button class="activity-button" data-activity="${x.id}" ${game.state.actions.remaining<=0?'disabled':''}>${x.label}</button>`).join('')}
    </div>${activityMessage?`<p class="activity-message">${activityMessage}</p>`:''}</article>
    <article class="summary-card"><h3>İlgi Alanların</h3>${interests||'<p>Henüz belirgin bir ilgin oluşmadı.</p>'}</article>`;

  $('#activities').querySelectorAll('[data-leisure]').forEach(b=>b.addEventListener('click',()=>{leisurePicker=b.dataset.leisure;renderActivities();}));
  $('#activities').querySelectorAll('[data-activity]').forEach(button=>button.addEventListener('click',()=>{
    try{activityMessage=game.performActivity(button.dataset.activity);}catch(error){activityMessage=error.message;}render();
  }));
  $('#activities').querySelectorAll('[data-companion]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.companion, def=LEISURE[leisurePicker];
    $('#budgetChoices').innerHTML=`<p>Bütçe</p><div class="choice-list">${def.costs.map((cost,i)=>`<button class="choice-button" data-budget="${i}">${['Ekonomik','Standart','Premium'][i]} • ${money(cost)}</button>`).join('')}</div>`;
    $('#budgetChoices').querySelectorAll('[data-budget]').forEach(x=>x.addEventListener('click',()=>{applyLeisure(leisurePicker,id,Number(x.dataset.budget));render();}));
  }));
}

function renderAssets() {
  const { household, finance, assets } = game.state;
  const debts=finance?.debts??{};
  $('#assets').innerHTML = `
    <article class="summary-card">
      <h3>Kişisel Finans</h3>
      <p>Nakit: <strong>${money(finance?.cash)}</strong></p>
      <p>Birikim: <strong>${money(finance?.savings)}</strong></p>
      <p>Toplam borç: <strong>${money(finance?.debt)}</strong></p>
      <p>Net worth: <strong>${money(netWorth())}</strong></p>
      <p class="muted">Tüketici ${money(debts.consumer)} • Acil ${money(debts.emergency)} • Konut ${money(debts.housing)} • Araç ${money(debts.car)}</p>
    </article>
    <article class="summary-card">
      <h3>Varlıklar</h3>
      <p>Ev: <strong>${assets?.home ? assets.home.label : 'Yok'}</strong></p>
      <p>Araç: <strong>${assets?.car ? assets.car.label : 'Yok'}</strong></p>
      <p>Konut düzeni: ${finance?.lifestyle?.housing ?? '—'}</p>
    </article>
    <article class="summary-card">
      <h3>Yaşam Tarzı</h3>
      <p>Tahmini aylık temel yaşam gideri: <strong>${money(lifestyleMonthlyCost(game.state))}</strong></p>
      <label class="setting-row">Yemek <select data-lifestyle="food"><option value="frugal">Ucuz / düzensiz</option><option value="standard">Standart</option><option value="healthy">Sağlıklı</option><option value="premium">Premium</option></select></label>
      <label class="setting-row">Kıyafet <select data-lifestyle="clothing"><option value="basic">Temel</option><option value="standard">Özenli</option><option value="premium">Marka / premium</option></select></label>
      <label class="setting-row">Ulaşım <select data-lifestyle="transport"><option value="public">Toplu taşıma</option><option value="car">Araba ağırlıklı</option></select></label>
    </article>
    <article class="summary-card">
      <h3>Aile Hanesi</h3>
      <p>Başlangıç sınıfı: <strong>${household.economicClass}</strong></p>
      <p>Aylık hane geliri: <strong>${money(household.monthlyIncome)}</strong></p>
    </article>`;
  $('#assets').querySelectorAll('[data-lifestyle]').forEach(sel=>{
    const key=sel.dataset.lifestyle;
    sel.value=finance?.lifestyle?.[key]??sel.value;
    sel.addEventListener('change',()=>{
      try{
        setLifestyle(game.state,{[key]:sel.value});
        activityMessage='Yaşam tarzını güncelledin.';
      }catch(error){activityMessage=error.message;}
      render();
    });
  });
}

function renderCareer() {
  const e=game.state.education;
  const c=game.state.career;
  const higher=game.state.higherEducation;
  $('#career').innerHTML=`
    <article class="summary-card">
      <h3>Kariyer</h3>
      <p>İş: <strong>${c?.title ?? game.state.player.job ?? 'Çalışmıyor'}</strong></p>
      <p>Seviye: <strong>${c?.levelTitle ?? '—'}</strong> • Sektör: <strong>${c?.sector ?? '—'}</strong></p>
      <p>Aylık gelir: <strong>${money(c?.monthlyIncome ?? game.state.player.monthlyIncome)}</strong></p>
      <p>Performans: ${Math.round(c?.performance ?? 0)}/100 • Memnuniyet: ${Math.round(c?.satisfaction ?? 0)}/100</p>
      <p>Network: ${Math.round(c?.network ?? 0)}/100 • Company fit: ${Math.round(c?.companyFit ?? 0)}/100</p>
    </article>
    <article class="summary-card">
      <h3>Eğitim</h3>
      <p>${higher?.completed ? 'Üniversite mezunu' : higher?.enrolled ? 'Üniversitede' : e?.schoolName ?? 'Temel eğitim'}</p>
      <p>${higher?.programTitle ?? higher?.programId ?? ''}</p>
    </article>`;
}

function renderLifeTree() {
  const nodes = game.state.lifeTree?.nodes ?? [];
  if (!nodes.length) { $('#lifeTree').innerHTML = '<div class="empty-state">Henüz hayatının yönünü değiştiren büyük bir karar vermedin.</div>'; return; }
  $('#lifeTree').innerHTML = `<div class="tree-root">Doğum</div>${nodes.map((node,index)=>`<div class="tree-connector"></div><article class="tree-node"><small>${node.age} yaş • Karar ${index+1}</small><h3>${node.title}</h3><p class="chosen-path">✓ ${node.label}</p>${node.alternatives.map(a=>`<p class="alternate-path">↳ ${a.label}</p>`).join('')}</article>`).join('')}`;
}

function baseTimelineEntries() {
  const { player, parents, siblings, household } = game.state;
  const older = siblings.filter(s=>s.age>player.age).length;
  const siblingText = older ? `${older} büyük kardeşin olan bir aileye doğdun.` : 'Tek çocuk olarak dünyaya geldin.';
  return [
    { age:0, text:`${player.name} ${player.surname} olarak dünyaya geldin. ${siblingText}` },
    { age:0, text:`Annen ${parents.mother.job.toLowerCase()}, baban ${parents.father.job.toLowerCase()}. Ailen ${household.economicClass} gelir grubunda.` },
    { age:0, text:`Ailenin eğitim desteği ${household.educationSupport}/100, hobi desteği ${household.hobbySupport}/100 olarak şekillendi.` }
  ];
}

function renderTimeline() {
  const entries=[...baseTimelineEntries(),...game.state.history.map(item=>({age:item.age,text:item.result ?? item.text}))];
  $('#timeline').innerHTML=entries.filter(e=>e.text).sort((a,b)=>b.age-a.age).map(entry=>`<article class="life-entry"><div class="life-age">${entry.age} yaş</div><div class="life-copy">${entry.text}</div></article>`).join('');
}

function renderEvent() {
  const card=$('#eventCard');
  const dead=!game.state.player.alive;
  if(!pendingEvent){
    if(yearMoment&&!dead){
      card.classList.remove('hidden');
      card.innerHTML=`<h3>${yearMoment.title}</h3><p>${yearMoment.text}</p><div class="choice-list">${yearMoment.choices.map(c=>`<button class="choice-button" data-moment="${c.id}">${c.label}</button>`).join('')}</div>`;
      card.querySelectorAll('[data-moment]').forEach(b=>b.addEventListener('click',()=>applyYearMoment(b.dataset.moment)));
      $('#ageUp').disabled=true;
      return;
    }
    card.classList.toggle('hidden',!dead);
    if(dead){
      const d=game.state.death??{};
      card.innerHTML=`<h3>Hayat sona erdi</h3><p><strong>${game.state.player.age} yaş</strong> • ${d.cause??'Bilinmeyen neden'}</p><p>Net worth: <strong>${money(netWorth())}</strong> • Çocuk: <strong>${game.state.children?.length??0}</strong></p><p>Kariyer: <strong>${game.state.career?.title??game.state.player.job??'—'}</strong> • ${game.state.career?.levelTitle??'—'}</p><p>Büyük karar: <strong>${game.state.lifeTree?.nodes?.length??0}</strong></p>`;
    }else card.innerHTML='';
    $('#ageUp').disabled=dead;
    $('#autoLife').disabled=false;
    return;
  }
  $('#ageUp').disabled=true;
  card.classList.remove('hidden');
  card.innerHTML=`<h3>${pendingEvent.title}</h3><p>${pendingEvent.majorDecision?'Bu seçim Life Tree üzerinde bir dönüm noktası olarak kaydedilecek.':'Bu yıl hayatında bir seçim yapman gerekiyor.'}</p><div class="choice-list">${game.eventChoices(pendingEvent).map(choice=>`<button class="choice-button" data-choice="${choice.id}">${choice.label}</button>`).join('')}</div>`;
  card.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{game.makeChoice(pendingEvent,button.dataset.choice);pendingEvent=null;render();}));
}

function render(){
  const {player,household,year,finance,social,children}=game.state;
  $('#identity').textContent=`${player.name} ${player.surname}`;
  $('#subtitle').textContent=`${player.age} yaş • ${year} • ${household.economicClass} sınıf`;
  $('#seed').textContent=`seed: ${game.seedText}`;

  updateBar('health',getHealth(player));
  updateBar('stress',getStress());
  updateBar('mental',getMental());

  $('#moneyQuick').textContent=money((finance?.cash??0)+(finance?.savings??0));
  $('#debtQuick').textContent=money(finance?.debt??0);
  $('#jobQuick').textContent=game.state.career?.title??player.job??'—';
  const r=social?.romance;
  $('#familyQuick').textContent=`${r?.status==='married'?'Evli':r?'İlişki':'Bekâr'} • ${children?.length??0} çocuk`;

  renderTimeline();renderRelationships();renderActivities();renderAssets();renderCareer();renderLifeTree();renderEvent();
}


function autoDelay(mult=1){ return Number($('#autoSpeed')?.value??420)*mult; }
function setAutoStatus(text){
  let el=document.querySelector('.auto-status');
  if(!text){el?.remove();return;}
  if(!el){el=document.createElement('div');el.className='auto-status';document.querySelector('.phone-frame').appendChild(el);}
  el.textContent=text;
}
async function showScreen(id,label,token,mult=.75){
  if(token!==autoLifeToken||!autoLifeRunning)return false;
  switchScreen(id); setAutoStatus(label); render();
  await sleep(autoDelay(mult));
  return token===autoLifeToken&&autoLifeRunning;
}
async function pulse(selector,token,mult=.55){
  const el=$(selector);
  if(!el)return;
  el.classList.add('auto-focus');
  await sleep(autoDelay(mult));
  el.classList.remove('auto-focus');
}
function chooseAutoYearMoment(moment,rng){
  const ids=moment.choices.map(x=>x.id);
  const s=game.state;
  if(ids.includes('save')&&(s.finance?.debt??0)>250000)return 'save';
  if(ids.includes('study')&&(s.education?.performance??50)<65)return 'study';
  if(ids.includes('friends')&&(s.social?.friends?.length??0)<2)return 'friends';
  if(ids.includes('rest')&&(s.healthProfile?.stress??0)>55)return 'rest';
  if(ids.includes('social')&&s.social?.romance)return 'social';
  if(ids.includes('cinema')&&(s.finance?.cash??0)>1500)return 'cinema';
  if(ids.includes('meal')&&(s.finance?.cash??0)>2500)return 'meal';
  if(ids.includes('shopping')&&(s.finance?.cash??0)>5000)return 'shopping';
  return rng.pick(ids);
}
function autoResolveLeisure(kind,rng){
  const companions=livingCompanions();
  let companion=companions.find(x=>x.type==='partner')
    ??companions.find(x=>x.type==='friend')
    ??companions[0];
  const cash=game.state.finance?.cash??0;
  const def=LEISURE[kind];
  let tier=0;
  if(cash>def.costs[2]*8)tier=2;
  else if(cash>def.costs[1]*5)tier=1;
  applyLeisure(kind,companion.id,tier);
}
async function autoLifeLoop(token){
  autoLifeRng??=new RNG(game.seedText+':ui-auto-life');
  while(autoLifeRunning&&token===autoLifeToken&&game.state.player.alive){
    pendingEvent=game.ageOneYear();
    if(!pendingEvent&&game.state.player.alive)yearMoment=makeYearMoment();
    switchScreen('lifeScreen');
    render();
    setAutoStatus(game.state.player.age+' yaş • yeni yıl');
    await pulse('#ageUp',token,.45);
    await sleep(autoDelay(.55));
    if(!autoLifeRunning||token!==autoLifeToken||!game.state.player.alive)break;

    if(pendingEvent){
      const choices=game.eventChoices(pendingEvent);
      const chosen=humanLikeChoice(game,pendingEvent,choices,autoLifeRng.fork('event-'+game.state.year));
      render();
      setAutoStatus('Karar: '+pendingEvent.title);
      if(chosen){
        const button=document.querySelector('[data-choice="'+CSS.escape(chosen.id)+'"]');
        button?.classList.add('auto-focus');
        await sleep(autoDelay(.9));
        button?.classList.remove('auto-focus');
        if(autoLifeRunning&&token===autoLifeToken){
          game.makeChoice(pendingEvent,chosen.id);
          pendingEvent=null;
          render();
        }
      }
      await sleep(autoDelay(.5));
    }else if(yearMoment){
      const moment=yearMoment;
      const picked=chooseAutoYearMoment(moment,autoLifeRng.fork('moment-'+game.state.year));
      setAutoStatus('Yıllık seçim: '+moment.title);
      render();
      const btn=document.querySelector('[data-moment="'+CSS.escape(picked)+'"]');
      btn?.classList.add('auto-focus');
      await sleep(autoDelay(.8));
      btn?.classList.remove('auto-focus');
      if(autoLifeRunning&&token===autoLifeToken){
        applyYearMoment(picked);
        if(leisurePicker){
          const leisure=leisurePicker;
          await showScreen('activitiesScreen','Plan: '+LEISURE[leisure].label,token,.45);
          if(autoLifeRunning&&token===autoLifeToken)autoResolveLeisure(leisure,autoLifeRng.fork('leisure-'+game.state.year));
          render();
          await sleep(autoDelay(.5));
        }
      }
    }

    if(!game.state.player.alive)break;

    const order=activityOrder(game,'human-like',autoLifeRng.fork('activities-'+game.state.year));
    if(order.length&&game.state.actions.remaining>0){
      if(!await showScreen('activitiesScreen','Aktiviteler',token,.55))break;
      for(const id of order){
        if(game.state.actions.remaining<=0||!autoLifeRunning||token!==autoLifeToken)break;
        if(!game.availableActivities().some(x=>x.id===id))continue;
        const btn=document.querySelector('[data-activity="'+CSS.escape(id)+'"]');
        btn?.classList.add('auto-focus');
        setAutoStatus('Aktivite: '+(btn?.textContent??id));
        await sleep(autoDelay(.6));
        btn?.classList.remove('auto-focus');
        try{activityMessage=game.performActivity(id);}catch{}
        render();
        await sleep(autoDelay(.45));
      }
    }

    if(game.state.player.age>=18){
      if(!await showScreen('careerScreen','Kariyer',token,.55))break;
      if(!await showScreen('assetsScreen','Para & varlıklar',token,.55))break;
      if(game.state.social?.romance||(game.state.children?.length??0)>0){
        if(!await showScreen('relationshipsScreen','İlişkiler',token,.55))break;
      }
    }
    if((game.state.lifeTree?.nodes?.length??0)>0&&game.state.player.age%8===0){
      if(!await showScreen('treeScreen','Life Tree',token,.5))break;
    }
    switchScreen('lifeScreen'); render(); setAutoStatus('Hayat akıyor…');
    await sleep(autoDelay(.65));
  }
  if(token===autoLifeToken){
    autoLifeRunning=false;
    $('#autoLife').classList.remove('running');
    $('#autoLife').textContent=game.state.player.alive?'▶ AUTO LIFE':'↻ HAYAT BİTTİ';
    setAutoStatus(game.state.player.alive?'Auto Life durdu':'Hayat sona erdi');
    switchScreen('lifeScreen'); render();
    if(!game.state.player.alive)setTimeout(()=>setAutoStatus(''),1600);
  }
}
function toggleAutoLife(){
  if(!game.state.player.alive){newLife();return;}
  if(autoLifeRunning){
    autoLifeRunning=false;autoLifeToken++;
    $('#autoLife').classList.remove('running');
    $('#autoLife').textContent='▶ AUTO LIFE';
    setAutoStatus('Duraklatıldı');
    return;
  }
  pendingEvent=null;
  autoLifeRunning=true;
  autoLifeToken++;
  autoLifeRng=new RNG(game.seedText+':ui-auto-life:'+game.state.player.age);
  $('#autoLife').classList.add('running');
  $('#autoLife').textContent='⏸ DURAKLAT';
  autoLifeLoop(autoLifeToken);
}

function switchScreen(id){document.querySelectorAll('.screen-panel').forEach(panel=>panel.classList.toggle('active',panel.id===id));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.screen===id));}
function newLife(seed=$('#seedInput').value.trim()||String(Date.now())){
  autoLifeRunning=false;autoLifeToken++;setAutoStatus('');
  game=new Game(seed);pendingEvent=null;yearMoment=null;leisurePicker=null;activityMessage='';autoLifeRng=null;
  $('#autoLife')?.classList.remove('running');
  if($('#autoLife'))$('#autoLife').textContent='▶ AUTO LIFE';
  switchScreen('lifeScreen');render();
}

$('#newLife').addEventListener('click',()=>newLife());
$('#applySeed').addEventListener('click',()=>newLife());
$('#seedInput').addEventListener('keydown',event=>{if(event.key==='Enter')newLife();});
$('#ageUp').addEventListener('click',()=>{
  if(pendingEvent||!game.state.player.alive)return;
  activityMessage='';
  pendingEvent=game.ageOneYear();
  if(!pendingEvent&&game.state.player.alive)yearMoment=makeYearMoment();
  render();
});

$('#autoLife').addEventListener('click',toggleAutoLife);
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchScreen(button.dataset.screen)));
newLife('life-tree-demo');
