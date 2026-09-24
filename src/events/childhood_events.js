import {growTrait} from '../character/personality_dynamics.js';
import {enrollPrimarySchool} from '../education/school_system.js';
const clamp=v=>Math.max(0,Math.min(100,v));
export const childhoodEvents=[
 {id:'first-family-hobby',title:'Evde Bir Merak',minAge:5,maxAge:9,once:true,condition:s=>Object.keys(s.player.interests).length>0,weight:()=>4,choices:s=>[
  {id:'join',label:'Ailenden tanıdığın '+Object.keys(s.player.interests)[0]+' hobisiyle ilgilen',result:s=>'Ailenden tanıdığın '+Object.keys(s.player.interests)[0]+' hobisine ilgi göstermeye başladın.',effect:s=>{const k=Object.keys(s.player.interests)[0];s.player.interests[k]=clamp(s.player.interests[k]+12);s.player.personality.curiosity=growTrait(s.player.personality.curiosity,3);}},
  {id:'ignore',label:'Başka şeyler keşfet',result:'Kendi ilgilerini aramayı tercih ettin.',effect:s=>{s.player.personality.curiosity=growTrait(s.player.personality.curiosity,7);}}
 ]},
 {id:'school-start',title:'Okul Başlıyor',minAge:6,maxAge:7,once:true,priority:170,condition:s=>!s.education,weight:()=>12,choices:[
  {id:'embrace',label:'Hevesle başla',result:s=>s.education.schoolName+' okuluna hevesli başladın.',effect:(s,rng)=>enrollPrimarySchool(s,rng,'embrace')},
  {id:'reluctant',label:'İsteksiz başla',result:s=>s.education.schoolName+' okuluna alışman zaman aldı.',effect:(s,rng)=>enrollPrimarySchool(s,rng,'reluctant')}
 ]},
 {id:'parent-study-pressure',title:'Ders Baskısı',minAge:8,maxAge:15,condition:s=>s.education?.enrolled&&s.household.educationSupport>55&&s.player.age>=(s.nextStudyPressureAge??8),weight:s=>1+s.household.educationSupport/60,choices:[
  {id:'study',label:'Daha çok çalış',result:'Derslerine daha fazla zaman ayırdın.',effect:s=>{s.education.studyEffort=clamp((s.education.studyEffort??0)+25);s.player.personality.discipline=growTrait(s.player.personality.discipline,2);s.nextStudyPressureAge=s.player.age+3;}},
  {id:'balance',label:'Denge kur',result:'Derslerle boş zaman arasında denge kurmaya çalıştın.',effect:s=>{s.education.studyEffort=clamp((s.education.studyEffort??0)+10);s.player.personality.curiosity=growTrait(s.player.personality.curiosity,2);s.nextStudyPressureAge=s.player.age+3;}}
 ]}
];
