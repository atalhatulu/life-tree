import {generateUniversityApplications,progressUniversityYear} from '../education/university_system.js';
import {generateJobOffers,progressCareerYear} from '../career/job_market.js';
import {processCareerDynamics} from '../career/career_system.js';
import {recordCareerYear} from '../career/career_profile.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../finance/personal_finance.js';
import {ensureAssets} from '../assets/asset_system.js';
import {lifestyleEffects} from '../lifestyle/lifestyle_system.js';
import {processPartnershipYear} from '../social/partnership_system.js';
import {processChildrenYear,ensureChildren} from '../family/parenting_system.js';
import {processHealthYear,ensureHealthProfile} from '../health/health_system.js';
import {ensureAdultPreferences} from './adult_preferences.js';
import {processDescendantLives} from '../family/descendant_life_system.js';
import {processInheritance} from '../finance/inheritance_system.js';
import {processRetirementYear} from '../career/retirement_system.js';
import {processBusinessYear} from '../career/entrepreneurship_system.js';
import {finalizeDeath} from './death_summary.js';
import {processLateLifeYear} from './late_age_system.js';
import {generatePartnerMoveOpportunity} from '../world/migration_system.js';
import {processUnemploymentYear} from '../career/unemployment_system.js';
import {processRetrainingYear} from '../career/career_system.js';
import {processMentalHealthYear} from '../health/mental_health_system.js';
import {processMilitaryYear} from './military_service.js';
import {processMiddleAgeYear} from './middle_age_system.js';
import {processRelationshipDepthYear} from '../social/relationship_depth.js';
import {processWorkplaceYear} from '../career/workplace_system.js';
import {processHouseholdDepthYear} from '../finance/household_depth.js';
import {processMemoryConsequencesYear} from './memory_system.js';

export function processAdultYear(state,rng){
 const entries=[];
 const age=state.player.age;
 if(age<19||!state.player.alive) return entries;

 ensurePersonalFinance(state);
 ensureAssets(state);
 ensureChildren(state);
 ensureHealthProfile(state);
 ensureAdultPreferences(state,rng.fork('preferences'));
 generatePartnerMoveOpportunity(state,rng.fork('partner-migration'));

 if(state.nextPath==='university'&&!state.higherEducation&&!state.pendingUniversityApplications){
  state.pendingUniversityApplications=generateUniversityApplications(state,rng.fork('university-apps-'+age));
 }
 if(state.nextPath==='work'&&!state.career?.employed&&!state.pendingJobOffers){
  state.pendingJobOffers=generateJobOffers(state,rng.fork('job-offers-'+age),3,{mode:(state.careerProfile?.totalExperience??0)>0?'reemployment':'entry'});
 }
 if(state.nextPath==='gap'&&!state.pendingUniversityApplications&&!state.pendingJobOffers){
  state.gapYears=(state.gapYears??0)+1;
 }

 entries.push(...progressUniversityYear(state,rng.fork('university-progress')));
 entries.push(...progressCareerYear(state,rng.fork('career-progress')));
 recordCareerYear(state);
 entries.push(...processCareerDynamics(state,rng.fork('career-dynamics')));
 entries.push(...processWorkplaceYear(state,rng.fork('workplace')));
 entries.push(...processUnemploymentYear(state));
 entries.push(...processRetrainingYear(state));
 entries.push(...processMilitaryYear(state));
 entries.push(...processMiddleAgeYear(state,rng.fork('middle-age')));
 entries.push(...processPartnershipYear(state,rng.fork('partnership')));
 entries.push(...processRelationshipDepthYear(state,rng.fork('relationship-depth')));
 entries.push(...processChildrenYear(state,rng.fork('children')));
 entries.push(...processDescendantLives(state,rng.fork('descendants')));
 entries.push(...processInheritance(state));
 entries.push(...processRetirementYear(state));
 entries.push(...processBusinessYear(state,rng.fork('business')));
 entries.push(...processLateLifeYear(state,rng.fork('late-life')));

 const healthBeforeLifestyle=state.player.health.current;
 const effects=lifestyleEffects(state);
 state.healthProfile.stress=Math.max(0,Math.min(100,(state.healthProfile.stress??20)+effects.stress));
 state.player.health.current=Math.max(0,Math.min(100,state.player.health.current+effects.health));

 const transitionPending=state.pendingUniversityApplications||state.pendingJobOffers||state.pendingCareerOffers;
 if(age>=20||state.career?.employed||state.higherEducation?.enrolled){
  if(!transitionPending||age>=20) entries.push(...processPersonalFinanceYear(state));
  entries.push(...processHouseholdDepthYear(state,rng.fork('household-depth')));
  entries.push(...processMemoryConsequencesYear(state));
 }

 entries.push(...processMentalHealthYear(state,rng.fork('mental-health')));
 entries.push(...processHealthYear(state,rng.fork('health'),{healthBeforeYear:healthBeforeLifestyle}));
 if(!state.player.alive)finalizeDeath(state);
 return entries;
}
