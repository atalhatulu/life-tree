import {applyUniversityProgram,generateUniversityApplications} from '../education/university_system.js';
import {acceptJob,generateJobOffers} from '../career/job_market.js';

export const adultEvents=[
 {
  id:'university-application',
  title:'Üniversite Başvuruları',
  minAge:19,maxAge:30,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingUniversityApplications)&&s.pendingUniversityApplications.length>0,
  choices:s=>s.pendingUniversityApplications.map(program=>({
   id:'program:'+program.id,
   label:program.title+' — kabul ihtimali %'+program.admissionChance,
   result:next=>next.higherEducation?.programId===program.id
    ? program.title+' bölümüne kabul edildin.'
    : program.title+' başvurun kabul edilmedi.',
   effect:(next,rng)=>applyUniversityProgram(next,rng,program.id)
  }))
 },
 {
  id:'first-job',
  title:'İş Teklifleri',
  minAge:19,maxAge:35,once:false,majorDecision:true,priority:120,
  condition:s=>Array.isArray(s.pendingJobOffers)&&s.pendingJobOffers.length>0,
  choices:s=>s.pendingJobOffers.map(job=>({
   id:'job:'+job.id,
   label:job.title+' — ₺'+job.salary.toLocaleString('tr-TR')+'/ay',
   result:job.title+' olarak çalışmaya başladın.',
   effect:next=>acceptJob(next,job.id)
  }))
 },
 {
  id:'gap-year-direction',
  title:'Bir Sonraki Adım',
  minAge:19,maxAge:30,once:false,majorDecision:true,priority:115,
  condition:s=>s.nextPath==='gap'&&!s.pendingUniversityApplications&&!s.pendingJobOffers&&!s.higherEducation?.enrolled&&!s.career?.employed,
  choices:[
   {
    id:'retry-university',
    label:'Üniversiteyi tekrar dene',
    result:'Bir sonraki başvuru dönemi için üniversiteye hazırlanmayı seçtin.',
    effect:(s,rng)=>{s.nextPath='university';s.pendingUniversityApplications=generateUniversityApplications(s,rng.fork('retry-university'));}
   },
   {
    id:'seek-work',
    label:'İş aramaya başla',
    result:'Çalışma hayatına yönelmeye karar verdin.',
    effect:(s,rng)=>{s.nextPath='work';s.pendingJobOffers=generateJobOffers(s,rng.fork('gap-job-search'));}
   },
   {
    id:'continue-gap',
    label:'Bir yıl daha bekle',
    result:'Bir yıl daha kendine zaman ayırmaya karar verdin.',
    effect:s=>{s.nextPath='gap';}
   }
  ]
 }
];
