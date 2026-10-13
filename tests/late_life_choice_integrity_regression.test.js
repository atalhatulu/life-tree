import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {setRetirementStyle,setCareMode} from '../src/life/late_age_system.js';
import {lateAgeEvents} from '../src/events/late_age_events.js';

function senior(seed='late-choice'){
 const g=new Game(seed);
 g.state.player.age=80;
 g.state.year=2080;
 g.state.healthProfile={stress:60,fitness:45,conditions:[]};
 g.state.lateLife={mobility:60,isolation:65,careNeed:true,careMode:null,retirementStyle:null};
 g.state.children=[{id:'child-1',age:38,alive:true,relationship:70}];
 return g;
}
function unchangedOnRepeat(g,action){
 const before=structuredClone(g.state);
 action(g.state);
 assert.deepEqual(g.state,before);
}
function choices(state){
 const event=lateAgeEvents.find(x=>x.id==='elder-care');
 assert.equal(event.condition(state),true);
 return event.choices(state).map(x=>x.id);
}

test('active retirement choice does not stack mobility or fitness on repeat',()=>{
 const g=senior('active-repeat');setRetirementStyle(g.state,'active');
 unchangedOnRepeat(g,s=>setRetirementStyle(s,'active'));
});
test('family retirement choice does not stack child relationships or isolation',()=>{
 const g=senior('family-repeat');setRetirementStyle(g.state,'family');
 unchangedOnRepeat(g,s=>setRetirementStyle(s,'family'));
});
test('quiet retirement choice does not stack stress reduction',()=>{
 const g=senior('quiet-repeat');setRetirementStyle(g.state,'quiet');
 unchangedOnRepeat(g,s=>setRetirementStyle(s,'quiet'));
});
test('retirement style cannot be replaced after a permanent choice',()=>{
 const g=senior('style-change');setRetirementStyle(g.state,'active');
 const before=structuredClone(g.state);
 assert.throws(()=>setRetirementStyle(g.state,'family'),/already chosen/i);
 assert.deepEqual(g.state,before);
});
test('legacy saved retirement style is treated as already applied',()=>{
 const g=senior('style-legacy');g.state.lateLife.retirementStyle='family';
 unchangedOnRepeat(g,s=>setRetirementStyle(s,'family'));
});
test('retirement style rejects unsupported values without mutation',()=>{
 const g=senior('style-invalid');const before=structuredClone(g.state);
 assert.throws(()=>setRetirementStyle(g.state,'invalid'),/invalid retirement style/i);
 assert.deepEqual(g.state,before);
});

test('family care choice does not stack isolation reduction or reset care start',()=>{
 const g=senior('care-family');setCareMode(g.state,'family');g.state.player.age++;
 unchangedOnRepeat(g,s=>setCareMode(s,'family'));
});
test('home care choice does not stack stress reduction',()=>{
 const g=senior('care-home');setCareMode(g.state,'home-care');
 unchangedOnRepeat(g,s=>setCareMode(s,'home-care'));
});
test('assisted care choice does not stack stress or isolation benefits',()=>{
 const g=senior('care-assisted');setCareMode(g.state,'assisted');
 unchangedOnRepeat(g,s=>setCareMode(s,'assisted'));
});
test('care mode cannot be replaced after a permanent choice',()=>{
 const g=senior('care-change');setCareMode(g.state,'family');
 const before=structuredClone(g.state);
 assert.throws(()=>setCareMode(g.state,'assisted'),/already chosen/i);
 assert.deepEqual(g.state,before);
});
test('legacy saved care mode survives replay and save/load',()=>{
 const g=senior('care-legacy');g.state.lateLife.careMode='home-care';
 const restored=Game.fromSave(serializeGame(g));
 unchangedOnRepeat(restored,s=>setCareMode(s,'home-care'));
});
test('care mode rejects unsupported values without mutation',()=>{
 const g=senior('care-invalid');const before=structuredClone(g.state);
 assert.throws(()=>setCareMode(g.state,'invalid'),/invalid care mode/i);
 assert.deepEqual(g.state,before);
});

test('deceased supportive adult children cannot unlock family care',()=>{
 const g=senior('care-dead');g.state.children=[{id:'dead',age:35,alive:false,relationship:99}];
 assert.equal(choices(g.state).includes('family-care'),false);
 assert.ok(choices(g.state).includes('home-care'));
});
test('living supportive adult child still unlocks family care',()=>{
 const g=senior('care-live');
 assert.equal(choices(g.state).includes('family-care'),true);
});
test('deceased supportive child does not override living unsupportive child',()=>{
 const g=senior('care-mixed');
 g.state.children=[{id:'dead',age:40,alive:false,relationship:95},{id:'live',age:38,alive:true,relationship:45}];
 assert.equal(choices(g.state).includes('family-care'),false);
});
