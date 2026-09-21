function assetValue(state){
 let total=0;
 if(state.assets?.home) total+=state.assets.home.price??0;
 if(state.assets?.car) total+=Math.round((state.assets.car.price??0)*.45);
 if(state.business?.active) total+=Math.round((state.business.capital??0)*Math.max(.25,(state.business.health??50)/100));
 return total;
}

export function settleEstate(state){
 if(state.estate) return state.estate;
 const gross=Math.round((state.finance?.cash??0)+assetValue(state));
 const debt=Math.round(state.finance?.debt??0);
 const net=Math.max(0,gross-debt);
 const heirs=[];
 const children=state.children??[];
 const partner=state.social?.romance?.status==='married'?state.social.romance:null;

 if(partner&&children.length){
  const partnerShare=Math.round(net*.35);
  heirs.push({type:'spouse',name:partner.name,amount:partnerShare});
  const childPool=net-partnerShare;
  const each=Math.floor(childPool/children.length);
  children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
 }else if(partner){
  heirs.push({type:'spouse',name:partner.name,amount:net});
 }else if(children.length){
  const each=Math.floor(net/children.length);
  children.forEach(child=>heirs.push({type:'child',name:child.name,amount:each}));
 }else{
  heirs.push({type:'estate',name:'Tereke',amount:net});
 }

 state.estate={gross,debt,net,heirs,settledAtAge:state.player.age};
 return state.estate;
}
