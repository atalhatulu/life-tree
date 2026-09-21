import {inheritGenome} from '../health/genetic_system.js';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function inheritValue(rng,a,b,mutation=12){ return clamp(Math.round((a+b)/2+rng.int(-mutation,mutation)),1,100); }
function inheritedHeight(rng,mother,father,sex){
 const target=sex==='male'?((mother.appearance.heightCm+father.appearance.heightCm+13)/2):((mother.appearance.heightCm+father.appearance.heightCm-13)/2);
 return clamp(Math.round(target+rng.int(-7,7)),145,205);
}
export function inheritFromParents(rng,mother,father,sex){
 return {appearance:{heightCm:inheritedHeight(rng,mother,father,sex),attractiveness:inheritValue(rng,mother.appearance.attractiveness,father.appearance.attractiveness,12),build:inheritValue(rng,mother.appearance.build,father.appearance.build,14)},health:{constitution:inheritValue(rng,mother.health.constitution,father.health.constitution,10),genetics:inheritGenome(rng.fork('health-genetics'),mother,father)}};
}
