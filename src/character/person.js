import {createFounderGenome} from '../health/genetic_system.js';
export function createPersonBase({id,name,surname,sex,age,rng}){
 const heightBase=sex==='male'?rng.int(163,193):rng.int(152,181);
 return {id,name,surname,sex,age,alive:true,
  appearance:{heightCm:heightBase,attractiveness:rng.int(20,90),build:rng.int(20,90)},
  health:{constitution:rng.int(35,95),current:rng.int(60,100),predispositions:[],genetics:createFounderGenome(rng.fork('genome'))},
  personality:{discipline:rng.int(15,95),sociability:rng.int(15,95),ambition:rng.int(15,95),curiosity:rng.int(15,95),patience:rng.int(15,95)},
  education:{level:0,performance:rng.int(30,75)},interests:{},job:null,jobId:null,monthlyIncome:0,
  relationships:{},background:{childhoodClass:null,parentingStyle:null}
 };
}
