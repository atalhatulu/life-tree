import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {calculateYksScore,generateUniversityApplications,applyUniversityProgram} from '../src/education/university_system.js';
import {generateJobOffers,acceptJob} from '../src/career/job_market.js';

test('YKS score is deterministic and bounded',()=>{
 const a=new Game('yks-score'),b=new Game('yks-score');
 a.state.player.age=18;b.state.player.age=18;
 const sa=calculateYksScore(a.state,new RNG('yks'));
 const sb=calculateYksScore(b.state,new RNG('yks'));
 assert.equal(sa,sb);
 assert.ok(sa>=0&&sa<=100);
});

test('university applications carry YKS and build preference list',()=>{
 const g=new Game('yks-preferences');
 g.state.player.age=19;
 g.state.education.graduationReadiness=70;
 const offers=generateUniversityApplications(g.state,new RNG('apps'),4);
 assert.ok(offers.length>0);
 assert.ok(offers.every(x=>Number.isFinite(x.yksScore)));
 assert.ok(g.state.universityPlanning.preferenceList.length>0);
});

test('university admission assigns funding and housing plan',()=>{
 const g=new Game('university-funding');
 g.state.player.age=19;
 g.state.education.graduationReadiness=95;
 g.state.pendingUniversityApplications=generateUniversityApplications(g.state,new RNG('funding-apps'),3);
 for(const offer of g.state.pendingUniversityApplications)offer.admissionChance=100;
 const result=applyUniversityProgram(g.state,{int:()=>1,fork:()=>new RNG('funding-choice')},g.state.pendingUniversityApplications[0].id);
 assert.equal(result.admitted,true);
 assert.ok(['scholarship','kyk','family'].includes(g.state.higherEducation.funding));
 assert.ok(['family','dorm','shared-flat','studio'].includes(g.state.higherEducation.housingChoice));
});

test('job offers expose public private or self-employed sectors',()=>{
 const g=new Game('sector-offers');
 g.state.player.age=24;
 g.state.higherEducation={completed:true,careerTags:['accountant'],programTitle:'İşletme'};
 const offers=generateJobOffers(g.state,new RNG('sector-offers-rng'),10,{mode:'entry'});
 assert.ok(offers.length>0);
 assert.ok(offers.every(x=>['public','private','self-employed'].includes(x.sector)));
 assert.ok(offers.every(x=>Number.isFinite(x.sectorStability)));
});

test('accepted sector is persisted into career state',()=>{
 const g=new Game('sector-accept');
 g.state.player.age=24;
 g.state.higherEducation={completed:true,careerTags:['accountant'],programTitle:'İşletme'};
 g.state.pendingJobOffers=generateJobOffers(g.state,new RNG('sector-accept-rng'),5,{mode:'entry'});
 const offer=g.state.pendingJobOffers[0];
 assert.ok(offer);
 acceptJob(g.state,offer.id);
 assert.equal(g.state.career.sector,offer.sector);
 assert.equal(g.state.career.stability,offer.sectorStability);
});
