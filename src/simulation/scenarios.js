import {Game} from '../core/game.js';
import {ensurePersonalFinance,addDebt} from '../finance/personal_finance.js';
import {ensureMentalHealth} from '../health/mental_health_system.js';
import {createRomanticInterest} from '../social/romance_system.js';
import {marryPartner} from '../social/partnership_system.js';
import {addChild} from '../family/parenting_system.js';
import {RNG} from '../core/rng.js';

export function buildScenario(id,seed='scenario'){
 const g=new Game(seed+':'+id);
 const s=g.state;

 if(id==='low-income-student'){
  s.player.age=19;s.year=2045;
  s.education={stage:'graduated',performance:62,aptitude:60,quality:55,graduationReadiness:64};
  s.nextPath='university';
  s.household.economicClass='düşük';
  s.household.educationSupport=42;
 }

 if(id==='career-professional'){
  s.player.age=34;s.year=2060;
  s.higherEducation={completed:true,careerTags:['developer'],programTitle:'Bilgisayar Bilimleri'};
  s.career={employed:true,jobId:'developer',title:'Yazılımcı',family:'tech',monthlyIncome:125000,years:8,totalYears:8,performance:80,degreeRelated:true,level:3,levelTitle:'senior',satisfaction:68,stability:65,sector:'private',previousJobs:[]};
  s.player.job='Yazılımcı';s.player.jobId='developer';s.player.monthlyIncome=125000;
 }

 if(id==='long-unemployed'){
  s.player.age=39;s.year=2065;
  s.nextPath='work';s.unemployedSinceAge=35;
  s.career={employed:false,jobId:'accountant',title:'Muhasebeci',family:'business',monthlyIncome:0,years:8,totalYears:8,performance:60,degreeRelated:false,level:2,satisfaction:30,stability:20,previousJobs:[]};
  s.player.job=null;s.player.jobId=null;s.player.monthlyIncome=0;
 }

 if(id==='two-child-family'){
  s.player.age=38;s.year=2064;
  ensurePersonalFinance(s);s.finance.cash=350000;s.finance.savings=450000;
  s.career={employed:true,jobId:'teacher',title:'Öğretmen',family:'education',monthlyIncome:70000,years:10,totalYears:10,performance:70,degreeRelated:true,level:3,levelTitle:'senior',satisfaction:60,stability:75,sector:'public',previousJobs:[]};
  s.player.job='Öğretmen';s.player.jobId='teacher';s.player.monthlyIncome=70000;
  const rng=new RNG(seed+':family');
  s.social.romance=createRomanticInterest(s,rng,'partner');
  s.social.romance.relationship=82;marryPartner(s);
  addChild(s,rng.fork('c1'));addChild(s,rng.fork('c2'));
  s.children[0].age=8;s.children[1].age=4;
 }

 if(id==='heavy-debt'){
  s.player.age=42;s.year=2068;
  ensurePersonalFinance(s);s.finance.cash=20000;s.finance.savings=0;
  addDebt(s,'consumer',1400000);addDebt(s,'emergency',600000);
  s.career={employed:true,jobId:'mechanic',title:'Oto tamircisi',family:'trades',monthlyIncome:65000,years:14,totalYears:14,performance:58,degreeRelated:false,level:3,levelTitle:'senior',satisfaction:45,stability:45,sector:'private',previousJobs:[]};
  s.player.job='Oto tamircisi';s.player.jobId='mechanic';s.player.monthlyIncome=65000;
 }

 if(id==='mental-strain'){
  s.player.age=36;s.year=2062;
  s.healthProfile={conditions:[],stress:88,fitness:35,lastCheckupAge:null,riskExposure:{}};
  const m=ensureMentalHealth(s);m.strain=74;m.status='distressed';
  ensurePersonalFinance(s);addDebt(s,'emergency',900000);
 }

 return g;
}
