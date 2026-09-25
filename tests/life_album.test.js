import test from 'node:test';
import assert from 'node:assert/strict';
import {eventArtKind,eventIllustration,albumEntries,albumMarkup} from '../src/ui/life_album.js';

test('event illustrations select a theme without altering events',()=>{
  const event={title:'Üniversite sınavı'};
  assert.equal(eventArtKind(event),'study');
  assert.match(eventIllustration(event),/lt-art-study/);
  assert.deepEqual(event,{title:'Üniversite sınavı'});
});
test('album uses actual history and escapes player-controlled text',()=>{
  const state={player:{name:'<Ada>'},history:[
    {age:18,kind:'choice',text:'Üniversiteye başladın.'},
    {age:19,kind:'activity',text:'<script>alert(1)</script>'}
  ]};
  assert.equal(albumEntries(state).length,2);
  const html=albumMarkup(state,age=>age<19?'Gençlik':'Yetişkinlik');
  assert.match(html,/Üniversiteye başladın/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/&lt;Ada&gt;/);
});
test('empty album has a helpful state',()=>{
  assert.match(albumMarkup({player:{name:'Ada'},history:[]},()=>''),/Henüz kaydedilmiş/);
});
