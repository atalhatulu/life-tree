// Presentation-only helpers. No game-state mutation.
export function escapeAlbumText(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function eventArtKind(event){
  const text=String(event?.title??event?.text??'').toLocaleLowerCase('tr-TR');
  if(/evlen|düğün|sevgil|aşk|partner|ilişki/.test(text))return 'love';
  if(/okul|üniversite|mezun|sınav|ders|eğitim/.test(text))return 'study';
  if(/iş|kariyer|meslek|maaş|terfi|çalış/.test(text))return 'career';
  if(/hast|sağlık|doktor|ameliyat|ölüm/.test(text))return 'health';
  if(/ev|taşın|araba|para|borç|birikim/.test(text))return 'home';
  if(/aile|anne|baba|çocuk|doğum/.test(text))return 'family';
  return 'journey';
}
const art={
  love:['♥','BAĞLAR'],study:['✎','ÖĞRENME'],career:['▣','YENİ YOL'],health:['✚','SAĞLIK'],
  home:['⌂','YUVA'],family:['✿','AİLE'],journey:['✦','HAYAT']
};
export function eventIllustration(event){
  const kind=eventArtKind(event),[symbol,label]=art[kind];
  return `<div class="lt-event-illustration lt-art-${kind}" role="img" aria-label="${label} temalı olay illüstrasyonu"><span class="lt-art-orbit"></span><span class="lt-art-symbol" aria-hidden="true">${symbol}</span><small>${label}</small></div>`;
}
export function albumEntries(state){
  const history=(state?.history??[]).map((entry,index)=>({
    age:Number.isFinite(entry.age)?entry.age:0,
    text:entry.result??entry.text??'',
    kind:entry.kind??'',
    index
  })).filter(entry=>String(entry.text).trim());
  const important=history.filter(entry=>['choice','memory','consequence-chain','relationship-action','activity','year-moment'].includes(entry.kind));
  const source=important.length?important:history;
  return source.slice(-80).reverse();
}
export function albumMarkup(state,chapter){
  const entries=albumEntries(state);
  if(!entries.length)return '<div class="empty-state">Henüz kaydedilmiş bir hatıran yok. Hayat ilerledikçe günlüğün dolacak.</div>';
  return `<div class="lt-album-intro"><span>✦ HAYAT ALBÜMÜ</span><strong>${escapeAlbumText(state.player?.name)}'in hatıraları</strong><p>Yaşadığın olaylar ve verdiğin kararlar, hayatının günlüğünü oluşturur.</p><small>${entries.length} kayıt gösteriliyor</small></div><div class="lt-album-list">${entries.map((entry,i)=>`<article class="lt-memory-card"><div class="lt-memory-art lt-art-${eventArtKind(entry)}" aria-hidden="true"><span>${art[eventArtKind(entry)][0]}</span></div><div class="lt-memory-copy"><small>${escapeAlbumText(chapter(entry.age))} · ${entry.age} YAŞ</small><p>${escapeAlbumText(entry.text)}</p></div></article>`).join('')}</div>`;
}
