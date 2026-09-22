const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function processHouseholdYear(state,rng){
 const partner=state.social?.romance;
 if(!partner||!partner.alive||!['cohabiting','married'].includes(partner.status))return [];

 partner.career??={
  employed:Boolean(partner.jobId&&partner.jobId!=='unemployed'),
  yearsEmployed:0,
  unemploymentYears:0,
  incomePeak:partner.monthlyIncome??0
 };

 const career=partner.career;
 const entries=[];
 if(career.employed){
  career.yearsEmployed+=1;
  career.unemploymentYears=0;

  const stress=state.healthProfile?.stress??30;
  const lossRisk=.008+(stress>=80?.006:0);
  if(rng.fork('partner-job-loss').chance(lossRisk)){
   career.employed=false;
   career.unemploymentYears=1;
   partner.previousMonthlyIncome=partner.monthlyIncome??0;
   partner.monthlyIncome=0;
   entries.push({age:state.player.age,kind:'household',paceBlock:true,text:partner.name+' işini kaybetti; hane geliri azaldı.'});
  }else{
   const growth=rng.int(0,4)/100;
   partner.monthlyIncome=Math.max(0,Math.round((partner.monthlyIncome??0)*(1+growth)));
   career.incomePeak=Math.max(career.incomePeak??0,partner.monthlyIncome);
  }
 }else{
  career.unemploymentYears=(career.unemploymentYears??0)+1;
  const reemploymentChance=clamp(.34+career.unemploymentYears*.10,.34,.78);
  if(rng.fork('partner-reemployment').chance(reemploymentChance)){
   career.employed=true;
   const baseline=partner.previousMonthlyIncome||career.incomePeak||30000;
   partner.monthlyIncome=Math.max(18000,Math.round(baseline*(.82+rng.int(0,18)/100)));
   career.yearsEmployed+=1;
   career.unemploymentYears=0;
   entries.push({age:state.player.age,kind:'household',text:partner.name+' yeniden çalışmaya başladı; hane geliri toparlandı.'});
  }
 }

 const relationship=partner.relationship??60;
 partner.householdContributionRate=clamp(
  (partner.status==='married'?.58:.50)+(relationship-60)*.0025,
  .42,.70
 );
 return entries;
}
