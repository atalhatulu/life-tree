function assetValue(state){
 let total=0;
 if(state.assets?.home) total+=state.assets.home.price??0;
 if(state.assets?.car) total+=Math.round((state.assets.car.price??0)*.45);
 if(state.business?.active) total+=Math.round((state.business.capital??0)*Math.max(.25,(state.business.health??50)/100));
 return total;
}

function distribute(state,net){
 const heirs=[];
 const children=state.children??[];
 const partner=state.social?.romance?.status==='married'?state.social.romance:null;
 const plan=state.estatePlan?.type??'balanced';

 let charitable=0;
 let familyNet=net;
 if(plan==='charity'){
  charitable=Math.round(net*.25);
  familyNet=net-charitable;
 }

 if(plan==='children-first'&&children.length){
  const childPool=Math.round(familyNet*(partner?.alive===false?1:.85));
  const partnerShare=familyNet-childPool;
  if(partner&&partnerShare>0)heirs.push({type:'spouse',name:partner.name,amount:partnerShare});
  const each=Math.floor(childPool/children.length);
  children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
 }else if(plan==='spouse-first'&&partner){
  const spouseShare=children.length?Math.round(familyNet*.70):familyNet;
  heirs.push({type:'spouse',name:partner.name,amount:spouseShare});
  const childPool=familyNet-spouseShare;
  if(children.length&&childPool>0){
   const each=Math.floor(childPool/children.length);
   children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
  }
 }else if(partner&&children.length){
  const partnerShare=Math.round(familyNet*.35);
  heirs.push({type:'spouse',name:partner.name,amount:partnerShare});
  const childPool=familyNet-partnerShare;
  const each=Math.floor(childPool/children.length);
  children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
 }else if(partner){
  heirs.push({type:'spouse',name:partner.name,amount:familyNet});
 }else if(children.length){
  const each=Math.floor(familyNet/children.length);
  children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
 }else{
  heirs.push({type:'estate',name:'Tereke',amount:familyNet});
 }

 if(charitable>0)heirs.push({type:'charity',name:'Hayır payı',amount:charitable});
 return heirs;
}

export function settleEstate(state){
 if(state.estate)return state.estate;
 const gross=Math.round((state.finance?.cash??0)+(state.finance?.savings??0)+assetValue(state));
 const debt=Math.round(state.finance?.debt??0);
 const net=Math.max(0,gross-debt);
 const heirs=distribute(state,net);
 state.estate={gross,debt,net,heirs,plan:state.estatePlan?.type??'balanced',settledAtAge:state.player.age};
 return state.estate;
}
