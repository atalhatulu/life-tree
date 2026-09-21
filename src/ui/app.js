import { Game } from '../core/game.js';

let game;
let pendingEvent = null;

const $ = (selector) => document.querySelector(selector);

function personLine(person) {
  return `${person.name} ${person.surname}, ${person.age} yaş — ${person.job ?? 'çocuk'} — ₺${person.monthlyIncome.toLocaleString('tr-TR')}/ay`;
}

function render() {
  const { player, parents, siblings, household, year } = game.state;
  $('#identity').textContent = `${player.name} ${player.surname} • ${player.age} yaş • ${year}`;
  $('#seed').textContent = `Seed: ${game.seedText}`;
  $('#family').innerHTML = `
    <p><strong>Anne:</strong> ${personLine(parents.mother)}</p>
    <p><strong>Baba:</strong> ${personLine(parents.father)}</p>
    <p><strong>Kardeş:</strong> ${siblings.length}</p>
    <p><strong>Hane:</strong> ${household.economicClass} sınıf • ₺${household.monthlyIncome.toLocaleString('tr-TR')}/ay</p>`;
  $('#traits').innerHTML = `
    <p>Görünüş potansiyeli: ${player.appearance.attractiveness}/100</p>
    <p>Fiziksel yapı: ${player.appearance.build}/100</p>
    <p>Sağlık yapısı: ${player.health.constitution}/100</p>
    <p>İlgiler: ${Object.entries(player.interests).map(([k,v]) => `${k} (${v})`).join(', ') || 'Henüz belirgin değil'}</p>`;

  const eventBox = $('#event');
  if (!pendingEvent) {
    eventBox.innerHTML = '<p>Yılı ilerlet. Hayatın koşullarına uygun olaylar burada görünecek.</p>';
  } else {
    eventBox.innerHTML = `<h3>${pendingEvent.title}</h3>${pendingEvent.choices.map(c => `<button data-choice="${c.id}">${c.label}</button>`).join(' ')}`;
    eventBox.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
      const result = game.makeChoice(pendingEvent, button.dataset.choice);
      pendingEvent = null;
      $('#log').prepend(Object.assign(document.createElement('li'), { textContent: `${game.state.player.age} yaş: ${result}` }));
      render();
    }));
  }
}

function newLife(seed = $('#seedInput').value.trim() || String(Date.now())) {
  game = new Game(seed);
  pendingEvent = null;
  $('#log').innerHTML = '';
  render();
}

$('#newLife').addEventListener('click', () => newLife());
$('#ageUp').addEventListener('click', () => {
  if (pendingEvent) return;
  pendingEvent = game.ageOneYear();
  render();
});

newLife('life-tree-demo');
