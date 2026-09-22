import { Game } from '../core/game.js';
import { decisionContext } from '../life/decision_context.js';

let game;
let pendingEvent = null;
let activityMessage = '';
let selectedSocialTargetId = null;

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

function actionResultText(result) {
  if (typeof result === 'string') return result;
  if (result?.text) return result.text;
  return 'Aksiyon tamamlandı.';
}

function historyText(item) {
  const value = item.result ?? item.text ?? item.eventId ?? 'olay';
  if (typeof value === 'string') return value;
  if (value?.text) return value.text;
  return item.eventId ?? item.kind ?? 'olay';
}

function renderActivities() {
  const state=game.state;
  const interests = Object.entries(state.player.interests)
    .sort((a,b)=>b[1]-a[1])
    .map(([name,score])=>`<div class="meter-row"><span>${name}</span><div class="mini-bar"><i style="width:${score}%"></i></div><b>${Math.round(score)}</b></div>`)
    .join('');

  const legacyDuplicates=new Set(['exercise','socialize','hobby','date']);
  const generic=game.availableActivities().filter(a=>!legacyDuplicates.has(a.id));
  const physical=game.availablePhysicalActivities();
  const hobbies=game.availableHobbies();
  const targets=game.socialTargets();
  if(!targets.some(t=>t.id===selectedSocialTargetId))selectedSocialTargetId=targets[0]?.id??null;
  const selectedTarget=targets.find(t=>t.id===selectedSocialTargetId)??null;
  const social=selectedTarget?game.availableSocialActivities(selectedTarget.id):[];

  const costLabel=cost=>cost>0?` • ₺${Math.round(cost).toLocaleString('tr-TR')}`:' • ücretsiz';
  const disabled=state.actions.remaining<=0?'disabled':'';

  $('#activities').innerHTML = `
    <article class="summary-card yearly-turn-card">
      <div class="card-row">
        <div><h3>${state.year} yıllık planın</h3><p>Bu yıl en fazla ${state.actions.max} anlamlı aksiyon seçebilirsin. Kalan hakkını kullanmadan yılı da bitirebilirsin.</p></div>
        <span class="relationship-pill">${state.actions.remaining}/${state.actions.max}</span>
      </div>
      ${activityMessage ? `<p class="activity-message">${activityMessage}</p>` : ''}
    </article>

    <details class="action-group" open>
      <summary>Odak kararları <span>${generic.length}</span></summary>
      <div class="activity-grid">
        ${generic.map(a=>`<button class="activity-button" data-generic="${a.id}" ${disabled}>${a.label}</button>`).join('') || '<p class="muted">Bu yıl ek bir genel odak yok.</p>'}
      </div>
    </details>

    <details class="action-group">
      <summary>Spor & fiziksel aktivite <span>${physical.length}</span></summary>
      <div class="activity-grid">
        ${physical.map(a=>`<button class="activity-button" data-physical="${a.id}" ${disabled}>${a.label}${costLabel(a.cost)}</button>`).join('') || '<p class="muted">Şu an uygun fiziksel aktivite yok.</p>'}
      </div>
    </details>

    <details class="action-group">
      <summary>Hobiler <span>${hobbies.length}</span></summary>
      <div class="activity-grid">
        ${hobbies.map(h=>`<button class="activity-button" data-hobby="${h.id}" ${disabled}>${h.label}${costLabel(h.cost)}</button>`).join('') || '<p class="muted">Şu an uygun hobi yok.</p>'}
      </div>
    </details>

    <details class="action-group">
      <summary>Sosyal hayat <span>${targets.length}</span></summary>
      ${targets.length?`
        <label class="field-label" for="socialTarget">Kiminle?</label>
        <select id="socialTarget" class="social-select">
          ${targets.map(t=>`<option value="${t.id}" ${t.id===selectedSocialTargetId?'selected':''}>${t.person.name} ${t.person.surname??''} • ${t.kind}</option>`).join('')}
        </select>
        <div class="activity-grid social-actions">
          ${social.map(a=>`<button class="activity-button" data-social="${a.id}" ${disabled}>${a.label}${costLabel(a.cost)}</button>`).join('') || '<p class="muted">Bu kişiyle şu an uygun/karşılanabilir etkinlik yok.</p>'}
        </div>
      `:'<p class="muted">Bu yıl sosyal aktivite seçebileceğin biri yok.</p>'}
    </details>

    <article class="summary-card"><h3>İlgi Alanların</h3>${interests || '<p>Henüz belirgin bir ilgin oluşmadı.</p>'}</article>`;

  const run=(selector,fn)=>$('#activities').querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>{
    try{activityMessage=actionResultText(fn(button));}
    catch(error){activityMessage=error.message;}
    render();
  }));
  run('[data-generic]',b=>game.performActivity(b.dataset.generic));
  run('[data-physical]',b=>game.performPhysicalActivity(b.dataset.physical));
  run('[data-hobby]',b=>game.performHobby(b.dataset.hobby));
  run('[data-social]',b=>game.performSocialActivity(selectedSocialTargetId,b.dataset.social));

  const targetSelect=$('#socialTarget');
  if(targetSelect)targetSelect.addEventListener('change',()=>{selectedSocialTargetId=targetSelect.value;renderActivities();});
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
  $('#lifeTree').innerHTML = `<div class="tree-root">Doğum</div>${nodes.map((node,index)=>`
    <div class="tree-connector"></div>
    <article class="tree-node">
      <small>${node.age} yaş • ${node.year??''} • Karar ${index+1}</small>
      <h3>${node.title}</h3>
      <p class="chosen-path">✓ ${node.label}</p>
      ${node.context?.length?`<div class="context-chips">${node.context.map(c=>`<span>${c}</span>`).join('')}</div>`:''}
      ${node.alternatives?.length?`<details class="alternatives"><summary>Diğer yollar (${node.alternatives.length})</summary>${node.alternatives.map(a=>`<p class="alternate-path">↳ ${a.label}</p>`).join('')}</details>`:''}
    </article>`).join('')}`;
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
  const entries=[...baseTimelineEntries(),...game.state.history.map(item=>({age:item.age,text:historyText(item)}))];
  $('#timeline').innerHTML=entries.filter(e=>e.text).sort((a,b)=>b.age-a.age).map(entry=>`<article class="life-entry"><div class="life-age">${entry.age} yaş</div><div class="life-copy">${entry.text}</div></article>`).join('');
}

