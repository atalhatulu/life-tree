import { Game } from '../core/game.js';

let game;
let pendingEvent = null;

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function getHappiness(player) {
  const curiosity = player.personality?.curiosity ?? 50;
  const sociability = player.personality?.sociability ?? 50;
  return clamp(Math.round((curiosity + sociability + 100) / 3));
}

function getLooks(player) {
  return clamp(player.appearance?.attractiveness ?? 50);
}

function getHealth(player) {
  const current = player.health?.current ?? 70;
  const constitution = player.health?.constitution ?? 70;
  return clamp(Math.round((current + constitution) / 2));
}

function updateBar(id, value) {
  $(`#${id}Bar`).style.width = `${value}%`;
  $(`#${id}Value`).textContent = value;
}

function familyRelationLabel(person, relation) {
  const job = person.job ?? 'Çocuk';
  return `
    <article class="person-card">
      <h3>${relation}: ${person.name} ${person.surname}</h3>
      <p>${person.age} yaş • ${job}</p>
      <p>Sağlık ${person.health.current}/100 • Görünüş ${person.appearance.attractiveness}/100</p>
    </article>`;
}

function renderRelationships() {
  const { parents, siblings, grandparents } = game.state;
  $('#relationships').innerHTML = [
    familyRelationLabel(parents.mother, 'Anne'),
    familyRelationLabel(parents.father, 'Baba'),
    ...siblings.map((person, index) => familyRelationLabel(person, `Kardeş ${index + 1}`)),
    familyRelationLabel(grandparents.maternal.grandmother, 'Anneanne'),
    familyRelationLabel(grandparents.maternal.grandfather, 'Dede'),
    familyRelationLabel(grandparents.paternal.grandmother, 'Babaanne'),
    familyRelationLabel(grandparents.paternal.grandfather, 'Dede')
  ].join('');
}

function renderAssets() {
  const { household } = game.state;
  $('#assets').innerHTML = `
    <article class="summary-card">
      <h3>Aile Hanesi</h3>
      <p>Ekonomik sınıf: ${household.economicClass}</p>
      <p>Aylık hane geliri: ₺${household.monthlyIncome.toLocaleString('tr-TR')}</p>
      <p>Kişisel varlık sistemi sonraki ekonomi aşamasında açılacak.</p>
    </article>`;
}

function baseTimelineEntries() {
  const { player, parents, siblings, household } = game.state;
  const siblingText = siblings.length
    ? `${siblings.length} kardeşin olan bir aileye doğdun.`
    : 'Tek çocuk olarak doğdun.';

  return [
    {
      age: 0,
      text: `${player.name} ${player.surname} olarak dünyaya geldin. ${siblingText}`
    },
    {
      age: 0,
      text: `Annen ${parents.mother.job.toLowerCase()}, baban ${parents.father.job.toLowerCase()}. Ailen ${household.economicClass} gelir grubunda.`
    }
  ];
}

function renderTimeline() {
  const entries = [
    ...baseTimelineEntries(),
    ...game.state.history.map((item) => ({ age: item.age, text: item.result }))
  ];

  $('#timeline').innerHTML = entries
    .sort((a, b) => b.age - a.age)
    .map((entry) => `
      <article class="life-entry">
        <div class="life-age">${entry.age} yaş</div>
        <div class="life-copy">${entry.text}</div>
      </article>`)
    .join('');
}

function renderEvent() {
  const card = $('#eventCard');
  if (!pendingEvent) {
    card.classList.add('hidden');
    card.innerHTML = '';
    $('#ageUp').disabled = false;
    return;
  }

  $('#ageUp').disabled = true;
  card.classList.remove('hidden');
  card.innerHTML = `
    <h3>${pendingEvent.title}</h3>
    <p>Bu yıl hayatında önemli bir seçim yapman gerekiyor.</p>
    <div class="choice-list">
      ${pendingEvent.choices.map((choice) => `
        <button class="choice-button" data-choice="${choice.id}">${choice.label}</button>
      `).join('')}
    </div>`;

  card.querySelectorAll('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      game.makeChoice(pendingEvent, button.dataset.choice);
      pendingEvent = null;
      render();
    });
  });
}

function render() {
  const { player, household, year } = game.state;
  const health = getHealth(player);
  const happiness = getHappiness(player);
  const looks = getLooks(player);

  $('#identity').textContent = `${player.name} ${player.surname}`;
  $('#subtitle').textContent = `${player.age} yaş • ${year} • ${household.economicClass} sınıf`;
  $('#seed').textContent = `seed: ${game.seedText}`;

  updateBar('health', health);
  updateBar('happiness', happiness);
  updateBar('looks', looks);

  renderTimeline();
  renderRelationships();
  renderAssets();
  renderEvent();
}

function switchScreen(id) {
  document.querySelectorAll('.screen-panel').forEach((panel) => panel.classList.toggle('active', panel.id === id));
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.screen === id));
}

function newLife(seed = $('#seedInput').value.trim() || String(Date.now())) {
  game = new Game(seed);
  pendingEvent = null;
  switchScreen('lifeScreen');
  render();
}

$('#newLife').addEventListener('click', () => newLife());
$('#applySeed').addEventListener('click', () => newLife());
$('#seedInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') newLife();
});

$('#ageUp').addEventListener('click', () => {
  if (pendingEvent) return;
  pendingEvent = game.ageOneYear();
  render();
});

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => switchScreen(button.dataset.screen));
});

newLife('life-tree-demo');
