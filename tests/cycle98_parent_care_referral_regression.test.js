import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {evaluateParentCareNeed,hasCurrentParentCareReferral,setParentCareMode,processElderFamilyYear} from '../src/family/elder_system.js';
import {lateLifeEvents} from '../src/events/late_life_events.js';

const careEvent=lateLifeEvents.find(event=>event.id==='parent-elder-care');
function referral(seed='cycle98-care'){
 const game=new Game(seed);
 const s=game.state;
 s.player.age=40;
 s.parents.mother.alive=false;
 s.parents.father.alive=true;
 s.parents.father.age=68;
 s.parents.father.health.current=47.9;
 assert.equal(evaluateParentCareNeed(s)?.id,'father');
 return game;
}

test('care event eligibility rejects referral after health recovery without mutation',()=>{
 const {state:s}=referral();
 const before=structuredClone(s.parentCare);
 s.parents.father.health.current=48.12;
 assert.equal(hasCurrentParentCareReferral(s),false);
 assert.equal(careEvent.condition(s),false);
 assert.deepEqual(s.parentCare,before);
 assert.equal(evaluateParentCareNeed(s),null);
 assert.equal(s.parentCare.pendingParentId,null);
});

test('care referral remains selectable and executable while eligible',()=>{
 const {state:s}=referral('cycle98-valid');
 assert.equal(careEvent.condition(s),true);
 const chosen=careEvent.choices(s)[0];
 assert.equal(chosen.id,'family-parent-care');
 assert.equal(setParentCareMode(s,'family').parentId,'father');
 assert.equal(careEvent.condition(s),false);
});

test('care event refuses a pending referral after a different parent becomes priority',()=>{
 const {state:s}=referral('cycle98-priority');
 s.parents.mother.alive=true;
 s.parents.mother.age=78;
 s.parents.mother.health.current=20;
 assert.equal(careEvent.condition(s),false);
 assert.equal(evaluateParentCareNeed(s)?.id,'mother');
 assert.equal(careEvent.condition(s),true);
});

test('elder annual mortality clears same-year stale care referral',()=>{
 const {state:s}=referral('cycle98-mortality');
 s.year=2030;
 const rng={fork:label=>({int:()=>0,chance:()=>label==='death-father'})};
 processElderFamilyYear(s,rng);
 assert.equal(s.parents.father.alive,false);
 assert.equal(s.parentCare.pendingParentId,null);
 assert.equal(careEvent.condition(s),false);
});

test('known random simulation seed no longer throws stale parent care decision',async()=>{
 const {autoplay}=await import('../src/simulation/autoplay.js');
 const game=new Game('batch-random-0');
 autoplay(game,{toAge:40,policy:'random'});
 assert.equal(game.state.player.age,40);
});
