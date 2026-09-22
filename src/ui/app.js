import { Game } from '../core/game.js';
import { autoplay } from '../simulation/autoplay.js';

let game;
let pendingEvent = null;
let activityMessage = '';

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
  const interests = Object.entries(game.state.player.interests)
    .sort((a,b)=>b[1]-a[1])
    .map(([name,score])=>`<div class="meter-row"><span>${name}</span><div class="mini-bar"><i style="width:${score}%"></i></div><b>${score}</b></div>`)
    .join('');
  const actions = game.availableActivities();
  $('#activities').innerHTML = `
    <article class="summary-card">
      <div class="card-row"><h3>Bu yıl yapabileceklerin</h3><span class="relationship-pill">${game.state.actions.remaining}/${game.state.actions.max}</span></div>
      <div class="activity-grid">
        ${actions.map(a=>`<button class="activity-button" data-activity="${a.id}" ${game.state.actions.remaining<=0?'disabled':''}>${a.label}</button>`).join('') || '<p>Henüz aktif seçim yapacak yaşta değilsin.</p>'}
      </div>
      ${activityMessage ? `<p class="activity-message">${activityMessage}</p>` : ''}
    </article>
    <article class="summary-card"><h3>İlgi Alanların</h3>${interests || '<p>Henüz belirgin bir ilgin oluşmadı.</p>'}</article>`;

  $('#activities').querySelectorAll('[data-activity]').forEach(button=>button.addEventListener('click',()=>{
    try { activityMessage = game.performActivity(button.dataset.activity); }
    catch (error) { activityMessage = error.message; }
    render();
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
      <h3>Aile Hanesi</h3>
      <p>Başlangıç sınıfı: <strong>${household.economicClass}</strong></p>
      <p>Aylık hane geliri: <strong>${money(household.monthlyIncome)}</strong></p>
    </article>`;
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
    card.classList.toggle('hidden',!dead);
    if(dead){
      const d=game.state.death??{};
      card.innerHTML=`<h3>Hayat sona erdi</h3><p><strong>${game.state.player.age} yaş</strong> • ${d.cause??'Bilinmeyen neden'}</p><p>Net worth: <strong>${money(netWorth())}</strong> • Çocuk: <strong>${game.state.children?.length??0}</strong></p><p>Kariyer: <strong>${game.state.career?.title??game.state.player.job??'—'}</strong> • ${game.state.career?.levelTitle??'—'}</p><p>Büyük karar: <strong>${game.state.lifeTree?.nodes?.length??0}</strong></p>`;
    }else card.innerHTML='';
    $('#ageUp').disabled=dead;
    $('#sim5').disabled=dead;
    $('#sim10').disabled=dead;
    return;
  }
  $('#ageUp').disabled=true;
  $('#sim5').disabled=true;
  $('#sim10').disabled=true;
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

function switchScreen(id){document.querySelectorAll('.screen-panel').forEach(panel=>panel.classList.toggle('active',panel.id===id));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.screen===id));}
function newLife(seed=$('#seedInput').value.trim()||String(Date.now())){game=new Game(seed);pendingEvent=null;activityMessage='';switchScreen('lifeScreen');render();}

$('#newLife').addEventListener('click',()=>newLife());
$('#applySeed').addEventListener('click',()=>newLife());
$('#seedInput').addEventListener('keydown',event=>{if(event.key==='Enter')newLife();});
$('#ageUp').addEventListener('click',()=>{
  if(pendingEvent||!game.state.player.alive)return;
  activityMessage='';
  pendingEvent=game.ageOneYear();
  render();
});

function fastForward(years){
  if(pendingEvent||!game.state.player.alive)return;
  activityMessage='';
  const target=Math.min(100,game.state.player.age+years);
  autoplay(game,{toAge:target,policy:'human-like'});
  pendingEvent=game.pendingEvent();
  render();
}
$('#sim5').addEventListener('click',()=>fastForward(5));
$('#sim10').addEventListener('click',()=>fastForward(10));
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchScreen(button.dataset.screen)));
newLife('life-tree-demo');
