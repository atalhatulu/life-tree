import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';

function base(label,activity){
 const state=new Game('cycle83-'+label).state;
 state.player.age=activity==='school'?15:activity==='university'?22:35;
 state.actions={remaining:3,max:3};
 state.mentalHealth={strain:20,status:'stable',resilience:55,therapyYears:0};
 state.education={enrolled:activity==='school',studyEffort:15};
 state.higherEducation=activity==='university'?{enrolled:true,performance:65}:null;
 state.career={employed:activity==='course',performance:65,satisfaction:50};
 state.player.interests={'müzik':45,'resim':55};
 return state;
}
function rejects(label,mode,id,setup){
 test(label+' rejects without mutation or RNG consumption',()=>{
  const state=base(label,mode);setup(state);
  const rng=new RNG('cycle83-rng-'+label);
  const before=structuredClone(state),rngBefore=rng.state;
  assert.throws(()=>performActivity(state,id,rng),/Geçersiz/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,rngBefore);
  assert.equal(availableActivities(state).some(a=>a.id===id.split(':')[0]),false);
  assert.deepEqual(state,before);
 });
}

// 1. Study: a corrupt university performance or school effort must not be
// clamped/concatenated after consuming RNG; discipline must be valid as well.
for(const [label,mode,setup] of [
 ['university performance NaN','university',s=>{s.higherEducation.performance=NaN;}],
 ['university performance string','university',s=>{s.higherEducation.performance='65';}],
 ['university performance negative','university',s=>{s.higherEducation.performance=-1;}],
 ['university performance above 100','university',s=>{s.higherEducation.performance=101;}],
 ['university performance absent','university',s=>{delete s.higherEducation.performance;}],
 ['school effort NaN','school',s=>{s.education.studyEffort=NaN;}],
 ['school effort string','school',s=>{s.education.studyEffort='15';}],
 ['school effort negative','school',s=>{s.education.studyEffort=-1;}],
 ['school effort above 100','school',s=>{s.education.studyEffort=101;}],
 ['school education array','school',s=>{s.education=[];s.education.enrolled=true;}],
 ['study discipline NaN','school',s=>{s.player.personality.discipline=NaN;}],
 ['university discipline string','university',s=>{s.player.personality.discipline='60';}]
])rejects(label,mode,'study',setup);

// 2. Course: malformed traits or employed career performance must not leave
// partial curiosity/discipline changes when the later career write fails.
for(const [label,setup] of [
 ['course curiosity NaN',s=>{s.player.personality.curiosity=NaN;}],
 ['course curiosity string',s=>{s.player.personality.curiosity='60';}],
 ['course curiosity above 100',s=>{s.player.personality.curiosity=101;}],
 ['course discipline NaN',s=>{s.player.personality.discipline=NaN;}],
 ['course discipline negative',s=>{s.player.personality.discipline=-1;}],
 ['course career performance NaN',s=>{s.career.performance=NaN;}],
 ['course career performance string',s=>{s.career.performance='65';}],
 ['course career performance above 100',s=>{s.career.performance=101;}],
 ['course career array',s=>{s.career=[];s.career.employed=true;}]
])rejects(label,'course','course',setup);

// 3. Hobby: invalid interest scores, malformed dictionaries, and invalid
// curiosity in the empty-interest fallback must be rejected before RNG use.
for(const [label,id,setup] of [
 ['hobby interest NaN','hobby',s=>{s.player.interests.resim=NaN;}],
 ['hobby interest string','hobby',s=>{s.player.interests.resim='55';}],
 ['hobby interest negative','hobby',s=>{s.player.interests.resim=-1;}],
 ['hobby interest above 100','hobby',s=>{s.player.interests.resim=101;}],
 ['hobby interests array','hobby',s=>{s.player.interests=[25,55];}],
 ['hobby interests string','hobby',s=>{s.player.interests='resim';}],
 ['explicit hobby corrupt other interest','hobby:müzik',s=>{s.player.interests.resim=NaN;}],
 ['hobby empty curiosity NaN','hobby',s=>{s.player.interests={};s.player.personality.curiosity=NaN;}],
 ['hobby empty curiosity string','hobby',s=>{s.player.interests={};s.player.personality.curiosity='55';}]
])rejects(label,'hobby',id,setup);

test('legacy school without study effort starts at zero',()=>{
 const s=base('school-legacy','school');delete s.education.studyEffort;
 assert.ok(availableActivities(s).some(a=>a.id==='study'));
 assert.match(performActivity(s,'study',new RNG('school-legacy')), /Ders çalıştın/);
 assert.ok(s.education.studyEffort>=25&&s.education.studyEffort<=40);
 assert.equal(s.actions.remaining,2);
});
test('valid university study increments performance and spends one action',()=>{
 const s=base('university-valid','university');
 assert.ok(availableActivities(s).some(a=>a.id==='study'));
 assert.match(performActivity(s,'study',new RNG('university-valid')), /Üniversite/);
 assert.ok(s.higherEducation.performance>=67&&s.higherEducation.performance<=70);
 assert.equal(s.actions.remaining,2);
});
test('unemployed course supports absent career scores and optional legacy traits',()=>{
 const s=base('course-legacy','course');s.career.employed=false;
 delete s.career.performance;delete s.player.personality.curiosity;
 assert.ok(availableActivities(s).some(a=>a.id==='course'));
 assert.match(performActivity(s,'course',new RNG('course-legacy')), /beceri/);
 assert.ok(Number.isFinite(s.player.personality.curiosity));
 assert.equal(s.actions.remaining,2);
});
test('employed course improves valid career performance',()=>{
 const s=base('course-valid','course');
 assert.match(performActivity(s,'course',new RNG('course-valid')), /Mesleki/);
 assert.ok(s.career.performance>=66&&s.career.performance<=68);
 assert.equal(s.actions.remaining,2);
});
test('legacy missing interests allows curiosity-based hobby',()=>{
 const s=base('hobby-legacy','hobby');delete s.player.interests;
 assert.ok(availableActivities(s).some(a=>a.id==='hobby'));
 assert.match(performActivity(s,'hobby',new RNG('hobby-legacy')), /uğraşlar/);
 assert.equal(s.actions.remaining,2);
});
test('explicit valid hobby updates selected interest only',()=>{
 const s=base('hobby-valid','hobby');
 assert.match(performActivity(s,'hobby:müzik',new RNG('hobby-valid')), /müzik/);
 assert.ok(s.player.interests.müzik>=48&&s.player.interests.müzik<=51);
 assert.equal(s.player.interests.resim,55);
 assert.equal(s.actions.remaining,2);
});
