import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {auditCareerTransitions} from '../src/career/career_audit.js';

function base(){
 const g=new Game('career-audit-v2');
 g.state.player.age=40;
 g.state.careerProfile={experienceByJob:{},experienceByFamily:{},recentJobs:[],coreFamily:null,totalExperience:0};
 return g;
}

test('returning to same occupation after firing is not an anomaly',()=>{
 const g=base();
 g.state.careerProfile.recentJobs=[{jobId:'developer',title:'Yazılımcı',family:'technology',years:5,leftAtAge:39,reason:'fired'}];
 g.state.career={employed:true,jobId:'developer',title:'Yazılımcı',enteredAtAge:40,transitionReason:'prior-job'};
 assert.deepEqual(auditCareerTransitions(g.state),[]);
});

test('rapid voluntary return to occupation is flagged',()=>{
 const g=base();
 g.state.careerProfile.recentJobs=[{jobId:'developer',title:'Yazılımcı',family:'technology',years:5,leftAtAge:39,reason:'career-switch'}];
 g.state.career={employed:true,jobId:'developer',title:'Yazılımcı',enteredAtAge:40,transitionReason:'prior-job'};
 const issues=auditCareerTransitions(g.state);
 assert.equal(issues.length,1);
 assert.equal(issues[0].type,'rapid-voluntary-return');
});

test('long unemployment fallback into unrelated entry work is coherent',()=>{
 const g=base();
 g.state.careerProfile.recentJobs=[{jobId:'developer',title:'Yazılımcı',family:'technology',years:5,leftAtAge:35,reason:'fired'}];
 g.state.career={employed:true,jobId:'cook',title:'Aşçı',enteredAtAge:40,transitionReason:'long-unemployment-fallback'};
 assert.deepEqual(auditCareerTransitions(g.state),[]);
});

test('unexplained voluntary unrelated switch remains an anomaly',()=>{
 const g=base();
 g.state.careerProfile.recentJobs=[{jobId:'developer',title:'Yazılımcı',family:'technology',years:5,leftAtAge:39,reason:'career-switch'}];
 g.state.career={employed:true,jobId:'cook',title:'Aşçı',enteredAtAge:40,transitionReason:'career-switch'};
 const issues=auditCareerTransitions(g.state);
 assert.ok(issues.some(x=>x.type==='voluntary-unrelated-switch'));
});
