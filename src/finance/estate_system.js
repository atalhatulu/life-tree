// Settlement is a final, immutable ledger: never silently coerce a corrupt
// save or round an unsafe aggregate into an inheritable amount.
function estateMoney(value,label,{allowNegative=false}={}){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||(!allowNegative&&value<0))
  throw new RangeError('Invalid estate '+label);
 return value;
}

function estateSum(label,...values){
 const total=values.reduce((sum,value)=>sum+BigInt(value),0n);
 if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<0n)
  throw new RangeError('Estate '+label+' exceeds safe monetary limit');
 return Number(total);
}

function assetValue(state){
 const parts=[];
 if(state.assets?.home){
  parts.push(estateMoney(state.assets.home.price??0,'home price'));
 }
 if(state.assets?.car){
  const price=estateMoney(state.assets.car.price??0,'car price');
  parts.push(estateMoney(Math.round(price*.45),'car valuation'));
 }
 if(state.business?.active){
  const capital=estateMoney(state.business.capital??0,'business capital');
  const health=state.business.health??50;
  if(typeof health!=='number'||!Number.isFinite(health)||health<0||health>100)
   throw new RangeError('Invalid estate business health');
  parts.push(estateMoney(Math.round(capital*Math.max(.25,health/100)),'business valuation'));
 }
 return estateSum('assets',...parts);
}

// Allocate integer currency units without losing the division remainder.
// Earlier children receive the extra unit, making the result deterministic.
function allocateChildren(heirs,children,pool){
 const each=Math.floor(pool/children.length);
 const remainder=pool%children.length;
 children.forEach((child,index)=>heirs.push({
  type:'child',name:child.name,amount:each+(index<remainder?1:0)
 }));
}

function distribute(state,net){
 const heirs=[];
 const children=(state.children??[]).filter(child=>child.alive!==false);
 const partner=state.social?.romance?.status==='married'&&state.social.romance.alive!==false?state.social.romance:null;
 const plan=state.estatePlan?.type??'balanced';

 let charitable=0;
 let familyNet=net;
 if(plan==='charity'){
  charitable=Math.round(net*.25);
  familyNet=net-charitable;
 }

 if(plan==='children-first'&&children.length){
  const childPool=partner?Math.round(familyNet*.85):familyNet;
  const partnerShare=familyNet-childPool;
  if(partner&&partnerShare>0)heirs.push({type:'spouse',name:partner.name,amount:partnerShare});
  allocateChildren(heirs,children,childPool);
 }else if(plan==='spouse-first'&&partner){
  const spouseShare=children.length?Math.round(familyNet*.70):familyNet;
  heirs.push({type:'spouse',name:partner.name,amount:spouseShare});
  const childPool=familyNet-spouseShare;
  if(children.length&&childPool>0){
   allocateChildren(heirs,children,childPool);
  }
 }else if(partner&&children.length){
  const partnerShare=Math.round(familyNet*.35);
  heirs.push({type:'spouse',name:partner.name,amount:partnerShare});
  const childPool=familyNet-partnerShare;
  allocateChildren(heirs,children,childPool);
 }else if(partner){
  heirs.push({type:'spouse',name:partner.name,amount:familyNet});
 }else if(children.length){
  allocateChildren(heirs,children,familyNet);
 }else{
  heirs.push({type:'estate',name:'Tereke',amount:familyNet});
 }

 if(charitable>0)heirs.push({type:'charity',name:'Hayır payı',amount:charitable});
 return heirs;
}

export function settleEstate(state){
 if(state.estate)return state.estate;
 // Overdrawn cash is a liability, not a negative asset on the estate ledger.
 const cash=estateMoney(state.finance?.cash??0,'cash',{allowNegative:true});
 const savings=estateMoney(state.finance?.savings??0,'savings',{allowNegative:true});
 const loan=estateMoney(state.finance?.debt??0,'debt');
 const gross=estateSum('gross',Math.max(0,cash),Math.max(0,savings),assetValue(state));
 const debt=estateSum('debt',loan,Math.max(0,-cash),Math.max(0,-savings));
 const net=Math.max(0,gross-debt);
 const heirs=distribute(state,net);
 state.estate={gross,debt,net,heirs,plan:state.estatePlan?.type??'balanced',settledAtAge:state.player.age};
 return state.estate;
}
