import {MONOGENIC_CONDITIONS,POLYGENIC_TRAITS} from './genetic_conditions.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function statusFor(condition,alleles){
 const variants=alleles.filter(a=>a==='V').length;
 if(condition.inheritance==='autosomal_recessive'){
  if(variants===2)return 'affected';
  if(variants===1)return 'carrier';
  return 'clear';
 }
 if(condition.inheritance==='autosomal_dominant'){
  return variants>=1?'affected':'clear';
 }
 return 'clear';
}

function founderLocus(rng,condition){
 const alleles=[
  rng.chance(condition.variantFrequency)?'V':'N',
  rng.chance(condition.variantFrequency)?'V':'N'
 ];
 return {alleles,status:statusFor(condition,alleles)};
}

export function createFounderGenome(rng){
 const monogenic={};
 for(const condition of MONOGENIC_CONDITIONS){
  monogenic[condition.id]=founderLocus(rng.fork('mono-'+condition.id),condition);
 }
 const polygenic={};
 for(const trait of POLYGENIC_TRAITS){
  polygenic[trait.id]=rng.fork('poly-'+trait.id).int(trait.baseMin,trait.baseMax);
 }
 return {monogenic,polygenic};
}

export function ensureGenome(person,rng){
 person.health??={constitution:50,current:80,predispositions:[]};
 if(!person.health.genetics)person.health.genetics=createFounderGenome(rng);
 return person.health.genetics;
}

export function inheritGenome(rng,mother,father){
 const maternal=mother.health?.genetics??createFounderGenome(rng.fork('fallback-mother'));
 const paternal=father.health?.genetics??createFounderGenome(rng.fork('fallback-father'));
 const monogenic={};

 for(const condition of MONOGENIC_CONDITIONS){
  const m=maternal.monogenic?.[condition.id]?.alleles??['N','N'];
  const f=paternal.monogenic?.[condition.id]?.alleles??['N','N'];
  const alleles=[
   rng.fork('m-'+condition.id).pick(m),
   rng.fork('f-'+condition.id).pick(f)
  ];
  monogenic[condition.id]={alleles,status:statusFor(condition,alleles)};
 }

 const polygenic={};
 for(const trait of POLYGENIC_TRAITS){
  const m=maternal.polygenic?.[trait.id]??50;
  const f=paternal.polygenic?.[trait.id]??50;
  polygenic[trait.id]=clamp(Math.round((m+f)/2+rng.fork('p-'+trait.id).int(-10,10)),5,95);
 }

 return {monogenic,polygenic};
}

export function processGeneticHealthYear(state,rng){
 const entries=[];
 const genetics=state.player.health?.genetics;
 if(!genetics)return entries;

 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};

 for(const condition of MONOGENIC_CONDITIONS){
  const locus=genetics.monogenic?.[condition.id];
  if(locus?.status!=='affected')continue;
  if(state.player.age<condition.manifestMinAge)continue;
  if(state.healthProfile.conditions.some(c=>c.id===condition.id))continue;

  const yearsPast=Math.max(0,state.player.age-condition.manifestMinAge);
  const chance=Math.min(.98,condition.annualManifestChance+yearsPast*.03);
  if(rng.fork('manifest-'+condition.id).chance(chance)){
   state.healthProfile.conditions.push({
    id:condition.id,
    label:condition.label,
    severity:condition.severity,
    diagnosedAtAge:state.player.age,
    genetic:true,
    inheritance:condition.inheritance
   });
   state.player.health.current=clamp(state.player.health.current-condition.severity*5);
   entries.push({
    age:state.player.age,
    kind:'health',
    paceBlock:true,
    text:condition.label+' genetik kökenli bir sağlık durumu olarak ortaya çıktı.'
   });
  }
 }
 return entries;
}

export function geneticRiskScore(state,traitId){
 return state.player.health?.genetics?.polygenic?.[traitId]??50;
}

export function geneticRiskMultiplier(state,conditionId){
 const mapping={
  hypertension:'hypertension',
  metabolic:'metabolic',
  cardiac:'cardiac'
 };
 const trait=mapping[conditionId];
 if(!trait)return 1;

 const score=geneticRiskScore(state,trait);
 let multiplier=.65+score/100;

 if(conditionId==='cardiac'){
  const fh=state.player.health?.genetics?.monogenic?.familial_hypercholesterolemia;
  if(fh?.status==='affected')multiplier*=2.2;
 }
 return Math.max(.45,Math.min(2.8,multiplier));
}

export function geneticSummary(person){
 const genetics=person.health?.genetics;
 if(!genetics)return {affected:[],carriers:[],polygenic:{}};
 const affected=[],carriers=[];
 for(const condition of MONOGENIC_CONDITIONS){
  const status=genetics.monogenic?.[condition.id]?.status;
  if(status==='affected')affected.push(condition.label);
  if(status==='carrier')carriers.push(condition.label);
 }
 return {affected,carriers,polygenic:{...(genetics.polygenic??{})}};
}


export function geneticDiseaseModifiers(state,conditionId){
 const mapping={
  hypertension:'hypertension',
  metabolic:'metabolic',
  cardiac:'cardiac'
 };
 const trait=mapping[conditionId];
 const score=trait?geneticRiskScore(state,trait):50;
 const normalized=Math.max(-.9,Math.min(.9,(score-50)/50));
 let onsetAgeOffset=Math.round(-normalized*6);
 let progressionMultiplier=Math.max(.78,Math.min(1.28,1+normalized*.28));
 let complicationMultiplier=Math.max(.82,Math.min(1.24,1+normalized*.22));
 let initialProgressionBonus=Math.max(0,Math.round(normalized*10));

 if(conditionId==='cardiac'){
  const fh=state.player.health?.genetics?.monogenic?.familial_hypercholesterolemia;
  if(fh?.status==='affected'){
   onsetAgeOffset-=5;
   progressionMultiplier=Math.min(1.45,progressionMultiplier*1.18);
   complicationMultiplier=Math.min(1.40,complicationMultiplier*1.15);
   initialProgressionBonus+=8;
  }
 }

 const direct=state.player.health?.genetics?.monogenic?.[conditionId];
 if(direct?.status==='affected'){
  onsetAgeOffset-=3;
  progressionMultiplier=Math.min(1.50,progressionMultiplier*1.20);
  complicationMultiplier=Math.min(1.45,complicationMultiplier*1.15);
  initialProgressionBonus+=10;
 }

 return {
  score,
  onsetAgeOffset,
  progressionMultiplier:Number(progressionMultiplier.toFixed(3)),
  complicationMultiplier:Number(complicationMultiplier.toFixed(3)),
  initialProgressionBonus
 };
}
