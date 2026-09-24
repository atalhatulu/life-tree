import {JOBS,HOBBIES,PARENTING_STYLES} from '../data/catalog.js';
import {pickFirstName,pickSurname} from '../data/countries/turkey/names.js';
import {createPersonBase} from '../character/person.js';
import {inheritFromParents} from '../character/genetics.js';
import {pickBirthCity} from '../data/countries/turkey/profile.js';

function nameFor(rng,sex,usedNames){
 const name=pickFirstName(rng,sex,{avoid:usedNames?[...usedNames]:[]});
 usedNames?.add(name);
 return name;
}
function assignAdultLife(person,rng){
 person.education.level=rng.weighted([{value:0,weight:0.08},{value:1,weight:0.24},{value:2,weight:0.22},{value:3,weight:0.24},{value:4,weight:0.17},{value:5,weight:0.05}]);
 const jobs=JOBS.filter(j=>j.educationMin<=person.education.level).map(value=>({value,weight:value.weight}));
 const job=rng.weighted(jobs); person.job=job.title; person.jobId=job.id; person.monthlyIncome=rng.int(job.income[0],job.income[1]);
 const hobbyCount=rng.int(1,3); const pool=[...new Set([...job.interests,...HOBBIES])];
 while(Object.keys(person.interests).length<hobbyCount){ person.interests[rng.pick(pool)]=rng.int(45,95); }
 person.background.parentingStyle=rng.pick(PARENTING_STYLES);
 return person;
}
function makeAdult({rng,sex,surname,id,age,usedNames}){ const p=createPersonBase({id,name:nameFor(rng,sex,usedNames),surname,sex,age,rng}); return assignAdultLife(p,rng); }
function makeGrandparents(rng,parent,side,usedNames){
 const gmAge=parent.age+rng.int(18,34); const gfAge=parent.age+rng.int(19,38); const familySurname=side==='paternal'?parent.surname:pickSurname(rng);
 return {grandmother:makeAdult({rng:rng.fork(`${side}-gm`),sex:'female',surname:familySurname,id:`${side}-grandmother`,age:gmAge,usedNames}),grandfather:makeAdult({rng:rng.fork(`${side}-gf`),sex:'male',surname:familySurname,id:`${side}-grandfather`,age:gfAge,usedNames})};
}
function deriveChildInterests(rng,mother,father){
 const result={}; const all=new Set([...Object.keys(mother.interests),...Object.keys(father.interests)]);
 for(const interest of all){ const exposure=Math.max(mother.interests[interest]||0,father.interests[interest]||0); const shared=(mother.interests[interest]||0)>0&&(father.interests[interest]||0)>0; const score=Math.round(exposure*0.28+(shared?12:0)+rng.int(0,18)); if(score>=18) result[interest]=Math.min(70,score); }
 return result;
}
function relationshipSeed(rng,personA,personB,base=65){ const compatibility=100-Math.abs(personA.personality.sociability-personB.personality.sociability); return Math.max(25,Math.min(95,Math.round(base*0.7+compatibility*0.2+rng.int(-8,8)))); }
function economicClass(income,people){ const perCapita=income/Math.max(1,people); if(perCapita<18000)return 'düşük'; if(perCapita<38000)return 'orta'; if(perCapita<65000)return 'üst-orta'; return 'yüksek'; }

export function generateNewbornSibling(rng, family, id) {
 const { mother, father } = family.parents;
 const sex = rng.chance(0.5) ? 'female' : 'male';
 const usedNames=new Set([mother.name,father.name,family.player?.name,...(family.siblings??[]).map(person=>person.name)].filter(Boolean));
 const sibling = createPersonBase({ id, name: nameFor(rng.fork('name'), sex, usedNames), surname: father.surname, sex, age: 0, rng });
 const inherited = inheritFromParents(rng.fork('genetics'), mother, father, sex);
 sibling.appearance = inherited.appearance;
 sibling.health.constitution = inherited.health.constitution;
 sibling.health.genetics = inherited.health.genetics;
 sibling.interests = deriveChildInterests(rng.fork('interests'), mother, father);
 return sibling;
}

