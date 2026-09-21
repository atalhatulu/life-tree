import {generateUniversityApplications,progressUniversityYear} from '../education/university_system.js';
import {generateJobOffers,progressCareerYear} from '../career/job_market.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../finance/personal_finance.js';

export function processAdultYear(state,rng){
 const entries=[];
 const age=state.player.age;
 if(age<19) return entries;

 ensurePersonalFinance(state);

 if(state.nextPath==='university'&&!state.higherEducation&&!state.pendingUniversityApplications){
  state.pendingUniversityApplications=generateUniversityApplications(state,rng.fork('university-apps-'+age));
 }
 if(state.nextPath==='work'&&!state.career&&!state.pendingJobOffers){
  state.pendingJobOffers=generateJobOffers(state,rng.fork('job-offers-'+age));
 }
 if(state.nextPath==='gap'&&!state.pendingUniversityApplications&&!state.pendingJobOffers){
  state.gapYears=(state.gapYears??0)+1;
 }

 entries.push(...progressUniversityYear(state,rng.fork('university-progress')));
 entries.push(...progressCareerYear(state,rng.fork('career-progress')));

 const transitionPending=state.pendingUniversityApplications||state.pendingJobOffers;
 if(age>=20||state.career?.employed||state.higherEducation?.enrolled){
  if(!transitionPending || age>=20) entries.push(...processPersonalFinanceYear(state));
 }
 return entries;
}