function renderEvent() {
  const card=$('#eventCard');
  if(!pendingEvent){card.classList.add('hidden');card.innerHTML='';$('#ageUp').disabled=false;return;}
  $('#ageUp').disabled=true;card.classList.remove('hidden');
  const choices=game.eventChoices(pendingEvent);
  card.innerHTML=`<h3>${pendingEvent.title}</h3><p>${pendingEvent.majorDecision?'Bu seçim Life Tree üzerinde bir dönüm noktası olarak kaydedilecek.':'Bu yıl hayatında bir seçim yapman gerekiyor.'}</p><div class="choice-list">${choices.map(choice=>{
    const context=decisionContext(game.state,pendingEvent,choice);
    return `<button class="choice-button" data-choice="${choice.id}"><strong>${choice.label}</strong>${context.length?`<span class="choice-context">${context.join(' • ')}</span>`:''}</button>`;
  }).join('')}</div>`;
  card.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{game.makeChoice(pendingEvent,button.dataset.choice);pendingEvent=null;render();}));
}

function render(){
  const {player,household,year}=game.state;
  $('#identity').textContent=`${player.name} ${player.surname}`;$('#subtitle').textContent=`${player.age} yaş • ${year} • ${household.economicClass} sınıf`;$('#seed').textContent=`seed: ${game.seedText}`;
  updateBar('health',getHealth(player));updateBar('happiness',getHappiness(player));updateBar('looks',getLooks(player));
  renderTimeline();renderRelationships();renderActivities();renderAssets();renderCareer();renderLifeTree();renderEvent();
  const ageButton=$('#ageUp');
  if(!pendingEvent&&player.alive&&player.age>=5&&game.state.actions.remaining>0){
    ageButton.textContent=`YILI BİTİR • ${game.state.actions.remaining} AKSİYON KALDI`;
  }else ageButton.textContent=player.alive?'+1 YAŞ':'HAYAT SONA ERDİ';
  ageButton.disabled=Boolean(pendingEvent)||!player.alive;
}

function switchScreen(id){document.querySelectorAll('.screen-panel').forEach(panel=>panel.classList.toggle('active',panel.id===id));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.screen===id));}
function newLife(seed=$('#seedInput').value.trim()||String(Date.now())){game=new Game(seed);pendingEvent=null;activityMessage='';selectedSocialTargetId=null;switchScreen('lifeScreen');render();}

$('#newLife').addEventListener('click',()=>newLife());
$('#applySeed').addEventListener('click',()=>newLife());
$('#seedInput').addEventListener('keydown',event=>{if(event.key==='Enter')newLife();});
$('#ageUp').addEventListener('click',()=>{if(pendingEvent)return;activityMessage='';pendingEvent=game.ageOneYear();render();});
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchScreen(button.dataset.screen)));
newLife('life-tree-demo');