export function generateFamily(seed){
 const root=seed.fork('family'); const surname=pickSurname(root);
 const usedNames=new Set();
 const birthCity=pickBirthCity(root.fork('birth-city'));
 const motherAge=root.int(21,39); const fatherAge=Math.max(20,motherAge+root.int(-3,7));
 const mother=makeAdult({rng:root.fork('mother'),sex:'female',surname,id:'mother',age:motherAge,usedNames});
 const father=makeAdult({rng:root.fork('father'),sex:'male',surname,id:'father',age:fatherAge,usedNames});

 // Grandparents are founder genomes. Parents inherit from them, then every
 // younger generation inherits from the already-derived parental genomes.
 const maternalGrandparents=makeGrandparents(root,mother,'maternal',usedNames);
 const paternalGrandparents=makeGrandparents(root,father,'paternal',usedNames);

 const inheritedMother=inheritFromParents(
  root.fork('mother-lineage-genetics'),
  maternalGrandparents.grandmother,
  maternalGrandparents.grandfather,
  mother.sex
 );
 mother.appearance=inheritedMother.appearance;
 mother.health.constitution=inheritedMother.health.constitution;
 mother.health.genetics=inheritedMother.health.genetics;

 const inheritedFather=inheritFromParents(
  root.fork('father-lineage-genetics'),
  paternalGrandparents.grandmother,
  paternalGrandparents.grandfather,
  father.sex
 );
 father.appearance=inheritedFather.appearance;
 father.health.constitution=inheritedFather.health.constitution;
 father.health.genetics=inheritedFather.health.genetics;

 mother.monthlyIncome=Math.round(mother.monthlyIncome*birthCity.wage);
 father.monthlyIncome=Math.round(father.monthlyIncome*birthCity.wage);

 const sex=root.chance(0.5)?'female':'male';
 const child=createPersonBase({id:'player',name:nameFor(root.fork('child-name'),sex,usedNames),surname,sex,age:0,rng:root.fork('child')});
 const inherited=inheritFromParents(root.fork('genetics'),mother,father,sex);
 child.appearance=inherited.appearance;
 child.health.constitution=inherited.health.constitution;
 child.health.genetics=inherited.health.genetics;
 child.interests=deriveChildInterests(root.fork('interests'),mother,father);
 const olderSiblingCount=root.weighted([{value:0,weight:4.5},{value:1,weight:3.4},{value:2,weight:1.5},{value:3,weight:0.6}]);
 const maxOlderAge=Math.max(0,Math.min(14,motherAge-18));
 const siblings=[];
 for(let i=0;i<olderSiblingCount&&maxOlderAge>0;i+=1){ const srng=root.fork(`sibling-${i}`); const ssex=srng.chance(.5)?'female':'male'; const age=srng.int(1,maxOlderAge); const s=createPersonBase({id:`sibling-${i}`,name:nameFor(srng,ssex,usedNames),surname,sex:ssex,age,rng:srng}); const inheritedSibling=inheritFromParents(srng.fork('genetics'),mother,father,ssex); s.appearance=inheritedSibling.appearance; s.health.constitution=inheritedSibling.health.constitution; s.health.genetics=inheritedSibling.health.genetics; siblings.push(s); }
 siblings.sort((a,b)=>b.age-a.age);
 const people=2+siblings.length+1; const monthlyIncome=mother.monthlyIncome+father.monthlyIncome; const cls=economicClass(monthlyIncome/Math.max(.75,birthCity.cost),people);
 child.background.childhoodClass=cls;
 child.relationships.mother=relationshipSeed(root.fork('rel-mother'),child,mother,76); child.relationships.father=relationshipSeed(root.fork('rel-father'),child,father,73);
 for(const s of siblings) child.relationships[s.id]=relationshipSeed(root.fork(`rel-${s.id}`),child,s,66);
 const educationSupport=Math.round((mother.education.level+father.education.level)*8+(mother.personality.discipline+father.personality.discipline)*0.18);
 const hobbySupport=Math.round((Object.keys(mother.interests).length+Object.keys(father.interests).length)*10+(mother.personality.curiosity+father.personality.curiosity)*0.12);
 return {player:child,parents:{mother,father},grandparents:{maternal:maternalGrandparents,paternal:paternalGrandparents},siblings,
  country:{id:'TR',name:'Türkiye'},
  origin:{countryId:'TR',cityId:birthCity.id,cityName:birthCity.name},
  location:{countryId:'TR',cityId:birthCity.id,cityName:birthCity.name,sinceYear:2026},
  household:{monthlyIncome,economicClass:cls,people,educationSupport:Math.min(100,educationSupport),hobbySupport:Math.min(100,hobbySupport),parenting:{mother:mother.background.parentingStyle,father:father.background.parentingStyle}}
 };
}
