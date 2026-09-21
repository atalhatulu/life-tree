import { Game } from '../core/game.js';

let game;
let pendingEvent = null;
let activityMessage = '';

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function getHappiness(player) {
  const curiosity = player.personality?.curiosity ?? 50;
  const sociability = player.personality?.sociability ?? 50;
  return clamp(Math.round((curiosity + sociability + 100) / 3));
}
function getLooks(player) { return clamp(player.appearance?.attractiveness ?? 50); }
function getHealth(player) { return clamp(Math.round(((player.health?.current ?? 70) + (player.health?.constitution ?? 70)) / 2)); }

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
  const friends = social.friends.length
    ? `<div class="section-divider">Arkadaşlar</div>${social.friends.map(f=>personCard(f,'Arkadaş')).join('')}`
    : '<div class="empty-state compact">Henüz yakın bir arkadaşın yok.</div>';
  $('#relationships').innerHTML = family.join('') + friends;
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
  const { household } = game.state;
  $('#assets').innerHTML = `<article class="summary-card"><h3>Aile Hanesi</h3><p>Ekonomik sınıf: <strong>${household.economicClass}</strong></p><p>Aylık hane geliri: <strong>₺${household.monthlyIncome.toLocaleString('tr-TR')}</strong></p><p>Hanede yaşayan kişi: ${household.people}</p><p>Eğitim desteği: ${household.educationSupport}/100</p><p>Hobi desteği: ${household.hobbySupport}/100</p></article>`;
}

function renderCareer() {
  const e = game.state.education;
  $('#career').innerHTML = e
    ? `<article class="summary-card"><h3>${e.schoolName}</h3><p>Kademe: İlkokul</p><p>Okul kalitesi: ${e.quality}/100</p><p>Başarı: ${Math.round(e.performance)}/100</p><p>Motivasyon: ${Math.round(e.motivation)}/100</p><p>Devam: ${Math.round(e.attendance)}/100</p></article>`
    : '<article class="empty-state">Henüz okul hayatın başlamadı.</article>';
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
  if(!pendingEvent){card.classList.add('hidden');card.innerHTML='';$('#ageUp').disabled=false;return;}
  $('#ageUp').disabled=true;card.classList.remove('hidden');
  card.innerHTML=`<h3>${pendingEvent.title}</h3><p>${pendingEvent.majorDecision?'Bu seçim Life Tree üzerinde bir dönüm noktası olarak kaydedilecek.':'Bu yıl hayatında bir seçim yapman gerekiyor.'}</p><div class="choice-list">${game.eventChoices(pendingEvent).map(choice=>`<button class="choice-button" data-choice="${choice.id}">${choice.label}</button>`).join('')}</div>`;
  card.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{game.makeChoice(pendingEvent,button.dataset.choice);pendingEvent=null;render();}));
}

function render(){
  const {player,household,year}=game.state;
  $('#identity').textContent=`${player.name} ${player.surname}`;$('#subtitle').textContent=`${player.age} yaş • ${year} • ${household.economicClass} sınıf`;$('#seed').textContent=`seed: ${game.seedText}`;
  updateBar('health',getHealth(player));updateBar('happiness',getHappiness(player));updateBar('looks',getLooks(player));
  renderTimeline();renderRelationships();renderActivities();renderAssets();renderCareer();renderLifeTree();renderEvent();
}

function switchScreen(id){document.querySelectorAll('.screen-panel').forEach(panel=>panel.classList.toggle('active',panel.id===id));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.screen===id));}
function newLife(seed=$('#seedInput').value.trim()||String(Date.now())){game=new Game(seed);pendingEvent=null;activityMessage='';switchScreen('lifeScreen');render();}

$('#newLife').addEventListener('click',()=>newLife());
$('#applySeed').addEventListener('click',()=>newLife());
$('#seedInput').addEventListener('keydown',event=>{if(event.key==='Enter')newLife();});
$('#ageUp').addEventListener('click',()=>{if(pendingEvent)return;activityMessage='';pendingEvent=game.ageOneYear();render();});
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchScreen(button.dataset.screen)));
newLife('life-tree-demo');
