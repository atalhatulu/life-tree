import {ensureNpcGoal,updateNpcGoal} from '../life/npc_goal_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function stage(age){
 if(age<6)return 'early';
 if(age<12)return 'child';
 if(age<18)return 'teen';
 return 'adult';
}

export function ensureChildDevelopment(child){
 child.development??={
  confidence:50,
  independence:35,
  academicDrive:50,
  socialSecurity:50,
  parentAttachment:70,
  identityStress:0,
  milestones:[],
  lastStage:null
 };
 return child.development;
}

export function processChildDevelopmentYear(state,rng){
 const entries=[];
 for(const child of state.children??[]){
  const d=ensureChildDevelopment(child);
  const childGoal=ensureNpcGoal(child,'child');
  const p=child.parenting??{};
  const currentStage=stage(child.age);
  const support=(p.involvement??55)*.35+(p.emotionalSecurity??70)*.35+(p.stability??65)*.2-(p.conflict??10)*.25;
  d.confidence=clamp(d.confidence+Math.round((support-50)*.025)+rng.fork(child.id+'-conf').int(-2,2));
  d.parentAttachment=clamp(d.parentAttachment+Math.round(((child.relationship??70)-60)*.025)+Math.round((p.involvement??55-50)*.02)-Math.round((p.conflict??10)*.015));
  d.academicDrive=clamp(d.academicDrive+Math.round(((child.personality?.discipline??50)-50)*.02)+Math.round((p.accumulatedSupport??0)*.01)+rng.fork(child.id+'-acad').int(-2,2));
  d.socialSecurity=clamp(d.socialSecurity+Math.round(((child.personality?.sociability??50)-50)*.025)+Math.round((d.confidence-50)*.015)+rng.fork(child.id+'-social').int(-2,2));
  d.independence=clamp(d.independence+(child.age>=12?2:1)+Math.round(((child.personality?.ambition??50)-50)*.015));
  if(currentStage==='teen'){
    d.identityStress=clamp(d.identityStress+Math.round((55-d.confidence)*.03)+Math.round((55-d.socialSecurity)*.025)+rng.fork(child.id+'-identity').int(-2,3));
  }else d.identityStress=clamp(d.identityStress-2);

  if(d.lastStage!==currentStage){
    d.lastStage=currentStage;
    const label=currentStage==='child'?'çocukluk':currentStage==='teen'?'ergenlik':currentStage==='adult'?'yetişkinlik':'erken çocukluk';
    d.milestones.push({age:child.age,type:'stage',label});
    entries.push({age:state.player.age,kind:'child-development',text:child.name+' '+label+' dönemine geçti.'});
  }

  if(child.age===13&&d.parentAttachment<48){
    entries.push({age:state.player.age,kind:'child-development',text:child.name+' ergenliğe girerken senden belirgin biçimde uzaklaşmaya başladı.'});
  }
  if(child.age===16&&d.confidence>=72){
    entries.push({age:state.player.age,kind:'child-development',text:child.name+' kendine güveni yüksek bir genç olarak belirginleşmeye başladı.'});
  }
  if(child.age>=12){
    updateNpcGoal(child,{
      kind:'child',
      careerSatisfaction:d.academicDrive,
      financialStability:d.independence,
      relationshipQuality:d.parentAttachment,
      independence:d.independence,
      wellbeing:100-d.identityStress
    });
  }
  if(child.age===16&&childGoal.progress>=70){
    entries.push({age:state.player.age,kind:'child-development',text:child.name+' kendi geleceği için “'+childGoal.label+'” yönünde belirgin bir hedef geliştirdi.'});
  }
  if(child.age===18){
    const score=d.academicDrive*.45+d.confidence*.2+d.independence*.2+d.socialSecurity*.15;
    child.educationPlan=score>=68?'university':score>=50?'vocational':'work';
    entries.push({age:state.player.age,kind:'child-development',paceBlock:true,text:child.name+' için yetişkinlik yönü '+(child.educationPlan==='university'?'üniversite':child.educationPlan==='vocational'?'mesleki eğitim':'doğrudan çalışma')+' tarafına şekillendi.'});
  }
 }
 return entries;
}
