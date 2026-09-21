import {highSchoolOptions,selectHighSchoolPath,graduationReadiness} from '../education/pathways.js';
import {createRomanticInterest} from '../social/romance_system.js';

export const adolescenceEvents=[
 {
  id:'high-school-path',
  title:'Lise Yolunu Seçme Zamanı',
  minAge:14,maxAge:14,once:true,majorDecision:true,priority:100,
  condition:s=>s.education?.stage==='middle',
  choices:[
   {
    id:'academic',
    label:'Akademik lise için hazırlan',
    condition:s=>highSchoolOptions(s).some(o=>o.id==='academic'&&o.available),
    result:s=>s.education.admissionSucceeded?s.education.schoolName+' okuluna girdin.':'Hedeflediğin okula giremedin; '+s.education.schoolName+' okuluna yerleştin.',
    effect:(s,rng)=>selectHighSchoolPath(s,rng,'academic')
   },
   {
    id:'vocational',
    label:'Mesleki ve teknik liseyi seç',
    condition:s=>highSchoolOptions(s).some(o=>o.id==='vocational'&&o.available),
    result:s=>s.education.admissionSucceeded?s.education.schoolName+' okuluna girdin.':'İstediğin programa giremedin; '+s.education.schoolName+' okuluna yerleştin.',
    effect:(s,rng)=>selectHighSchoolPath(s,rng,'vocational')
   },
   {
    id:'specialist',
    label:'Yetenek odaklı liseyi dene',
    condition:s=>highSchoolOptions(s).some(o=>o.id==='specialist'&&o.available),
    result:s=>s.education.admissionSucceeded?'Yetenek sınavını geçip '+s.education.schoolName+' okuluna girdin.':'Yetenek sınavı istediğin gibi geçmedi; '+s.education.schoolName+' okuluna yerleştin.',
    effect:(s,rng)=>selectHighSchoolPath(s,rng,'specialist')
   }
  ]
 },
 {
  id:'first-romance',
  title:'İlk Hoşlanma',
  minAge:15,maxAge:18,once:true,priority:5,
  condition:s=>!s.social?.romance&&s.player.personality.sociability>=35,
  weight:s=>.6+s.player.personality.sociability/80,
  choices:[
   {
    id:'approach',
    label:'Tanışmaya çalış',
    result:s=>s.social.romance?s.social.romance.name+' ile görüşmeye başladın.':'Yaklaşmayı denedin ama bir ilişkiye dönüşmedi.',
    effect:(s,rng)=>{
      const chance=Math.min(.88,.25+s.player.personality.sociability/180+s.player.appearance.attractiveness/260);
      if(rng.chance(chance)) s.social.romance=createRomanticInterest(s,rng.fork('romance'),'romance-'+s.year);
    }
   },
   {
    id:'leave',
    label:'Üzerinde durma',
    result:'Hoşlantını kendi halinde bırakmayı seçtin.',
    effect:s=>{s.player.personality.patience=Math.min(100,s.player.personality.patience+2);}
   }
  ]
 },
 {
  id:'after-high-school',
  title:'Lise Sonrası',
  minAge:18,maxAge:18,once:true,majorDecision:true,priority:110,
  condition:s=>s.education?.stage==='high',
  choices:[
   {
    id:'university',
    label:'Üniversiteye hazırlan',
    result:'Üniversite yoluna yönelmeye karar verdin.',
    effect:s=>{s.education.graduationReadiness=graduationReadiness(s);s.nextPath='university';}
   },
   {
    id:'work',
    label:'Çalışma hayatına gir',
    result:'Doğrudan çalışma hayatına girmeye karar verdin.',
    effect:s=>{s.education.graduationReadiness=graduationReadiness(s);s.nextPath='work';}
   },
   {
    id:'gap',
    label:'Bir yıl hazırlan / düşün',
    result:'Bir yıl kendine zaman ayırıp seçeneklerini değerlendirmeye karar verdin.',
    effect:s=>{s.education.graduationReadiness=graduationReadiness(s);s.nextPath='gap';}
   }
  ]
 }
];
